import {
  readSecureStorageJson as readJson,
  requireSecureStorageSession as requireSession,
  secureStorageApiUrl as apiUrl,
  secureStorageJsonHeaders as jsonHeaders,
  setSecureStoragePrivateRevision
} from './session-store.js?v=6.47.2';

async function loadModule(state, path, errorMessage) {
  const { profile, token } = requireSession(state, ['admin', 'director']);
  const response = await fetch(apiUrl(profile.workerUrl, path), {
    method: 'GET',
    headers: jsonHeaders(token),
    cache: 'no-store'
  });
  return readJson(response, errorMessage);
}

export async function loadD1ModuleRevisions(state) {
  const payload = await loadModule(
    state,
    '/api/sync/revisions',
    'Não foi possível verificar as atualizações do banco'
  );
  if (payload.revision) setSecureStoragePrivateRevision(payload.revision);
  return {
    revision: String(payload.revision || ''),
    updatedAt: String(payload.updatedAt || ''),
    generatedAt: String(payload.generatedAt || ''),
    modules: payload.modules && typeof payload.modules === 'object' ? payload.modules : {}
  };
}

export async function loadD1ReferenceModule(state) {
  const payload = await loadModule(
    state,
    '/api/operational/reference',
    'Não foi possível atualizar contas, categorias e configurações'
  );
  return {
    source: String(payload.source || ''),
    module: 'reference',
    revision: Math.max(0, Number(payload.revision || 0)),
    updatedAt: String(payload.updatedAt || ''),
    state: payload.state && typeof payload.state === 'object' ? payload.state : {}
  };
}

export async function loadD1GroupsModule(state) {
  const payload = await loadModule(
    state,
    '/api/operational/groups',
    'Não foi possível atualizar os grupos do banco'
  );
  return {
    source: String(payload.source || ''),
    module: 'groups',
    revision: Math.max(0, Number(payload.revision || 0)),
    updatedAt: String(payload.updatedAt || ''),
    state: payload.state && typeof payload.state === 'object' ? payload.state : {}
  };
}
