import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortalRuntimeController } from '../assets/js/modules/portal-runtime.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('fachada do runtime preserva o contrato público usado pelo portal', () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  let state = { settings: {}, treasury: [], events: [], meetings: [] };

  try {
    const runtime = createPortalRuntimeController({
      getState: () => state,
      setState: value => { state = value; },
      applySettings() {},
      renderCurrentView() {}
    });

    [
      'applyRemotePayload',
      'bootstrap',
      'commitPendingChanges',
      'connectAdminSession',
      'connectDirectorSession',
      'discardPendingChanges',
      'getPendingPublicationReview',
      'importState',
      'isAdminUnlocked',
      'logoutAdmin',
      'persist',
      'refreshRemoteState',
      'refreshPortalInterface',
      'isRefreshingInterface'
    ].forEach(method => assert.equal(typeof runtime[method], 'function', method));

    assert.equal(runtime.adminUnlocked, false);
    assert.equal(runtime.githubToken, '');
    assert.equal(runtime.pendingChanges, 0);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
