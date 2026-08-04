import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_SCHEMA_VERSION,
} from '../assets/js/core/portal-schema.js';
import {
  loadState,
  parseImportFile,
  saveState
} from '../assets/js/storage.js';

const STORAGE_KEY = 'lionsCandidoMota.dashboard.v1';

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    snapshot: () => Object.fromEntries(values)
  };
}

test('loadState migra automaticamente o formato local antigo', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({ settings: { clubName: 'Local antigo' }, meetings: [] })
  });

  try {
    const state = loadState();
    assert.equal(state.settings.clubName, 'Local antigo');
    assert.deepEqual(state.treasury, []);
  } finally {
    globalThis.localStorage = previous;
  }
});

test('saveState grava localStorage com envelope formal atual', () => {
  const previous = globalThis.localStorage;
  const storage = createMemoryStorage();
  globalThis.localStorage = storage;

  try {
    saveState({ settings: { clubName: 'Novo formato', initialized: true } });
    const payload = JSON.parse(storage.snapshot()[STORAGE_KEY]);
    assert.equal(payload.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(payload.version, CURRENT_SCHEMA_VERSION);
    assert.equal(payload.data.settings.clubName, 'Novo formato');
    assert.ok(payload.savedAt);
  } finally {
    globalThis.localStorage = previous;
  }
});

test('parseImportFile aceita modelo v2 com coleções na raiz', async () => {
  const file = {
    text: async () => JSON.stringify({
      app: 'Lions',
      version: 2,
      data: { settings: { clubName: 'Importado' } },
      treasuryAccounts: [{ id: 'acc-importada' }]
    })
  };

  const state = await parseImportFile(file);
  assert.equal(state.settings.clubName, 'Importado');
  assert.equal(state.treasuryAccounts[0].id, 'acc-importada');
});

test('parseImportFile bloqueia backups criados por esquema futuro', async () => {
  const file = {
    text: async () => JSON.stringify({ schemaVersion: 12, data: {} })
  };

  await assert.rejects(
    parseImportFile(file),
    error => error?.code === 'UNSUPPORTED_FUTURE_SCHEMA'
  );
});
