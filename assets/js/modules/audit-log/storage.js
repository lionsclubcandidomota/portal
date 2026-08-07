import {
  AUDIT_LOG_SCHEMA_VERSION,
  normalizeAuditEntries
} from './domain.js?v=6.47.0';

export const AUDIT_LOG_STORAGE_KEY = 'lionsCandidoMota.audit.v1';

export function createAuditLogStore(storage) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new TypeError('createAuditLogStore requer uma implementação de Storage.');
  }

  const read = () => {
    try {
      const payload = JSON.parse(storage.getItem(AUDIT_LOG_STORAGE_KEY) || 'null');
      if (!payload) return [];
      return normalizeAuditEntries(Array.isArray(payload) ? payload : payload.entries);
    } catch {
      return [];
    }
  };

  const write = entries => {
    const normalized = normalizeAuditEntries(entries);
    storage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify({
      schemaVersion: AUDIT_LOG_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      entries: normalized
    }));
    return normalized;
  };

  return { read, write };
}
