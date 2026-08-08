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


test('rotas restritas aceitam o snapshot usado pela navegação após o login', () => {
  const model = {};
  applyAccessRole(model, ACCESS_ROLES.ADMIN);
  const snapshot = accessSnapshot(model);

  assert.equal(canAccessView(snapshot, 'treasury'), true);
  assert.equal(canAccessView(snapshot, 'settings'), true);
  assert.equal(canAccessView(snapshot, 'admin'), true);

  applyAccessRole(model, ACCESS_ROLES.DIRECTOR);
  const directorSnapshot = accessSnapshot(model);
  assert.equal(canAccessView(directorSnapshot, 'treasury'), true);
  assert.equal(canAccessView(directorSnapshot, 'settings'), false);
});

test('transição de perfil mantém os campos legados de sessão sincronizados', () => {
  const model = {};

  applyAccessRole(model, ACCESS_ROLES.DIRECTOR);
  const director = accessSnapshot(model);
  assert.equal(director.role, ACCESS_ROLES.DIRECTOR);
  assert.equal(director.authenticated, true);
  assert.equal(director.readOnly, true);
  assert.equal(director.canWrite, false);
  assert.equal(director.canRefresh, true);
  assert.equal(director.canViewTreasury, true);
  assert.equal(director.canViewSettings, false);
  assert.equal(director.canPublish, false);
  assert.equal(director.canManageUsers, false);
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
