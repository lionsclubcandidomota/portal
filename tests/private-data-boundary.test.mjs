import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPrivatePortalState,
  createPublicPortalState,
  hasPrivatePortalData,
  mergePublicAndPrivatePortalState
} from '../assets/js/core/portal-data-boundary.js';
import { createRuntimeMetadataStore } from '../assets/js/modules/portal-runtime/storage.js';
import { RUNTIME_STORAGE_KEYS } from '../assets/js/modules/portal-runtime/constants.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
}

function completeState() {
  return {
    settings: {
      clubName: 'Lions',
      logo: './public/logo.png',
      membershipMonthlyFee: 100,
      membershipFamilyPrimaryFee: 90,
      membershipFamilyAdditionalFee: 50,
      secureStorage: { enabled: true, workerUrl: 'https://portal.example.workers.dev' },
      accessProfiles: {
        director: {
          version: 2,
          credentialType: 'password',
          enabled: true,
          label: 'Diretoria',
          salt: 'a'.repeat(32),
          passwordHash: 'b'.repeat(64),
          iterations: 100000,
          configuredAt: '2026-08-04T12:00:00.000Z',
          configuredBy: 'admin'
        }
      }
    },
    birthdays: [{ id: 'b1', name: 'Associado' }],
    treasuryAccounts: [{ id: 'acc1', name: 'Conta', initialBalance: 100 }],
    treasuryCategories: ['Mensalidades'],
    familyGroups: [{ id: 'fg1', name: 'Família' }],
    mutualGroups: [{ id: 'mg1', name: 'Mútua' }],
    treasury: [{ id: 't1', description: 'Pagamento', entry: 100, exit: 0 }],
    events: [{ id: 'e1', name: 'Evento' }],
    meetings: [],
    notices: [{ id: 'n1', title: 'Aviso' }]
  };
}

test('estado público remove finanças e credenciais sem afetar agenda e identidade', () => {
  const publicState = createPublicPortalState(completeState());

  assert.deepEqual(publicState.treasury, []);
  assert.deepEqual(publicState.treasuryAccounts, []);
  assert.deepEqual(publicState.familyGroups, []);
  assert.deepEqual(publicState.mutualGroups, []);
  assert.equal(publicState.settings.membershipMonthlyFee, undefined);
  assert.equal(publicState.settings.accessProfiles.director.enabled, true);
  assert.equal(publicState.settings.accessProfiles.director.passwordHash, undefined);
  assert.equal(publicState.settings.accessProfiles.director.salt, undefined);
  assert.equal(publicState.settings.secureStorage.enabled, true);
  assert.equal(publicState.events[0].name, 'Evento');
  assert.equal(publicState.notices[0].title, 'Aviso');
});

test('estado privado é recomposto após autenticação', () => {
  const full = completeState();
  const publicState = createPublicPortalState(full);
  const privateState = createPrivatePortalState(full);
  const merged = mergePublicAndPrivatePortalState(publicState, privateState);

  assert.equal(privateState.treasury.length, 1);
  assert.equal(privateState.settings.accessProfiles.director.passwordHash, 'b'.repeat(64));
  assert.equal(merged.treasury[0].description, 'Pagamento');
  assert.equal(merged.treasuryAccounts[0].name, 'Conta');
  assert.equal(merged.settings.membershipMonthlyFee, 100);
  assert.equal(merged.events[0].name, 'Evento');
  assert.equal(hasPrivatePortalData(merged), true);
  assert.equal(hasPrivatePortalData(publicState), false);
});

test('metadados persistem estado completo na sessão e somente cópia pública no armazenamento permanente', () => {
  const permanent = memoryStorage();
  const session = memoryStorage();
  const store = createRuntimeMetadataStore(permanent, session);

  store.writeSyncedState(completeState());

  const permanentPayload = JSON.parse(permanent.getItem(RUNTIME_STORAGE_KEYS.syncedState));
  const sessionPayload = JSON.parse(session.getItem(RUNTIME_STORAGE_KEYS.syncedState));
  assert.deepEqual(permanentPayload.data.treasury, []);
  assert.equal(permanentPayload.data.settings.accessProfiles.director.passwordHash, undefined);
  assert.equal(sessionPayload.data.treasury.length, 1);
  assert.equal(sessionPayload.data.settings.accessProfiles.director.passwordHash, 'b'.repeat(64));

  store.clearPrivateState();
  assert.equal(session.getItem(RUNTIME_STORAGE_KEYS.syncedState), null);
});
