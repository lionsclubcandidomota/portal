import { migratePortalPayload } from './core/portal-schema.js?v=6.46.13';
import { GITHUB_API_VERSION, GITHUB_CONFIG } from './github-config.js?v=6.46.13';

export function normalizeGitHubPayload(parsed) {
  const migrated = migratePortalPayload(parsed);
  const data = migrated.state;
  return {
    ...data,
    updatedAt: migrated.metadata.updatedAt || data.updatedAt || '',
    deploymentId: migrated.metadata.deploymentId || data.deploymentId || '',
    birthdays: Array.isArray(data.birthdays)
      ? data.birthdays.map(({ phone, email, telefone, ...birthday }) => birthday)
      : []
  };
}

export async function loadPublicGitHubPayload(url = null) {
  const targetUrl = url || new URL('data/dados.json', GITHUB_CONFIG.publicBaseUrl).href;
  const separator = targetUrl.includes('?') ? '&' : '?';
  const response = await fetch(`${targetUrl}${separator}v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Não foi possível carregar os dados públicos (${response.status}).`);
  const parsed = await response.json();
  return {
    state: normalizeGitHubPayload(parsed),
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
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': GITHUB_API_VERSION },
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
