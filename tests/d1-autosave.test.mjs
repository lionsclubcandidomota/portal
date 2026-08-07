import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortalRuntimeContext } from '../assets/js/modules/portal-runtime/context.js';
import { createPersistenceActions } from '../assets/js/modules/portal-runtime/persistence.js';
import { createPrivateSyncActions } from '../assets/js/modules/portal-runtime/private-sync.js';
import {
  createPrivatePortalState,
  createPublicPortalState,
  mergePublicAndPrivatePortalState
} from '../assets/js/core/portal-data-boundary.js';

function clone(value) {
  return structuredClone(value);
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function baseState() {
  return {
    settings: {
      clubName: 'Lions Clube',
      secureStorage: {
        enabled: true,
        workerUrl: 'https://lions-portal-anexos.example.workers.dev'
      }
    },
    birthdays: [],
    events: [],
    meetings: [],
    notices: [],
    treasuryAccounts: [],
    treasuryCategories: [],
    familyGroups: [],
    mutualGroups: [],
    treasury: []
  };
}

function setup(initialState = baseState(), serviceOverrides = {}) {
  let currentState = clone(initialState);
  let persistedState = clone(initialState);
  const calls = [];
  const services = {
    loadState: () => clone(persistedState),
    saveState: value => { persistedState = clone(value); },
    createPrivatePortalState,
    createPublicPortalState,
    mergePublicAndPrivatePortalState,
    secureStorageProfileFromState: state => ({
      enabled: Boolean(state?.settings?.secureStorage?.enabled),
      workerUrl: state?.settings?.secureStorage?.workerUrl || ''
    }),
    ...serviceOverrides
  };
  const context = createPortalRuntimeContext({
    getState: () => currentState,
    setState: value => { currentState = value; },
    applySettings: () => calls.push('settings'),
    renderCurrentView: () => calls.push('render'),
    openPublishCenter: options => calls.push(['publish-center', options]),
    setPublishStatus: status => calls.push(['publish-status', status]),
    setDatabaseSyncStatus: (status, message) => calls.push(['database-status', status, message]),
    toast: payload => calls.push(['toast', payload])
  }, services, {
    storage: memoryStorage(),
    sessionStorage: memoryStorage(),
    window: { addEventListener() {}, location: { href: 'https://portal.example/' } },
    document: { baseURI: 'https://portal.example/' },
    requestAnimationFrame: callback => callback()
  });
  context.model.adminUnlocked = true;
  context.model.accessRole = 'admin';
  context.model.canWrite = true;
  context.model.githubToken = 'token-admin';
  context.storeSyncedState(initialState);
  return {
    calls,
    context,
    getState: () => currentState,
    services
  };
}

test('alteração exclusivamente privada é agendada para o banco sem criar publicação pública', () => {
  const fixture = setup();
  const scheduled = [];
  const persistence = createPersistenceActions(fixture.context, {
    schedule: options => {
      scheduled.push(options);
      return { scheduled: true };
    }
  });

  fixture.getState().treasury.push({
    id: 'mov-1',
    description: 'Receita privada',
    entry: 100,
    exit: 0,
    status: 'completed'
  });
  const result = persistence.persist('Movimentação criada.');

  assert.equal(result.privateChanged, true);
  assert.equal(result.publicChanged, false);
  assert.equal(fixture.context.model.pendingChanges, 0);
  assert.equal(scheduled.length, 1);
  assert.equal(fixture.calls.some(call => call[0] === 'publish-center'), false);
});

test('alteração exclusivamente pública continua pendente para publicação no GitHub', () => {
  const fixture = setup();
  let privateSchedules = 0;
  const persistence = createPersistenceActions(fixture.context, {
    schedule: () => { privateSchedules += 1; }
  });

  fixture.getState().notices.push({ id: 'aviso-1', title: 'Reunião pública' });
  const result = persistence.persist('Aviso criado.');

  assert.equal(result.publicChanged, true);
  assert.equal(result.privateChanged, false);
  assert.equal(fixture.context.model.pendingChanges, 1);
  assert.equal(privateSchedules, 0);
  assert.equal(fixture.calls.some(call => call[0] === 'publish-center'), true);
});

test('alteração mista salva a parte privada e mantém somente a parte pública pendente', () => {
  const fixture = setup();
  let privateSchedules = 0;
  const persistence = createPersistenceActions(fixture.context, {
    schedule: () => {
      privateSchedules += 1;
      return { scheduled: true };
    }
  });

  fixture.getState().notices.push({ id: 'aviso-2', title: 'Campanha' });
  fixture.getState().treasury.push({ id: 'mov-2', description: 'Despesa', entry: 0, exit: 25 });
  const result = persistence.persist('Alteração mista.');

  assert.equal(result.publicChanged, true);
  assert.equal(result.privateChanged, true);
  assert.equal(privateSchedules, 1);
  assert.equal(fixture.context.model.pendingChanges, 1);
});

test('fila privada grava automaticamente no backend ativo e confirma a sincronização', async () => {
  let privateWrites = 0;
  const fixture = setup(baseState(), {
    hasActiveSecureStorageSession: () => true,
    collectSecureTreasuryObjectKeys: () => new Set(),
    prepareSecureTreasuryAttachmentsForPublication: async state => ({
      state: clone(state),
      convertedCount: 0,
      deletedPublicPaths: [],
      uploadedObjectKeys: []
    }),
    savePrivatePortalState: async state => {
      privateWrites += 1;
      return { revision: `rev-${privateWrites}`, backend: 'd1', state };
    },
    deleteSecureTreasuryObjects: async () => ({ deleted: 0 })
  });
  fixture.getState().treasury.push({ id: 'mov-3', description: 'Gravação D1', entry: 50, exit: 0 });
  const privateSync = createPrivateSyncActions(fixture.context);

  privateSync.schedule({ message: 'Salvar movimentação.' });
  const result = await privateSync.flush();

  assert.equal(result.ok, true);
  assert.equal(privateWrites, 1);
  assert.equal(fixture.context.model.privateSavePending, 0);
  assert.equal(fixture.context.model.privateSaveStatus, 'saved');
  assert.ok(fixture.calls.some(call => call[0] === 'database-status' && call[1] === 'saving'));
  assert.ok(fixture.calls.some(call => call[0] === 'database-status' && call[1] === 'saved'));
});
