import {
  readSecureStorageJson as readJson,
  requireSecureStorageSession as requireSession,
  secureStorageApiUrl as apiUrl,
  secureStorageJsonHeaders as jsonHeaders
} from './session-store.js?v=6.46.0';

function queryString(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    const normalized = String(value || '').trim();
    if (normalized) params.set(key, normalized);
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export async function loadD1DashboardAnalytics(state, bounds = {}) {
  const { profile, token } = requireSession(state, ['admin', 'director']);
  const response = await fetch(apiUrl(profile.workerUrl, `/api/analytics/dashboard${queryString({
    start: bounds.start,
    end: bounds.end
  })}`), {
    method: 'GET',
    headers: jsonHeaders(token),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível consultar os indicadores no D1');
}

export async function loadD1ReportState(state, type, bounds = {}) {
  const { profile, token } = requireSession(state, ['admin', 'director']);
  const response = await fetch(apiUrl(profile.workerUrl, `/api/analytics/report${queryString({
    type,
    start: bounds.start,
    end: bounds.end
  })}`), {
    method: 'GET',
    headers: jsonHeaders(token),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível consultar o relatório no D1');
}
