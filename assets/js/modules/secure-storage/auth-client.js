import { CURRENT_SCHEMA_VERSION } from '../../core/portal-schema.js?v=6.40.0';
import {
  clearSecureStorageSession,
  getActiveSecureStorageSession,
  normalizeSecureStorageWorkerUrl,
  readSecureStorageJson as readJson,
  requireSecureStorageSession as requireSession,
  secureStorageApiUrl as apiUrl,
  secureStorageJsonHeaders as jsonHeaders,
  secureStorageProfileFromState,
  setActiveSecureStorageSession
} from './session-store.js?v=6.40.0';

export async function testSecureStorageConnection(workerUrl) {
  const normalized = normalizeSecureStorageWorkerUrl(workerUrl);
  const response = await fetch(apiUrl(normalized, '/health'), {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível consultar o Cloudflare Worker');
  if (payload.status !== 'ok' || !String(payload.storage || '').startsWith('cloudflare-r2')) {
    throw new Error('O endereço respondeu, mas não corresponde ao Worker do Portal.');
  }
  return payload;
}

export async function getAuthenticationStatus(state) {
  const profile = secureStorageProfileFromState(state);
  if (!profile.enabled) {
    return { available: false, initialized: false, bootstrapRequired: false, passwordLogin: false };
  }
  const response = await fetch(apiUrl(profile.workerUrl, '/api/auth/status'), {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível consultar a autenticação do Portal');
}

export async function bootstrapAdministrator(state, credentials = {}) {
  const profile = secureStorageProfileFromState(state);
  if (!profile.enabled) throw new Error('O Cloudflare Worker ainda não está configurado no Portal.');
  const response = await fetch(apiUrl(profile.workerUrl, '/api/auth/bootstrap'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      setupKey: String(credentials.setupKey || ''),
      username: String(credentials.username || ''),
      displayName: String(credentials.displayName || ''),
      password: String(credentials.password || '')
    }),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível criar o primeiro Administrador');
}

export async function connectSecureStorageSession({ state, role, credential, username, password }) {
  const profile = secureStorageProfileFromState(state);
  if (!profile.enabled) {
    clearSecureStorageSession();
    return { enabled: false, role: '' };
  }

  if (String(role || '').toLowerCase() === 'director') {
    const iterations = Number(state?.settings?.accessProfiles?.director?.iterations || 0);
    if (iterations > 100000) {
      throw new Error('A senha da Diretoria usa uma configuração anterior. Entre como Administrador, defina-a novamente e publique a alteração.');
    }
  }

  const current = getActiveSecureStorageSession();
  const normalizedRole = String(role || '').toLowerCase();
  const previousRevision = current.workerUrl === profile.workerUrl && current.role === normalizedRole
    ? current.privateRevision
    : '';
  const body = normalizedRole === 'admin' && (username || password)
    ? { role: normalizedRole, username: String(username || ''), password: String(password || '') }
    : { role: normalizedRole, credential: String(credential || '') };

  const response = await fetch(apiUrl(profile.workerUrl, '/api/session'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível criar a sessão segura');
  const session = setActiveSecureStorageSession({
    workerUrl: profile.workerUrl,
    role: String(payload.role || role || ''),
    token: String(payload.token || ''),
    expiresAt: Date.parse(payload.expiresAt || '') || (Date.now() + 25 * 60_000),
    privateRevision: previousRevision,
    user: payload.user && typeof payload.user === 'object' ? { ...payload.user } : null,
    publication: payload.publication && typeof payload.publication === 'object'
      ? { ...payload.publication }
      : null
  });
  if (!session.token) throw new Error('O Worker não retornou uma sessão segura válida.');
  return {
    enabled: true,
    role: session.role,
    expiresAt: payload.expiresAt || '',
    user: session.user,
    publication: session.publication
  };
}

export async function logoutSecureStorageSession(state) {
  const profile = secureStorageProfileFromState(state);
  const session = getActiveSecureStorageSession();
  if (!profile.enabled || !session.token) {
    clearSecureStorageSession();
    return { revoked: false };
  }
  try {
    const response = await fetch(apiUrl(profile.workerUrl, '/api/session/logout'), {
      method: 'POST',
      headers: jsonHeaders(session.token),
      cache: 'no-store'
    });
    return await readJson(response, 'Não foi possível encerrar a sessão no Worker');
  } finally {
    clearSecureStorageSession();
  }
}

export async function publishPublicPortalState(state, publicState, options = {}) {
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/publication'), {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      state: publicState,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      expectedDataSha: String(options.expectedDataSha || ''),
      commitMessage: String(options.commitMessage || ''),
      mediaAssets: Array.isArray(options.mediaAssets) ? options.mediaAssets : [],
      deletedPaths: Array.isArray(options.deletedPaths) ? options.deletedPaths : []
    }),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível publicar o conteúdo público pelo Worker');
}

export async function listAdministratorUsers(state) {
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/auth/users'), {
    headers: jsonHeaders(token),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível consultar os usuários administrativos');
}

export async function createAdministratorUser(state, user) {
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/auth/users'), {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(user || {}),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível criar o usuário administrativo');
}

export async function updateAdministratorUser(state, userId, changes) {
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, `/api/auth/users/${encodeURIComponent(userId)}`), {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(changes || {}),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível atualizar o usuário administrativo');
}

export async function resetAdministratorPassword(state, userId, password, mustChangePassword = true) {
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, `/api/auth/users/${encodeURIComponent(userId)}/password`), {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ password: String(password || ''), mustChangePassword }),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível redefinir a senha do usuário');
}

export async function changeAdministratorPassword(state, currentPassword, newPassword) {
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/auth/password'), {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      currentPassword: String(currentPassword || ''),
      newPassword: String(newPassword || '')
    }),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível alterar a senha');
}
