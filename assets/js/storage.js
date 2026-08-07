import {
  CURRENT_SCHEMA_VERSION,
  PortalSchemaError,
  createDefaultPortalState,
  createPortalEnvelope,
  migratePortalPayload
} from './core/portal-schema.js?v=6.41.0';
import { createPublicPortalState } from './core/portal-data-boundary.js?v=6.41.0';

const STORAGE_KEY = 'lionsCandidoMota.dashboard.v1';
const SESSION_STORAGE_KEY = 'lionsCandidoMota.dashboard.privateSession.v1';

export const defaultState = createDefaultPortalState();

export function loadState() {
  const raw = globalThis.sessionStorage?.getItem?.(SESSION_STORAGE_KEY)
    || globalThis.localStorage?.getItem?.(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);

  try {
    return migratePortalPayload(JSON.parse(raw)).state;
  } catch (error) {
    console.error('Falha ao carregar dados locais:', error);
    if (error instanceof PortalSchemaError && error.code === 'UNSUPPORTED_FUTURE_SCHEMA') {
      throw error;
    }
    return structuredClone(defaultState);
  }
}

export function saveState(state) {
  const savedAt = new Date().toISOString();
  const privatePayload = createPortalEnvelope(state, { savedAt, audience: 'authenticated-session' });
  const publicPayload = createPortalEnvelope(createPublicPortalState(state), { savedAt, audience: 'public-cache' });
  globalThis.sessionStorage?.setItem?.(SESSION_STORAGE_KEY, JSON.stringify(privatePayload));
  globalThis.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(publicPayload));
}

export function clearState() {
  globalThis.localStorage?.removeItem?.(STORAGE_KEY);
  globalThis.sessionStorage?.removeItem?.(SESSION_STORAGE_KEY);
}

export function exportState(state) {
  const payload = createPortalEnvelope(state, {
    exportedAt: new Date().toISOString()
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `backup-lions-${new Date().toISOString().slice(0,10)}-schema-v${CURRENT_SCHEMA_VERSION}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function parseImportFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Arquivo JSON inválido ou incompleto.');
  }

  return migratePortalPayload(parsed).state;
}
