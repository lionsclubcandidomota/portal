import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortalRefreshController } from '../assets/js/modules/portal-refresh.js';

function createButton() {
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  const label = { textContent: 'Atualizar painel' };
  return {
    disabled: false,
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      }
    },
    querySelector(selector) {
      return selector === '[data-portal-refresh-label]' ? label : null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    label,
    classes,
    attributes,
    listeners
  };
}

function setup({ pending = 0, decision = 'cancel' } = {}) {
  let pendingChanges = pending;
  let refreshCalls = 0;
  let publishCalls = 0;
  let discardCalls = 0;
  const button = createButton();
  const controller = createPortalRefreshController({
    button,
    getPendingChanges: () => pendingChanges,
    requestPendingDecision: async () => decision,
    publishPendingChanges: async () => {
      publishCalls += 1;
      pendingChanges = 0;
      return { ok: true, reason: 'published' };
    },
    discardPendingChanges: async options => {
      discardCalls += 1;
      assert.deepEqual(options, { skipConfirmation: true });
      pendingChanges = 0;
      return { ok: true, reason: 'discarded' };
    },
    refreshPortal: async () => {
      refreshCalls += 1;
      return { ok: true, reason: 'refreshed' };
    },
    toast() {}
  });

  return {
    button,
    controller,
    get refreshCalls() { return refreshCalls; },
    get publishCalls() { return publishCalls; },
    get discardCalls() { return discardCalls; }
  };
}

test('atualização sem pendências recarrega o painel diretamente', async () => {
  const fixture = setup();
  const result = await fixture.controller.run();

  assert.deepEqual(result, { ok: true, reason: 'refreshed' });
  assert.equal(fixture.refreshCalls, 1);
  assert.equal(fixture.publishCalls, 0);
  assert.equal(fixture.discardCalls, 0);
  assert.equal(fixture.button.label.textContent, 'Atualizar painel');
});

test('opção publicar trata pendências antes de atualizar', async () => {
  const fixture = setup({ pending: 3, decision: 'primary' });
  const result = await fixture.controller.run();

  assert.deepEqual(result, { ok: true, reason: 'refreshed' });
  assert.equal(fixture.publishCalls, 1);
  assert.equal(fixture.discardCalls, 0);
  assert.equal(fixture.refreshCalls, 1);
});

test('opção descartar restaura a base sincronizada antes de atualizar', async () => {
  const fixture = setup({ pending: 2, decision: 'secondary' });
  const result = await fixture.controller.run();

  assert.deepEqual(result, { ok: true, reason: 'refreshed' });
  assert.equal(fixture.publishCalls, 0);
  assert.equal(fixture.discardCalls, 1);
  assert.equal(fixture.refreshCalls, 1);
});

test('cancelar mantém as pendências e não executa atualização', async () => {
  const fixture = setup({ pending: 1, decision: 'cancel' });
  const result = await fixture.controller.run();

  assert.deepEqual(result, { ok: false, reason: 'cancelled', pendingChanges: 1 });
  assert.equal(fixture.publishCalls, 0);
  assert.equal(fixture.discardCalls, 0);
  assert.equal(fixture.refreshCalls, 0);
});
