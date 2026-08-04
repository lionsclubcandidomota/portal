import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryCenterController } from '../assets/js/modules/recovery-center/controller.js';
import { createMemoryRecoveryStore } from '../assets/js/modules/recovery-center/storage.js';

function state() {
  return {
    settings: { clubName: 'Lions', initialized: true, logo: './public/logo.png' },
    birthdays: [], treasuryAccounts: [], treasuryCategories: [], familyGroups: [],
    treasury: [], events: [], meetings: [], notices: []
  };
}

function emptyBody() {
  return {
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function modalStub() {
  return {
    open() { return emptyBody(); },
    setContent() { return emptyBody(); },
    close() {}
  };
}

test('controlador cria ponto manual e expõe resumo atualizado', async () => {
  const messages = [];
  const controller = createRecoveryCenterController({
    getState: state,
    modalController: modalStub(),
    onRestore: async () => {},
    toast: message => messages.push(message),
    storeFactory: async () => createMemoryRecoveryStore(),
    storageEstimate: async () => null
  });

  await controller.initialize();
  await controller.createSnapshot({ reason: 'manual' });

  assert.equal(controller.getSummary().snapshots, 1);
  assert.equal(controller.getSummary().diagnosticStatus, 'ok');
  assert.equal(messages.at(-1), 'Ponto de recuperação criado com sucesso.');
});

test('backup automático deduplica estado idêntico para o mesmo motivo', async () => {
  const controller = createRecoveryCenterController({
    getState: state,
    modalController: modalStub(),
    onRestore: async () => {},
    storeFactory: async () => createMemoryRecoveryStore(),
    storageEstimate: async () => null
  });

  await controller.createAutomaticSnapshot({ reason: 'before-publication' });
  await controller.createAutomaticSnapshot({ reason: 'before-publication' });

  assert.equal(controller.getSummary().snapshots, 1);
});
