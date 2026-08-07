import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  ACCESS_ROLES,
  accessSnapshot,
  applyAccessRole,
  canAccessView,
  clearAccessRole
} from '../assets/js/modules/portal-runtime/authorization.js';
import { createLoginFormState } from '../assets/js/modules/admin-dashboard/login-form-state.js';
import {
  entityFormHtml,
  normalizeExternalUrl,
  normalizeLocationData
} from '../assets/js/modules/entity-forms/templates.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name); },
    focus() {}
  };
}

test('templates de cadastros permanecem isolados do controlador de entidades', async () => {
  assert.equal(normalizeExternalUrl('www.example.com'), 'https://www.example.com/');
  assert.equal(normalizeLocationData({ locationType: 'physical', location: 'Sede' }).location, 'Sede');
  assert.match(entityFormHtml('birthday'), /id="entityForm"/);

  const controller = await readFile(path.join(projectRoot, 'assets/js/modules/entity-forms.js'), 'utf8');
  const templates = await readFile(path.join(projectRoot, 'assets/js/modules/entity-forms/templates.js'), 'utf8');
  assert.ok(controller.split(/\r?\n/).length < 380);
  assert.match(controller, /entity-forms\/templates\.js/);
  assert.match(templates, /export function entityFormHtml/);
});

test('renderização das páginas está separada do bootstrap principal', async () => {
  const app = await readFile(path.join(projectRoot, 'assets/js/modules/portal-app.js'), 'utf8');
  const renderer = await readFile(path.join(projectRoot, 'assets/js/modules/portal-view-renderer.js'), 'utf8');

  assert.ok(app.split(/\r?\n/).length < 500);
  assert.match(app, /createPortalViewRenderer/);
  assert.doesNotMatch(app, /function renderDashboardView/);
  assert.match(renderer, /function renderTreasuryView/);
  assert.match(renderer, /function renderAgendaView/);
});

test('sequência Visitante → Diretoria → Administrador → Visitante não preserva privilégios antigos', () => {
  const model = {};

  clearAccessRole(model);
  assert.equal(canAccessView(model.accessRole, 'treasury'), false);

  applyAccessRole(model, ACCESS_ROLES.DIRECTOR);
  assert.deepEqual(accessSnapshot(model), {
    role: 'director', authenticated: true, readOnly: true, canWrite: false,
    canRefresh: true, canViewTreasury: true, canViewSettings: false,
    canPublish: false, canDiscard: false, canManageAccess: false
  });

  applyAccessRole(model, ACCESS_ROLES.ADMIN);
  assert.equal(accessSnapshot(model).canViewSettings, true);
  assert.equal(accessSnapshot(model).canPublish, true);

  clearAccessRole(model);
  const visitor = accessSnapshot(model);
  assert.equal(visitor.authenticated, false);
  assert.equal(visitor.canWrite, false);
  assert.equal(visitor.canViewTreasury, false);
  assert.equal(visitor.canViewSettings, false);
});

test('alternância repetida dos formulários mantém somente um perfil ativo', () => {
  const adminForm = fakeElement();
  const directorForm = fakeElement();
  const adminInput = fakeElement();
  const directorInput = fakeElement();
  const adminToggle = fakeElement();
  const directorToggle = fakeElement();
  const tabs = [fakeElement('admin'), fakeElement('director')];
  const state = createLoginFormState({
    adminForm,
    directorForm,
    adminInput,
    directorInput,
    adminToggle,
    directorToggle,
    tabs,
    scheduleFocus: callback => callback()
  });

  directorInput.value = 'senha-anterior';
  state.activate('director');
  assert.equal(adminForm.hidden, true);
  assert.equal(directorForm.hidden, false);
  assert.equal(directorInput.value, '');

  state.activate('admin');
  assert.equal(adminForm.hidden, false);
  assert.equal(directorForm.hidden, true);
  assert.equal(adminInput.disabled, false);
  assert.equal(directorInput.disabled, true);
  assert.equal(tabs[0].classList.has('is-active'), true);
});
