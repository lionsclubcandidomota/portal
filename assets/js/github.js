import { createPortalEnvelope, migratePortalPayload } from './core/portal-schema.js?v=6.34.0';
import { normalizeGitHubToken } from './core/portal-security.js?v=6.34.0';
import { createPublicPortalState } from './core/portal-data-boundary.js?v=6.34.0';

export const GITHUB_CONFIG = Object.freeze({
  owner: 'lionsclubcandidomota',
  repo: 'portal',
  branch: 'main',
  path: 'data/dados.json',
  publicBaseUrl: 'https://lionsclubcandidomota.github.io/portal/'
});

const API_VERSION = '2022-11-28';

function repositoryApiUrl(suffix = '') {
  const { owner, repo } = GITHUB_CONFIG;
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

function contentApiUrl(path = GITHUB_CONFIG.path) {
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
  return repositoryApiUrl(`/contents/${encodedPath}`);
}

function authorizedHeaders(token, extra = {}) {
  const safeToken = normalizeGitHubToken(token);
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${safeToken}`,
    'X-GitHub-Api-Version': API_VERSION,
    ...extra
  };
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function normalizePayload(parsed, { publicOnly = false } = {}) {
  const migrated = migratePortalPayload(parsed);
  const data = migrated.state;
  const normalized = {
    ...data,
    updatedAt: migrated.metadata.updatedAt || data.updatedAt || '',
    deploymentId: migrated.metadata.deploymentId || data.deploymentId || '',
    birthdays: Array.isArray(data.birthdays)
      ? data.birthdays.map(({ phone, email, telefone, ...birthday }) => birthday)
      : []
  };
  return publicOnly ? createPublicPortalState(normalized) : normalized;
}

function sanitizeState(state) {
  const { updatedAt, deploymentId, ...cleanState } = state || {};
  return {
    ...cleanState,
    birthdays: Array.isArray(cleanState.birthdays)
      ? cleanState.birthdays.map(({ phone, email, telefone, ...birthday }) => birthday)
      : []
  };
}

async function parseJsonResponse(response, fallbackMessage) {
  try {
    return await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }
}

function throwGitHubAccessError(response, fallback = 'Falha ao acessar o GitHub.') {
  if (response.status === 401) throw new Error('Token inválido ou expirado.');
  if (response.status === 403 && response.headers?.get?.('x-ratelimit-remaining') === '0') {
    throw new Error('O limite de consultas do GitHub foi atingido. Aguarde alguns minutos e tente novamente.');
  }
  if (response.status === 403) throw new Error('O token não possui permissão de acesso ao repositório.');
  if (response.status === 404) throw new Error('Repositório ou arquivo data/dados.json não encontrado para este token.');
  throw new Error(`${fallback} (${response.status}).`);
}

async function readRepositoryFile(token, path = GITHUB_CONFIG.path) {
  const response = await fetch(`${contentApiUrl(path)}?ref=${encodeURIComponent(GITHUB_CONFIG.branch)}`, {
    headers: authorizedHeaders(token),
    cache: 'no-store'
  });
  if (!response.ok) throwGitHubAccessError(response);
  return parseJsonResponse(response, 'O GitHub retornou uma resposta vazia ou inválida.');
}

async function readLargeFileBlob(token, sha) {
  const response = await fetch(repositoryApiUrl(`/git/blobs/${encodeURIComponent(sha)}`), {
    headers: authorizedHeaders(token),
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o arquivo data/dados.json (${response.status}).`);
  }

  const blob = await parseJsonResponse(
    response,
    'O GitHub retornou uma resposta inválida ao carregar data/dados.json.'
  );
  if (blob.encoding !== 'base64' || typeof blob.content !== 'string' || !blob.content.trim()) {
    throw new Error('O GitHub não retornou o conteúdo de data/dados.json em um formato compatível.');
  }
  return blob.content;
}

async function createGitBlob(token, content) {
  const response = await fetch(repositoryApiUrl('/git/blobs'), {
    method: 'POST',
    headers: authorizedHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content, encoding: 'base64' })
  });
  if (!response.ok) throwGitHubAccessError(response, 'Falha ao preparar um arquivo para publicação');
  const result = await parseJsonResponse(response, 'O GitHub não confirmou a preparação do arquivo.');
  if (!result.sha) throw new Error('O GitHub não retornou o identificador do arquivo preparado.');
  return result.sha;
}

async function getBranchHead(token) {
  const response = await fetch(
    repositoryApiUrl(`/git/ref/heads/${encodeURIComponent(GITHUB_CONFIG.branch)}`),
    { headers: authorizedHeaders(token), cache: 'no-store' }
  );
  if (!response.ok) throwGitHubAccessError(response, 'Não foi possível consultar a branch principal');
  const result = await parseJsonResponse(response, 'O GitHub não retornou a referência da branch.');
  const sha = result.object?.sha;
  if (!sha) throw new Error('A referência atual da branch não possui um commit válido.');
  return sha;
}

async function getCommitTree(token, commitSha) {
  const response = await fetch(repositoryApiUrl(`/git/commits/${encodeURIComponent(commitSha)}`), {
    headers: authorizedHeaders(token),
    cache: 'no-store'
  });
  if (!response.ok) throwGitHubAccessError(response, 'Não foi possível consultar o commit atual');
  const result = await parseJsonResponse(response, 'O GitHub não retornou o commit atual.');
  const treeSha = result.tree?.sha;
  if (!treeSha) throw new Error('O commit atual não possui uma árvore de arquivos válida.');
  return treeSha;
}

async function createGitTree(token, baseTreeSha, entries) {
  const response = await fetch(repositoryApiUrl('/git/trees'), {
    method: 'POST',
    headers: authorizedHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: entries.map(entry => ({
        path: entry.path,
        mode: '100644',
        type: 'blob',
        sha: entry.sha
      }))
    })
  });
  if (!response.ok) throwGitHubAccessError(response, 'Não foi possível organizar os arquivos da publicação');
  const result = await parseJsonResponse(response, 'O GitHub não confirmou a árvore da publicação.');
  if (!result.sha) throw new Error('O GitHub não retornou o identificador da árvore publicada.');
  return result.sha;
}

async function createGitCommit(token, message, treeSha, parentSha) {
  const response = await fetch(repositoryApiUrl('/git/commits'), {
    method: 'POST',
    headers: authorizedHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] })
  });
  if (!response.ok) throwGitHubAccessError(response, 'Não foi possível criar o commit da publicação');
  const result = await parseJsonResponse(response, 'O GitHub não confirmou o commit da publicação.');
  if (!result.sha) throw new Error('O GitHub não retornou o identificador do novo commit.');
  return result;
}

async function updateBranchReference(token, commitSha) {
  const response = await fetch(
    repositoryApiUrl(`/git/refs/heads/${encodeURIComponent(GITHUB_CONFIG.branch)}`),
    {
      method: 'PATCH',
      headers: authorizedHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ sha: commitSha, force: false })
    }
  );
  if (response.status === 409 || response.status === 422) {
    throw new Error('Conflito de edição. Recarregue os dados do GitHub antes de publicar novamente.');
  }
  if (!response.ok) throwGitHubAccessError(response, 'Não foi possível atualizar a branch principal');
}

export async function loadPublicGitHubPayload(url = null) {
  const targetUrl = url || new URL('data/dados.json', GITHUB_CONFIG.publicBaseUrl).href;
  const separator = targetUrl.includes('?') ? '&' : '?';
  const response = await fetch(`${targetUrl}${separator}v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Não foi possível carregar os dados públicos (${response.status}).`);
  const parsed = await response.json();
  return {
    state: normalizePayload(parsed, { publicOnly: true }),
    deploymentId: parsed?.deploymentId || '',
    updatedAt: parsed?.updatedAt || ''
  };
}

export async function loadPublicGitHubState() {
  return (await loadPublicGitHubPayload()).state;
}

export async function waitForPagesDeployment(deploymentId, options = {}) {
  const timeout = options.timeout || 90000;
  const interval = options.interval || 2000;
  const siteDataUrl = new URL('data/dados.json', GITHUB_CONFIG.publicBaseUrl).href;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    try {
      const payload = await loadPublicGitHubPayload(siteDataUrl);
      if (payload.deploymentId === deploymentId) {
        return { publishedAt: new Date().toISOString(), updatedAt: payload.updatedAt };
      }
    } catch {
      // A publicação ainda pode estar propagando. A próxima tentativa é silenciosa.
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('O commit foi gravado, mas a confirmação pública ainda está pendente.');
}

export async function loadLatestCommitInfo() {
  const { owner, repo, branch, path } = GITHUB_CONFIG;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=1&ts=${Date.now()}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': API_VERSION },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Não foi possível consultar o último commit (${response.status}).`);
  const commits = await response.json();
  const commit = commits[0];
  if (!commit) return null;
  return {
    sha: commit.sha || '',
    url: commit.html_url || '',
    date: commit.commit?.committer?.date || commit.commit?.author?.date || '',
    message: commit.commit?.message || ''
  };
}


export async function loadAuthenticatedGitHubUser(token) {
  const response = await fetch('https://api.github.com/user', {
    headers: authorizedHeaders(token),
    cache: 'no-store'
  });
  if (!response.ok) throwGitHubAccessError(response, 'Não foi possível identificar o usuário do GitHub');
  const user = await parseJsonResponse(response, 'O GitHub não retornou os dados do usuário autenticado.');
  return {
    id: user.id ? String(user.id) : '',
    login: String(user.login || ''),
    name: String(user.name || user.login || 'Administrador'),
    avatarUrl: String(user.avatar_url || '')
  };
}

export async function loadRepositoryAuthorization(token) {
  const response = await fetch(repositoryApiUrl(), {
    headers: authorizedHeaders(token),
    cache: 'no-store'
  });
  if (!response.ok) throwGitHubAccessError(response, 'Não foi possível validar as permissões do repositório');
  const repository = await parseJsonResponse(response, 'O GitHub não retornou os dados do repositório.');
  const expectedFullName = `${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`.toLocaleLowerCase('en-US');
  const receivedFullName = String(repository.full_name || '').toLocaleLowerCase('en-US');

  if (receivedFullName && receivedFullName !== expectedFullName) {
    throw new Error('O token foi associado a um repositório diferente do portal configurado.');
  }

  const unavailable = Boolean(repository.archived || repository.disabled);
  const canPush = unavailable ? false : repository.permissions?.push !== false;
  let warning = '';

  if (unavailable) {
    warning = 'O repositório do portal está arquivado ou desativado e não aceita publicações.';
  } else if (repository.permissions?.push === false) {
    warning = 'O GitHub não confirmou permissão de escrita para este token. O acesso administrativo foi liberado, mas a publicação poderá exigir outro token.';
  }

  return {
    repository: repository.full_name || `${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`,
    branch: GITHUB_CONFIG.branch,
    canPush,
    verified: true,
    warning,
    private: Boolean(repository.private)
  };
}

function unavailableAuthorization(error) {
  return {
    repository: `${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`,
    branch: GITHUB_CONFIG.branch,
    canPush: null,
    verified: false,
    warning: `Não foi possível confirmar antecipadamente a permissão de publicação. ${error?.message || 'A verificação será feita ao publicar.'}`
  };
}

export async function connectGitHub(token) {
  const safeToken = normalizeGitHubToken(token);
  const [file, actor, authorization] = await Promise.all([
    readRepositoryFile(safeToken),
    loadAuthenticatedGitHubUser(safeToken).catch(() => null),
    loadRepositoryAuthorization(safeToken).catch(unavailableAuthorization)
  ]);
  let encodedContent = '';

  if (typeof file.content === 'string' && file.content.trim()) {
    encodedContent = file.content;
  } else if (file.sha) {
    encodedContent = await readLargeFileBlob(safeToken, file.sha);
  }

  let rawContent = '';
  try {
    rawContent = decodeBase64Utf8(encodedContent).replace(/^\uFEFF/, '').trim();
  } catch {
    throw new Error('Não foi possível decodificar o arquivo data/dados.json do GitHub.');
  }
  if (!rawContent) {
    throw new Error('O arquivo data/dados.json está vazio no GitHub. Restaure um JSON válido antes de entrar.');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    console.error('JSON remoto inválido:', error);
    throw new Error('O arquivo data/dados.json do GitHub está incompleto ou possui JSON inválido.');
  }

  return { state: normalizePayload(parsed), sha: file.sha, actor, authorization };
}

/**
 * Publica o JSON e seus ativos de mídia em um único commit Git. A referência da
 * branch é atualizada somente depois de todos os blobs estarem preparados, de
 * modo que o portal nunca aponte para uma foto que ainda não exista.
 */
export async function saveGitHubState(
  token,
  state,
  expectedDataSha,
  commitMessage = 'Atualiza dados do painel Lions',
  mediaAssets = [],
  deletedPaths = [],
  options = {}
) {
  const safeToken = normalizeGitHubToken(token);
  const currentDataFile = await readRepositoryFile(safeToken);
  if (expectedDataSha && currentDataFile.sha !== expectedDataSha) {
    throw new Error('Conflito de edição. Recarregue os dados do GitHub antes de publicar novamente.');
  }

  const deploymentId = `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const publishState = options.publicOnly === false
    ? sanitizeState(state)
    : createPublicPortalState(sanitizeState(state));
  const payload = createPortalEnvelope(publishState, {
    updatedAt: new Date().toISOString(),
    deploymentId,
    audience: options.publicOnly === false ? 'legacy-full' : 'public'
  });
  const jsonContent = encodeBase64Utf8(`${JSON.stringify(payload, null, 2)}\n`);

  const headSha = await getBranchHead(safeToken);
  const baseTreeSha = await getCommitTree(safeToken, headSha);
  const entries = [];

  for (const asset of Array.isArray(mediaAssets) ? mediaAssets : []) {
    if (!asset?.path || asset.encoding !== 'base64' || !asset.content) continue;
    entries.push({
      path: String(asset.path).replace(/^\.\//, ''),
      sha: await createGitBlob(safeToken, String(asset.content).replace(/\s+/g, ''))
    });
  }

  for (const path of [...new Set(Array.isArray(deletedPaths) ? deletedPaths : [])]) {
    const normalizedPath = String(path || '').replace(/^\.\//, '');
    if (!/^public\/treasury\/[a-z0-9/_-]+\.[a-z0-9]+$/i.test(normalizedPath)) continue;
    entries.push({ path: normalizedPath, sha: null });
  }

  const dataBlobSha = await createGitBlob(safeToken, jsonContent);
  entries.push({ path: GITHUB_CONFIG.path, sha: dataBlobSha });

  const treeSha = await createGitTree(safeToken, baseTreeSha, entries);
  const commit = await createGitCommit(safeToken, commitMessage, treeSha, headSha);
  await updateBranchReference(safeToken, commit.sha);

  return {
    sha: dataBlobSha,
    commitSha: commit.sha,
    commitUrl: commit.html_url || `https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/commit/${commit.sha}`,
    committedAt: new Date().toISOString(),
    deploymentId,
    mediaCount: entries.filter(entry => entry.sha).length - 1,
    deletedMediaCount: entries.filter(entry => entry.sha === null).length
  };
}
