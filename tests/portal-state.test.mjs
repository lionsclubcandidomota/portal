import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloneState,
  createSeedState,
  normalizeTreasuryStatuses,
  sanitizePortalState,
  statesAreEquivalent
} from '../assets/js/core/portal-state.js';

test('normaliza status realizados conforme entrada ou saída', () => {
  const state = {
    treasury: [
      { status: 'Realizado', entry: 100, exit: 0 },
      { status: 'realizado', entry: 0, exit: 50 }
    ]
  };

  normalizeTreasuryStatuses(state, new Date(2026, 6, 30));
  assert.equal(state.treasury[0].status, 'Recebido');
  assert.equal(state.treasury[1].status, 'Pago');
});

test('diferencia lançamentos programados vencidos e futuros', () => {
  const state = {
    treasury: [
      { status: 'Pendente', date: '2026-07-29' },
      { status: 'Agendado', date: '2026-07-31' }
    ]
  };

  normalizeTreasuryStatuses(state, new Date(2026, 6, 30));
  assert.equal(state.treasury[0].status, 'Vencida');
  assert.equal(state.treasury[1].status, 'Programado');
});

test('comparação ignora metadados transitórios e ordem das propriedades', () => {
  const first = { name: 'Lions', updatedAt: 'antes', nested: { b: 2, a: 1 } };
  const second = { nested: { a: 1, b: 2 }, deploymentId: 'novo', name: 'Lions' };
  assert.equal(statesAreEquivalent(first, second), true);
});

test('sanitização remove responsáveis internos sem alterar outros campos', () => {
  const state = {
    events: [{ id: 'e1', name: 'Evento', responsible: 'Interno' }],
    meetings: [{ id: 'm1', theme: 'Reunião', responsible: 'Interno' }],
    treasury: []
  };

  sanitizePortalState(state, new Date(2026, 6, 30));
  assert.deepEqual(state.events, [{ id: 'e1', name: 'Evento' }]);
  assert.deepEqual(state.meetings, [{ id: 'm1', theme: 'Reunião' }]);
});

test('cloneState gera uma cópia independente', () => {
  const original = { nested: { value: 1 } };
  const copy = cloneState(original);
  copy.nested.value = 2;
  assert.equal(original.nested.value, 1);
});

test('dados iniciais são criados uma única vez', () => {
  const state = { settings: {} };
  const created = createSeedState(state, new Date(2026, 6, 30));
  assert.equal(created, true);
  assert.equal(state.settings.initialized, true);
  assert.ok(state.treasury.length > 0);
  assert.equal(createSeedState(state, new Date(2026, 6, 30)), false);
});
