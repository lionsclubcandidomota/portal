import { migratePortalPayload } from './core/portal-schema.js?v=6.47.2';
import { createPublicPortalState } from './core/portal-data-boundary.js?v=6.47.2';

export const PUBLIC_DATA_CONFIG = Object.freeze({
  workerUrl: 'https://lions-portal-anexos.lionsclubcandidomota.workers.dev',
  statePath: '/api/public/state',
  source: 'cloudflare-d1'
});

// Alias temporário para módulos antigos. O GitHub não é mais fonte de dados.
export const GITHUB_CONFIG = Object.freeze({
  owner: 'lionsclubcandidomota',
  repo: 'portal',
  branch: 'main',
  path: '',
  publicBaseUrl: `${PUBLIC_DATA_CONFIG.workerUrl}/`
});

const publicPayloadCache = new Map();

function cachedPayload(targetUrl) {
  return publicPayloadCache.get(targetUrl) || null;
}

function responseEtag(response) {
  return String(response?.headers?.get?.('ETag') || '').trim();
}

function buildPublicPayload(parsed) {
  const revision = String(parsed?.revision || parsed?.deploymentId || '');
  return {
    state: normalizePayload(parsed),
    deploymentId: revision,
    revision,
    updatedAt: String(parsed?.updatedAt || ''),
    source: 'd1',
    migrationPending: parsed?.migrationPending === true,
    migrationMessage: String(parsed?.migrationMessage || '')
  };
}

function publicStateUrl(url = null) {
  return url || new URL(PUBLIC_DATA_CONFIG.statePath, PUBLIC_DATA_CONFIG.workerUrl).href;
}

function normalizePayload(parsed) {
  const migrated = migratePortalPayload(parsed);
  const data = migrated.state;
  const normalized = createPublicPortalState({
    ...data,
    updatedAt: migrated.metadata.updatedAt || data.updatedAt || '',
    deploymentId: migrated.metadata.deploymentId || parsed?.revision || data.deploymentId || '',
    birthdays: Array.isArray(data.birthdays)
      ? data.birthdays.map(({ phone, email, telefone, ...birthday }) => birthday)
      : []
  });

  if (parsed?.migrationPending === true) {
    // A resposta de transição existe apenas para liberar a autenticação. Ela não
    // pode substituir o cache local por coleções vazias enquanto o Worker tenta
    // recuperar o conteúdo público anterior.
    delete normalized.birthdays;
    delete normalized.events;
    delete normalized.meetings;
    delete normalized.notices;
    normalized.publicMigrationPending = true;
  }
  return normalized;
}

export async function loadPublicD1Payload(url = null) {
  const targetUrl = publicStateUrl(url);
  const cached = cachedPayload(targetUrl);
  const headers = { Accept: 'application/json' };
  if (cached?.etag) headers['If-None-Match'] = cached.etag;

  let response = await fetch(targetUrl, { cache: 'no-cache', headers });
  if (response.status === 304 && cached?.parsed) {
    return buildPublicPayload(cached.parsed);
  }
  // Uma resposta 304 sem cache local pode ocorrer após limpeza parcial do navegador.
  if (response.status === 304) {
    response = await fetch(targetUrl, { cache: 'reload', headers: { Accept: 'application/json' } });
  }
  if (!response.ok) {
    let message = '';
    try {
      const payload = await response.json();
      message = String(payload?.error || '');
    } catch {
      // Resposta sem JSON.
    }
    throw new Error(message || `Não foi possível carregar os dados públicos do D1 (${response.status}).`);
  }
  const parsed = await response.json();
  publicPayloadCache.set(targetUrl, { etag: responseEtag(response), parsed });
  return buildPublicPayload(parsed);
}

export async function loadPublicD1State() {
  return (await loadPublicD1Payload()).state;
}

export async function waitForPublicDataRevision(revision, options = {}) {
  const timeout = options.timeout || 30000;
  const interval = options.interval || 1000;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const payload = await loadPublicD1Payload();
    if (!revision || payload.revision === revision) {
      return {
        publishedAt: payload.updatedAt || new Date().toISOString(),
        updatedAt: payload.updatedAt,
        revision: payload.revision,
        source: 'd1'
      };
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('A gravação foi confirmada, mas a nova revisão pública ainda não pôde ser lida.');
}

export async function loadLatestPublicationInfo() {
  const payload = await loadPublicD1Payload();
  if (!payload.revision) return null;
  return {
    sha: payload.revision,
    revision: payload.revision,
    url: '',
    date: payload.updatedAt,
    message: 'Conteúdo público armazenado no Cloudflare D1',
    source: 'd1'
  };
}

// Compatibilidade com os nomes usados até a v6.46.0.
export const loadPublicGitHubPayload = loadPublicD1Payload;
export const loadPublicGitHubState = loadPublicD1State;
export const waitForPagesDeployment = waitForPublicDataRevision;
export const loadLatestCommitInfo = loadLatestPublicationInfo;
