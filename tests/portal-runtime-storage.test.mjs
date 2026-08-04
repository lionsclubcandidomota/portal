import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeMetadataStore } from '../assets/js/modules/portal-runtime/storage.js';
import { RUNTIME_STORAGE_KEYS } from '../assets/js/modules/portal-runtime/constants.js';

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    snapshot: () => Object.fromEntries(values)
  };
}

test('metadados corrompidos são ignorados sem interromper o portal', () => {
  const storage = createMemoryStorage({
    [RUNTIME_STORAGE_KEYS.pendingChanges]: '-4',
    [RUNTIME_STORAGE_KEYS.lastSync]: '{inválido',
    [RUNTIME_STORAGE_KEYS.syncedState]: '{inválido'
  });
  const metadata = createRuntimeMetadataStore(storage).read();

  assert.equal(metadata.pendingChanges, 0);
  assert.equal(metadata.lastSyncInfo, null);
  assert.equal(metadata.lastSyncedState, null);
});

test('grava contador, sincronização e estado sincronizado de forma centralizada', () => {
  const storage = createMemoryStorage();
  const store = createRuntimeMetadataStore(storage);

  store.writeSyncMeta({ pendingChanges: 3, lastSyncInfo: { sha: 'abc' } });
  store.writeSyncedState({ settings: { clubName: 'Lions' } });
  store.writeRemoteVersion('deploy-1');
  store.writeAwaitingDeployment('deploy-2');

  const metadata = store.read();
  assert.equal(metadata.pendingChanges, 3);
  assert.deepEqual(metadata.lastSyncInfo, { sha: 'abc' });
  assert.equal(metadata.lastSyncedState.settings.clubName, 'Lions');
  assert.deepEqual(metadata.lastSyncedState.treasury, []);
  assert.ok(metadata.lastSyncedState.treasuryCategories.includes('Mensalidades'));
  assert.equal(metadata.lastRemoteVersion, 'deploy-1');
  assert.equal(metadata.awaitingPublicDeploymentId, 'deploy-2');
});

test('remove metadados opcionais quando o valor é esvaziado', () => {
  const storage = createMemoryStorage();
  const store = createRuntimeMetadataStore(storage);

  store.writeSyncMeta({ pendingChanges: 0, lastSyncInfo: null });
  store.writeRemoteVersion('');
  store.writeAwaitingDeployment('');

  const snapshot = storage.snapshot();
  assert.equal(snapshot[RUNTIME_STORAGE_KEYS.pendingChanges], '0');
  assert.equal(RUNTIME_STORAGE_KEYS.lastSync in snapshot, false);
  assert.equal(RUNTIME_STORAGE_KEYS.remoteVersion in snapshot, false);
  assert.equal(RUNTIME_STORAGE_KEYS.awaitingDeployment in snapshot, false);
});
