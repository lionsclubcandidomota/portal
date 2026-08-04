import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditEntry } from '../assets/js/modules/audit-log/domain.js';
import {
  AUDIT_LOG_STORAGE_KEY,
  createAuditLogStore
} from '../assets/js/modules/audit-log/storage.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values
  };
}

const review = {
  groups: [{
    title: 'Avisos',
    changes: [{ type: 'added', title: 'Novo aviso', fields: [] }]
  }]
};

test('ignora histórico corrompido e inicia com lista vazia', () => {
  const storage = memoryStorage({ [AUDIT_LOG_STORAGE_KEY]: '{json inválido' });
  const store = createAuditLogStore(storage);
  assert.deepEqual(store.read(), []);
});

test('grava envelope versionado e recupera as operações', () => {
  const storage = memoryStorage();
  const store = createAuditLogStore(storage);
  const entry = createAuditEntry({ id: 'c1', batchId: 'b1', review });

  store.write([entry]);
  const payload = JSON.parse(storage.getItem(AUDIT_LOG_STORAGE_KEY));

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.entries.length, 1);
  assert.equal(store.read()[0].id, 'c1');
});
