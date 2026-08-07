import {
  readSecureStorageJson as readJson,
  requireSecureStorageSession as requireSession,
  secureStorageApiUrl as apiUrl,
  secureStorageJsonHeaders as jsonHeaders
} from './session-store.js?v=6.45.0';

function queryString(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    const normalized = String(value ?? '').trim();
    if (normalized) params.set(key, normalized);
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function loadOperational(state, path, options, errorMessage) {
  const { profile, token } = requireSession(state, ['admin', 'director']);
  const response = await fetch(apiUrl(profile.workerUrl, `${path}${queryString(options)}`), {
    method: 'GET',
    headers: jsonHeaders(token),
    cache: 'no-store'
  });
  return readJson(response, errorMessage);
}

export function loadD1OperationalMemberships(state, options = {}) {
  return loadOperational(state, '/api/operational/memberships', {
    start: options.start,
    end: options.end,
    query: options.query,
    family: options.family || 'all',
    status: options.status || 'all',
    page: options.page || 1,
    pageSize: options.pageSize || 12
  }, 'Não foi possível consultar as mensalidades no D1');
}

export function loadD1OperationalMutuals(state, options = {}) {
  return loadOperational(state, '/api/operational/mutuals', {
    group: options.group || 'all',
    start: options.start,
    end: options.end,
    query: options.query,
    status: options.status || 'pending',
    page: options.page || 1,
    pageSize: options.pageSize || 5
  }, 'Não foi possível consultar as Mútuas no D1');
}
