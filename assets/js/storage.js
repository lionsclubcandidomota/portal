import {
  CURRENT_SCHEMA_VERSION,
  PortalSchemaError,
  createDefaultPortalState,
  createPortalEnvelope,
  migratePortalPayload
} from './core/portal-schema.js?v=6.26.0';

const STORAGE_KEY = 'lionsCandidoMota.dashboard.v1';

export const defaultState = createDefaultPortalState();

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
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
  const payload = createPortalEnvelope(state, {
    savedAt: new Date().toISOString()
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
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
