import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoverySnapshot } from '../assets/js/modules/recovery-center/domain.js';
import { createMemoryRecoveryStore, createRecoverySnapshotStore } from '../assets/js/modules/recovery-center/storage.js';

function state(name = 'Lions') {
  return {
    settings: { clubName: name, initialized: true },
    birthdays: [], treasuryAccounts: [], treasuryCategories: [], familyGroups: [],
    treasury: [], events: [], meetings: [], notices: []
  };
}

function localStorageStub() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('armazenamento em memória lista, lê e remove pontos', async () => {
  const store = createMemoryRecoveryStore();
  const snapshot = createRecoverySnapshot({ state: state() });
  await store.put(snapshot);

  assert.equal((await store.list()).length, 1);
  assert.equal((await store.get(snapshot.id)).checksum, snapshot.checksum);

  await store.remove(snapshot.id);
  assert.equal((await store.list()).length, 0);
});

test('armazenamento em memória respeita retenção máxima', async () => {
  const store = createMemoryRecoveryStore([], 2);
  for (let index = 0; index < 3; index += 1) {
    await store.put(createRecoverySnapshot({
      state: state(String(index)),
      now: () => new Date(`2026-07-30T21:0${index}:00.000Z`)
    }));
  }
  assert.equal((await store.list()).length, 2);
});

test('fallback local funciona quando IndexedDB não está disponível', async () => {
  const store = await createRecoverySnapshotStore({
    indexedDB: null,
    fallbackStorage: localStorageStub(),
    maximum: 4
  });
  const snapshot = createRecoverySnapshot({ state: state() });
  await store.put(snapshot);

  assert.equal(store.mode, 'localstorage');
  assert.equal((await store.list())[0].id, snapshot.id);
});
