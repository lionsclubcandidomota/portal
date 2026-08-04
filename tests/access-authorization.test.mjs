import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_CAPABILITIES,
  ACCESS_ROLES,
  accessSnapshot,
  applyAccessRole,
  canAccessView,
  clearAccessRole,
  roleHasCapability
} from '../assets/js/modules/portal-runtime/authorization.js';

test('matriz de autorização diferencia Visitante, Diretoria e Administrador', () => {
  assert.equal(roleHasCapability(ACCESS_ROLES.VISITOR, ACCESS_CAPABILITIES.VIEW_TREASURY), false);
  assert.equal(roleHasCapability(ACCESS_ROLES.DIRECTOR, ACCESS_CAPABILITIES.VIEW_TREASURY), true);
  assert.equal(roleHasCapability(ACCESS_ROLES.DIRECTOR, ACCESS_CAPABILITIES.WRITE_DATA), false);
  assert.equal(roleHasCapability(ACCESS_ROLES.ADMIN, ACCESS_CAPABILITIES.WRITE_DATA), true);
  assert.equal(roleHasCapability(ACCESS_ROLES.ADMIN, ACCESS_CAPABILITIES.MANAGE_ACCESS), true);
});

test('controle de rotas usa a mesma política central das ações', () => {
  assert.equal(canAccessView(ACCESS_ROLES.VISITOR, 'treasury'), false);
  assert.equal(canAccessView(ACCESS_ROLES.DIRECTOR, 'treasury'), true);
  assert.equal(canAccessView(ACCESS_ROLES.DIRECTOR, 'settings'), false);
  assert.equal(canAccessView(ACCESS_ROLES.ADMIN, 'settings'), true);
  assert.equal(canAccessView(ACCESS_ROLES.VISITOR, 'dashboard'), true);
});

test('transição de perfil mantém os campos legados de sessão sincronizados', () => {
  const model = {};

  applyAccessRole(model, ACCESS_ROLES.DIRECTOR);
  assert.deepEqual(accessSnapshot(model), {
    role: ACCESS_ROLES.DIRECTOR,
    authenticated: true,
    readOnly: true,
    canWrite: false,
    canRefresh: true,
    canViewTreasury: true,
    canViewSettings: false,
    canPublish: false,
    canDiscard: false,
    canManageAccess: false
  });
  assert.equal(model.adminUnlocked, true);
  assert.equal(model.canWrite, false);

  applyAccessRole(model, ACCESS_ROLES.ADMIN);
  assert.equal(model.adminUnlocked, true);
  assert.equal(model.canWrite, true);

  clearAccessRole(model);
  assert.equal(model.accessRole, ACCESS_ROLES.VISITOR);
  assert.equal(model.adminUnlocked, false);
  assert.equal(model.canWrite, false);
});
