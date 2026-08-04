import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLoginFormState,
  resetSecretField
} from '../assets/js/modules/admin-dashboard/login-form-state.js';

function fakeClassList() {
  const values = new Set();
  return {
    toggle(name, active) {
      if (active) values.add(name);
      else values.delete(name);
    },
    has: name => values.has(name)
  };
}

function fakeElement(mode = '') {
  const attributes = new Map();
  return {
    dataset: { loginMode: mode },
    classList: fakeClassList(),
    hidden: false,
    disabled: false,
    tabIndex: 0,
    type: 'password',
    value: '',
    textContent: '',
    isConnected: true,
    focused: false,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name); },
    focus() { this.focused = true; }
  };
}

test('estado do login isola os formulários e limpa a senha da Diretoria', () => {
  const adminForm = fakeElement();
  const directorForm = fakeElement();
  const adminInput = fakeElement();
  const directorInput = fakeElement();
  const adminToggle = fakeElement();
  const directorToggle = fakeElement();
  const tabs = [fakeElement('admin'), fakeElement('director')];
  directorInput.value = 'credencial-antiga';
  directorInput.type = 'text';
  const scheduled = [];

  const state = createLoginFormState({
    adminForm,
    directorForm,
    adminInput,
    directorInput,
    adminToggle,
    directorToggle,
    tabs,
    scheduleFocus: callback => scheduled.push(callback)
  });

  state.activate('director');
  scheduled.shift()();

  assert.equal(adminForm.hidden, true);
  assert.equal(adminInput.disabled, true);
  assert.equal(directorForm.hidden, false);
  assert.equal(directorInput.disabled, false);
  assert.equal(directorInput.value, '');
  assert.equal(directorInput.type, 'password');
  assert.equal(directorInput.focused, true);
  assert.equal(tabs[1].classList.has('is-active'), true);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
});

test('limpeza de credencial restaura o controle de visibilidade', () => {
  const input = fakeElement();
  const toggle = fakeElement();
  input.value = 'segredo';
  input.type = 'text';

  resetSecretField(input, toggle, 'senha');

  assert.equal(input.value, '');
  assert.equal(input.type, 'password');
  assert.equal(toggle.textContent, 'Mostrar');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(toggle.getAttribute('aria-label'), 'Mostrar senha');
});
