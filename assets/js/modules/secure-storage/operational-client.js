import {
  readSecureStorageJson as readJson,
  requireSecureStorageSession as requireSession,
  secureStorageApiUrl as apiUrl,
  secureStorageJsonHeaders as jsonHeaders
} from './session-store.js?v=6.47.0';

function queryString(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    const normalized = String(value ?? '').trim();
    if (normalized) params.set(key, normalized);
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export async function loadD1OperationalTreasury(state, options = {}) {
  const { profile, token } = requireSession(state, ['admin', 'director']);
  const response = await fetch(apiUrl(profile.workerUrl, `/api/operational/treasury${queryString({
    start: options.start,
    end: options.end,
    query: options.query,
    filter: options.filter || 'all',
    scheduledPage: options.scheduledPage || 1,
    completedPage: options.completedPage || 1,
    pageSize: options.pageSize || 8
  })}`), {
    method: 'GET',
    headers: jsonHeaders(token),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível consultar as movimentações no D1');
}
