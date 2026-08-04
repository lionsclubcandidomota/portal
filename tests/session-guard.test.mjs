import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_SESSION_IDLE_TIMEOUT_MS,
  createAdminSessionGuard
} from '../assets/js/modules/portal-runtime/session-guard.js';

function createEnvironment() {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;

  const browserWindow = {
    addEventListener(type, handler) { windowListeners.set(type, handler); },
    removeEventListener(type) { windowListeners.delete(type); },
    setTimeout(handler, timeout) {
      const id = nextTimerId++;
      timers.set(id, { handler, timeout });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  const browserDocument = {
    hidden: false,
    addEventListener(type, handler) { documentListeners.set(type, handler); },
    removeEventListener(type) { documentListeners.delete(type); }
  };

  return { browserWindow, browserDocument, windowListeners, documentListeners, timers };
}

test('guarda inicia com limite de 30 minutos e renova após atividade', () => {
  const env = createEnvironment();
  const guard = createAdminSessionGuard({
    window: env.browserWindow,
    document: env.browserDocument
  });

  guard.start();
  assert.equal(guard.status().active, true);
  assert.equal(guard.status().timeoutMs, ADMIN_SESSION_IDLE_TIMEOUT_MS);
  assert.equal(env.timers.size, 1);
  assert.equal([...env.timers.values()][0].timeout, ADMIN_SESSION_IDLE_TIMEOUT_MS);

  const firstTimerId = [...env.timers.keys()][0];
  env.windowListeners.get('keydown')();
  assert.equal(env.timers.has(firstTimerId), false);
  assert.equal(env.timers.size, 1);
});

test('guarda bloqueia a sessão quando o temporizador expira', () => {
  const env = createEnvironment();
  let timedOut = 0;
  const guard = createAdminSessionGuard({
    window: env.browserWindow,
    document: env.browserDocument,
    timeoutMs: 1000,
    onTimeout: () => { timedOut += 1; }
  });

  guard.start();
  const timer = [...env.timers.values()][0];
  timer.handler();

  assert.equal(timedOut, 1);
  assert.equal(guard.status().active, false);
  assert.equal(env.windowListeners.size, 0);
  assert.equal(env.documentListeners.size, 0);
});

test('stop remove listeners e cancela o bloqueio agendado', () => {
  const env = createEnvironment();
  const guard = createAdminSessionGuard({
    window: env.browserWindow,
    document: env.browserDocument
  });

  guard.start();
  guard.stop();
  assert.equal(guard.status().active, false);
  assert.equal(env.timers.size, 0);
  assert.equal(env.windowListeners.size, 0);
});
