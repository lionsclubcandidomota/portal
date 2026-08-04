import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDialogFocusManager,
  getFocusableElements
} from '../assets/js/modules/dialog-focus.js';

function createFocusable(name, documentRef, attributes = {}) {
  return {
    name,
    disabled: false,
    hidden: false,
    isConnected: true,
    focus() {
      documentRef.activeElement = this;
    },
    getAttribute(key) {
      return attributes[key] ?? null;
    }
  };
}

function createFixture() {
  const documentRef = { activeElement: null };
  const outside = createFocusable('outside', documentRef);
  const first = createFocusable('first', documentRef);
  const last = createFocusable('last', documentRef);
  const listeners = new Map();
  const dialog = {
    ownerDocument: documentRef,
    focus() {
      documentRef.activeElement = this;
    },
    querySelectorAll() {
      return [first, last];
    },
    querySelector() {
      return null;
    },
    contains(element) {
      return element === this || element === first || element === last;
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    }
  };
  return { dialog, documentRef, first, last, outside, listeners };
}

test('lista de foco ignora controles desabilitados ou ocultos', () => {
  const fixture = createFixture();
  fixture.last.disabled = true;
  assert.deepEqual(getFocusableElements(fixture.dialog), [fixture.first]);
});

test('gerenciador leva o foco para o diálogo e restaura o elemento anterior', () => {
  const fixture = createFixture();
  fixture.documentRef.activeElement = fixture.outside;
  const manager = createDialogFocusManager({ dialog: fixture.dialog });

  manager.activate(fixture.first);
  assert.equal(fixture.documentRef.activeElement, fixture.first);
  manager.deactivate();
  assert.equal(fixture.documentRef.activeElement, fixture.outside);
});

test('Tab e Shift+Tab permanecem dentro do diálogo', () => {
  const fixture = createFixture();
  fixture.documentRef.activeElement = fixture.outside;
  const manager = createDialogFocusManager({ dialog: fixture.dialog });
  manager.activate(fixture.first);

  fixture.documentRef.activeElement = fixture.last;
  let prevented = false;
  manager.handleKeydown({
    key: 'Tab',
    shiftKey: false,
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(fixture.documentRef.activeElement, fixture.first);

  fixture.documentRef.activeElement = fixture.first;
  prevented = false;
  manager.handleKeydown({
    key: 'Tab',
    shiftKey: true,
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(fixture.documentRef.activeElement, fixture.last);
});
