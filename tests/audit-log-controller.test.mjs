import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditLogController } from '../assets/js/modules/audit-log/controller.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function modalStub() {
  return {
    body: { querySelector() { return null; } },
    open() { return this.body; },
    setContent() { return this.body; }
  };
}

test('controlador registra alterações, identifica o administrador e fecha o lote', () => {
  const controller = createAuditLogController({
    storage: memoryStorage(),
    modalController: modalStub()
  });
  controller.setActor({ login: 'joao', name: 'João' });

  const previousState = {
    settings: {}, birthdays: [], treasuryAccounts: [], treasuryCategories: [], familyGroups: [],
    treasury: [], events: [], meetings: [], notices: []
  };
  const currentState = {
    ...previousState,
    notices: [{ id: 'n1', title: 'Comunicado', date: '2026-07-30', priority: 'Alta', text: 'Teste' }]
  };

  const result = controller.recordChange({
    message: 'Aviso criado.',
    previousState,
    currentState
  });

  assert.ok(result.batchId);
  assert.equal(controller.getEntries().length, 1);
  assert.equal(controller.getEntries()[0].actor.name, 'João');
  assert.equal(controller.getSummary().pendingBatches, 1);

  controller.closeBatch(result.batchId, 'discarded', 'Teste');
  assert.equal(controller.getSummary().pendingBatches, 0);
  assert.equal(controller.getSummary().discardedBatches, 1);
});
