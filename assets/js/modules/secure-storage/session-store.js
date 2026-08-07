const SESSION_REFRESH_MARGIN_MS = 60_000;

let activeSession = emptySession();

function emptySession() {
  return {
    workerUrl: '',
    role: '',
    token: '',
    expiresAt: 0,
    privateRevision: '',
    user: null,
    publication: null
  };
}

function safeUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return '';
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return '';
  }
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
  const cloudflareWorker = parsed.hostname.endsWith('.workers.dev');
  if (!cloudflareWorker && !local) return '';
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return '';
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

export function secureStorageJsonHeaders(token = '') {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function readSecureStorageJson(response, fallback) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Respostas intermediárias de rede podem não conter JSON.
  }
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `${fallback} (${response.status}).`);
  }
  return payload || {};
}

export function secureStorageApiUrl(workerUrl, path) {
  return `${safeUrl(workerUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

export function secureStorageProfileFromState(state) {
  const source = state?.settings?.secureStorage;
  const workerUrl = safeUrl(source?.workerUrl);
  return {
    version: Math.max(1, Number(source?.version || 1)),
    enabled: Boolean(source?.enabled && workerUrl),
    workerUrl,
    provider: 'cloudflare-r2'
  };
}

export function normalizeSecureStorageWorkerUrl(value) {
  const normalized = safeUrl(value);
  if (!normalized) {
    throw new Error('Informe uma URL HTTPS válida do Cloudflare Worker.');
  }
  return normalized;
}

export function secureStorageSessionSnapshot() {
  return { ...activeSession, token: activeSession.token ? 'configured' : '' };
}

export function getActiveSecureStorageSession() {
  return activeSession;
}

export function setActiveSecureStorageSession(session) {
  activeSession = {
    ...emptySession(),
    ...(session && typeof session === 'object' ? session : {})
  };
  return activeSession;
}

export function clearSecureStorageSession() {
  activeSession = emptySession();
}

export function getSecureStoragePrivateRevision() {
  return String(activeSession.privateRevision || '');
}

export function setSecureStoragePrivateRevision(revision) {
  activeSession.privateRevision = String(revision || '');
  return activeSession.privateRevision;
}

export function hasActiveSecureStorageSession(state, role = '') {
  const profile = secureStorageProfileFromState(state);
  if (!profile.enabled) return false;
  return activeSession.workerUrl === profile.workerUrl
    && Boolean(activeSession.token)
    && (!role || activeSession.role === role)
    && activeSession.expiresAt > Date.now() + SESSION_REFRESH_MARGIN_MS;
}

export function requireSecureStorageSession(state, allowedRoles = []) {
  const profile = secureStorageProfileFromState(state);
  if (!profile.enabled) throw new Error('O armazenamento privado ainda não foi configurado.');
  if (
    activeSession.workerUrl !== profile.workerUrl
    || !activeSession.token
    || activeSession.expiresAt <= Date.now()
  ) {
    throw new Error('A sessão segura expirou. Saia e entre novamente no painel.');
  }
  if (allowedRoles.length && !allowedRoles.includes(activeSession.role)) {
    throw new Error('Este perfil não possui permissão para executar esta operação.');
  }
  return { profile, token: activeSession.token, session: activeSession };
}
