const API_VERSION = '2022-11-28';
const RELEASE_MANIFEST_PATH = 'release-manifest.json';
const PORTAL_APP_ID = 'Lions Clube de Cândido Mota Dashboard';
const DEFAULT_SCHEMA_VERSION = 11;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 20 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function config(env) {
  const owner = String(env.GITHUB_OWNER || '').trim();
  const repo = String(env.GITHUB_REPO || '').trim();
  const branch = String(env.GITHUB_BRANCH || 'main').trim();
  const path = String(env.GITHUB_DATA_PATH || 'data/dados.json').trim();
  const token = String(env.GITHUB_TOKEN || '').trim();
  if (!owner || !repo) throw new Error('GITHUB_OWNER e GITHUB_REPO precisam estar configurados.');
  if (!token) throw new Error('GITHUB_TOKEN ainda não foi configurado como segredo do Worker.');
  return { owner, repo, branch, path, token };
}

function repositoryApiUrl(env, suffix = '') {
  const { owner, repo } = config(env);
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

function contentApiUrl(env, path) {
  const encodedPath = String(path || '').split('/').map(encodeURIComponent).join('/');
  return repositoryApiUrl(env, `/contents/${encodedPath}`);
}

function headers(env, extra = {}) {
  const { token } = config(env);
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'Lions-Portal-D1-Worker',
    ...extra
  };
}

function normalizePath(value) {
  return String(value || '').replace(/^\.\//, '').replaceAll('\\', '/');
}

function base64EncodeBytes(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64EncodeText(value) {
  return base64EncodeBytes(encoder.encode(String(value || '')));
}

function base64DecodeBytes(value) {
  const binary = atob(String(value || '').replace(/\s+/g, ''));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function base64DecodeText(value) {
  return decoder.decode(base64DecodeBytes(value));
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function parseJsonResponse(response, fallback) {
  try {
    return await response.json();
  } catch {
    throw new Error(fallback);
  }
}

function throwGitHubError(response, fallback = 'Falha ao acessar o GitHub.') {
  if (response.status === 401) throw new Error('O GITHUB_TOKEN configurado no Worker é inválido ou expirou.');
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    throw new Error('O limite de consultas do GitHub foi atingido. Aguarde e tente novamente.');
  }
  if (response.status === 403) throw new Error('O GITHUB_TOKEN não possui permissão de escrita no repositório.');
  if (response.status === 404) throw new Error('Repositório ou arquivo público não encontrado no GitHub.');
  throw new Error(`${fallback} (${response.status}).`);
}

async function readRepositoryFile(env, path, ref) {
  const response = await fetch(`${contentApiUrl(env, path)}?ref=${encodeURIComponent(ref)}`, {
    headers: headers(env),
    cache: 'no-store'
  });
  if (!response.ok) throwGitHubError(response);
  return parseJsonResponse(response, 'O GitHub retornou uma resposta inválida.');
}

async function readLargeBlob(env, sha, label) {
  const response = await fetch(repositoryApiUrl(env, `/git/blobs/${encodeURIComponent(sha)}`), {
    headers: headers(env),
    cache: 'no-store'
  });
  if (!response.ok) throwGitHubError(response, `Não foi possível carregar ${label}`);
  const blob = await parseJsonResponse(response, `O GitHub retornou ${label} inválido.`);
  if (blob.encoding !== 'base64' || !blob.content) throw new Error(`${label} não está em Base64.`);
  return blob.content;
}

async function repositoryFileText(env, file, label) {
  const content = file?.content || (file?.sha ? await readLargeBlob(env, file.sha, label) : '');
  if (!content) throw new Error(`${label} está vazio ou indisponível.`);
  return base64DecodeText(content).replace(/^\uFEFF/, '').trim();
}

async function getBranchHead(env) {
  const { branch } = config(env);
  const response = await fetch(repositoryApiUrl(env, `/git/ref/heads/${encodeURIComponent(branch)}`), {
    headers: headers(env),
    cache: 'no-store'
  });
  if (!response.ok) throwGitHubError(response, 'Não foi possível consultar a branch principal');
  const payload = await parseJsonResponse(response, 'O GitHub não retornou a referência da branch.');
  if (!payload.object?.sha) throw new Error('A branch não possui um commit válido.');
  return payload.object.sha;
}

async function getCommitTree(env, commitSha) {
  const response = await fetch(repositoryApiUrl(env, `/git/commits/${encodeURIComponent(commitSha)}`), {
    headers: headers(env),
    cache: 'no-store'
  });
  if (!response.ok) throwGitHubError(response, 'Não foi possível consultar o commit atual');
  const payload = await parseJsonResponse(response, 'O GitHub não retornou o commit atual.');
  if (!payload.tree?.sha) throw new Error('O commit atual não possui uma árvore válida.');
  return payload.tree.sha;
}

async function createBlob(env, content) {
  const response = await fetch(repositoryApiUrl(env, '/git/blobs'), {
    method: 'POST',
    headers: headers(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ content, encoding: 'base64' })
  });
  if (!response.ok) throwGitHubError(response, 'Falha ao preparar arquivo para publicação');
  const payload = await parseJsonResponse(response, 'O GitHub não confirmou o arquivo preparado.');
  if (!payload.sha) throw new Error('O GitHub não retornou o identificador do arquivo.');
  return payload.sha;
}

async function createTree(env, baseTreeSha, entries) {
  const response = await fetch(repositoryApiUrl(env, '/git/trees'), {
    method: 'POST',
    headers: headers(env, { 'Content-Type': 'application/json' }),
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
  if (!response.ok) throwGitHubError(response, 'Não foi possível organizar os arquivos da publicação');
  const payload = await parseJsonResponse(response, 'O GitHub não confirmou a árvore da publicação.');
  if (!payload.sha) throw new Error('O GitHub não retornou a árvore da publicação.');
  return payload.sha;
}

async function createCommit(env, message, treeSha, parentSha) {
  const response = await fetch(repositoryApiUrl(env, '/git/commits'), {
    method: 'POST',
    headers: headers(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] })
  });
  if (!response.ok) throwGitHubError(response, 'Não foi possível criar o commit');
  const payload = await parseJsonResponse(response, 'O GitHub não confirmou o commit.');
  if (!payload.sha) throw new Error('O GitHub não retornou o identificador do commit.');
  return payload;
}

async function updateBranch(env, commitSha) {
  const { branch } = config(env);
  const response = await fetch(repositoryApiUrl(env, `/git/refs/heads/${encodeURIComponent(branch)}`), {
    method: 'PATCH',
    headers: headers(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ sha: commitSha, force: false })
  });
  if (response.status === 409 || response.status === 422) {
    throw new Error('Conflito de edição. Atualize o Portal antes de publicar novamente.');
  }
  if (!response.ok) throwGitHubError(response, 'Não foi possível atualizar a branch principal');
}

function summarizeManifest(files, previous = {}) {
  const extensionCount = extension => files.filter(file => file.path.endsWith(extension)).length;
  return {
    ...previous,
    files: files.length,
    javascript: extensionCount('.js') + extensionCount('.mjs'),
    css: extensionCount('.css'),
    tests: files.filter(file => file.path.startsWith('tests/')).length,
    memberImages: files.filter(file => file.path.startsWith('public/members/')).length,
    totalBytes: files.reduce((sum, file) => sum + Number(file.bytes || 0), 0)
  };
}

async function manifestEntry(path, bytes) {
  return { path: normalizePath(path), bytes: bytes.byteLength, sha256: await sha256Hex(bytes) };
}

async function updateManifest(manifest, { dataPath, dataContent, assets, deletedPaths, updatedAt }) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.files)) {
    throw new Error('release-manifest.json está inválido. Atualize o repositório antes de publicar.');
  }
  const byPath = new Map(
    manifest.files.filter(file => file?.path).map(file => [normalizePath(file.path), {
      ...file,
      path: normalizePath(file.path)
    }])
  );
  byPath.set(dataPath, await manifestEntry(dataPath, encoder.encode(dataContent)));
  for (const asset of assets) {
    byPath.set(asset.path, await manifestEntry(asset.path, asset.bytes));
  }
  for (const path of deletedPaths) byPath.delete(path);
  const files = [...byPath.values()].sort((first, second) => first.path.localeCompare(second.path));
  return {
    ...manifest,
    runtimeUpdatedAt: updatedAt,
    summary: summarizeManifest(files, manifest.summary),
    files
  };
}

function publicStateIsSafe(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const privateCollections = ['treasury', 'treasuryAccounts', 'treasuryCategories', 'familyGroups', 'mutualGroups'];
  for (const key of privateCollections) {
    if (Array.isArray(state[key]) && state[key].length > 0) return false;
    if (state[key] && !Array.isArray(state[key])) return false;
  }
  const director = state.settings?.accessProfiles?.director;
  if (director && (director.passwordHash || director.salt || director.iterations)) return false;
  const serialized = JSON.stringify(state);
  return !/("githubToken"|"passwordHash"|"privateRevision"|"sessionToken")\s*:/i.test(serialized);
}

function prepareAssets(mediaAssets = []) {
  let total = 0;
  const paths = new Set();
  return mediaAssets.map(asset => {
    const path = normalizePath(asset?.path);
    if (!/^public\/(members|branding|treasury)\/[a-z0-9/_-]+\.[a-z0-9]+$/i.test(path)) {
      throw new Error(`Caminho de mídia pública inválido: ${path || 'vazio'}.`);
    }
    if (paths.has(path)) throw new Error(`Mídia repetida na publicação: ${path}.`);
    paths.add(path);
    if (asset?.encoding !== 'base64' || !asset?.content) throw new Error(`Conteúdo inválido para ${path}.`);
    const bytes = base64DecodeBytes(asset.content);
    if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error(`${path} excede o limite de 8 MB.`);
    total += bytes.byteLength;
    if (total > MAX_TOTAL_ASSET_BYTES) throw new Error('As mídias da publicação excedem o limite total de 20 MB.');
    return { path, bytes, content: String(asset.content).replace(/\s+/g, '') };
  });
}

export async function publicationStatus(env) {
  let repositoryReady = false;
  let warning = '';
  if (env.GITHUB_TOKEN) {
    try {
      const response = await fetch(repositoryApiUrl(env), { headers: headers(env), cache: 'no-store' });
      repositoryReady = response.ok;
      if (!response.ok) warning = `O GitHub respondeu com status ${response.status}.`;
      else {
        const repository = await response.json();
        if (repository.archived || repository.disabled || repository.permissions?.push !== true) {
          repositoryReady = false;
          warning = 'O token não possui permissão de escrita ou o repositório não está disponível.';
        }
      }
    } catch (error) {
      warning = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    available: Boolean(env.GITHUB_TOKEN),
    repositoryReady,
    repository: env.GITHUB_OWNER && env.GITHUB_REPO ? `${env.GITHUB_OWNER}/${env.GITHUB_REPO}` : '',
    branch: String(env.GITHUB_BRANCH || 'main'),
    warning
  };
}

export async function publishPortalPublicState(env, body = {}, actor = {}) {
  const state = body.state;
  if (!publicStateIsSafe(state)) {
    throw new Error('A publicação foi bloqueada porque o conteúdo enviado possui dados privados.');
  }
  const { owner, repo, branch, path: dataPath } = config(env);
  const headSha = await getBranchHead(env);
  const [currentDataFile, currentManifestFile] = await Promise.all([
    readRepositoryFile(env, dataPath, headSha),
    readRepositoryFile(env, RELEASE_MANIFEST_PATH, headSha)
  ]);
  const expectedDataSha = String(body.expectedDataSha || '');
  if (expectedDataSha && currentDataFile.sha !== expectedDataSha) {
    throw new Error('Conflito de edição. Atualize os dados públicos antes de publicar novamente.');
  }

  const publishedAt = new Date().toISOString();
  const deploymentId = `${Date.now()}-${crypto.randomUUID()}`;
  const { updatedAt: _oldUpdatedAt, deploymentId: _oldDeploymentId, ...cleanState } = state;
  const schemaVersion = Math.max(1, Number(body.schemaVersion || DEFAULT_SCHEMA_VERSION));
  const envelope = {
    updatedAt: publishedAt,
    deploymentId,
    app: PORTAL_APP_ID,
    schemaVersion,
    version: schemaVersion,
    data: cleanState
  };
  const jsonText = `${JSON.stringify(envelope, null, 2)}\n`;
  const assets = prepareAssets(Array.isArray(body.mediaAssets) ? body.mediaAssets : []);
  const deletedPaths = [...new Set(Array.isArray(body.deletedPaths) ? body.deletedPaths : [])]
    .map(normalizePath)
    .filter(path => /^public\/(members|branding|treasury)\/[a-z0-9/_-]+\.[a-z0-9]+$/i.test(path));

  let currentManifest;
  try {
    currentManifest = JSON.parse(await repositoryFileText(env, currentManifestFile, RELEASE_MANIFEST_PATH));
  } catch (error) {
    if (/release-manifest\.json está/i.test(error?.message || '')) throw error;
    throw new Error('release-manifest.json está inválido. Atualize o repositório antes de publicar.');
  }
  const nextManifest = await updateManifest(currentManifest, {
    dataPath,
    dataContent: jsonText,
    assets,
    deletedPaths,
    updatedAt: publishedAt
  });

  const baseTreeSha = await getCommitTree(env, headSha);
  const entries = [];
  for (const asset of assets) {
    entries.push({ path: asset.path, sha: await createBlob(env, asset.content) });
  }
  for (const deletedPath of deletedPaths) entries.push({ path: deletedPath, sha: null });
  const dataBlobSha = await createBlob(env, base64EncodeText(jsonText));
  entries.push({ path: dataPath, sha: dataBlobSha });
  const manifestBlobSha = await createBlob(env, base64EncodeText(`${JSON.stringify(nextManifest, null, 2)}\n`));
  entries.push({ path: RELEASE_MANIFEST_PATH, sha: manifestBlobSha });
  const treeSha = await createTree(env, baseTreeSha, entries);
  const message = String(body.commitMessage || 'Atualiza conteúdo público do Portal').trim().slice(0, 240);
  const commit = await createCommit(env, message, treeSha, headSha);
  await updateBranch(env, commit.sha);

  return {
    sha: dataBlobSha,
    manifestSha: manifestBlobSha,
    commitSha: commit.sha,
    commitUrl: commit.html_url || `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
    committedAt: publishedAt,
    deploymentId,
    mediaCount: assets.length,
    deletedMediaCount: deletedPaths.length,
    publishedBy: String(actor.sub || actor.name || 'administrador'),
    branch
  };
}
