import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACCESS_CAPABILITIES,
  defaultAccessRoles,
  normalizeAccessPermissions,
  normalizeAccessRoleRecord
} from '../assets/js/core/portal-access.js?v=6.43.0';
import {
  CURRENT_SCHEMA_VERSION,
  migratePortalPayload,
  validatePortalState
} from '../assets/js/core/portal-schema.js?v=6.43.0';
import {
  ACCESS_ROLES,
  accessSnapshot,
  applyAccessRole,
  canAccessView
} from '../assets/js/modules/portal-runtime/authorization.js?v=6.43.0';
import {
  authenticatePortalUser,
  buildPortalUserPassword,
  portalUserHasValidPasswordProfile
} from '../assets/js/modules/portal-runtime/user-access.js?v=6.43.0';
import { adminDashboardHtml, adminLoginHtml } from '../assets/js/modules/admin-dashboard/view.js?v=6.43.0';
import { createAdminDashboardModel } from '../assets/js/modules/admin-dashboard/domain.js?v=6.43.0';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(root, relativePath), 'utf8');

function baseState() {
  return migratePortalPayload({
    schemaVersion: 10,
    data: {
      settings: { clubName: 'Lions', initialized: true },
      birthdays: [{ id: 'member-1', name: 'Ana Lions', memberNumber: '123', status: 'Ativo', active: true }],
      treasuryAccounts: [], treasuryCategories: [], familyGroups: [], mutualGroups: [], treasury: [],
      events: [], meetings: [], notices: []
    }
  }).state;
}

test('esquema 12 preserva cargos e adiciona histórico por Ano Leonístico sem alterar os módulos existentes', () => {
  const result = migratePortalPayload({
    schemaVersion: 10,
    data: {
      settings: { clubName: 'Lions', initialized: true },
      birthdays: [{ id: 'member-1', name: 'Ana Lions', active: true }],
      treasuryAccounts: [{ id: 'account-1', name: 'Banco' }], treasuryCategories: [],
      familyGroups: [], mutualGroups: [], treasury: [{ id: 'move-1', type: 'entrada', amount: 10 }],
      events: [], meetings: [], notices: []
    }
  });

  assert.equal(CURRENT_SCHEMA_VERSION, 12);
  assert.equal(result.schemaVersion, 12);
  assert.equal(result.state.birthdays.length, 1);
  assert.equal(result.state.treasuryAccounts.length, 1);
  assert.equal(result.state.treasury.length, 1);
  assert.equal(result.state.portalUsers.length, 0);
  assert.deepEqual(result.state.accessRoles.map(role => role.name), [
    'Presidente', 'Vice-Presidente', 'Secretário', 'Tesoureiro', 'Diretor'
  ]);
  assert.ok(result.migrations.some(item => item.includes('v10→v11')));
});

test('cargo personalizado não é convertido em cargo protegido durante a normalização', () => {
  const custom = normalizeAccessRoleRecord({
    id: 'role-marketing',
    name: 'Marketing',
    system: false,
    active: true,
    permissions: [ACCESS_CAPABILITIES.MANAGE_NOTICES]
  }, 0);

  assert.equal(custom.system, false);
  assert.deepEqual(custom.permissions.sort(), [
    ACCESS_CAPABILITIES.MANAGE_NOTICES,
    ACCESS_CAPABILITIES.VIEW_PRIVATE_DATA,
    ACCESS_CAPABILITIES.WRITE_DATA
  ].sort());
});

test('permissões derivadas abrem somente as telas necessárias ao cargo', () => {
  const permissions = normalizeAccessPermissions([ACCESS_CAPABILITIES.MANAGE_TREASURY]);
  const model = {};
  applyAccessRole(model, ACCESS_ROLES.USER, {
    capabilities: permissions,
    user: { id: 'usr-1', name: 'Ana Lions', roleName: 'Tesoureiro' },
    label: 'Tesoureiro'
  });
  const access = accessSnapshot(model);

  assert.equal(access.canWrite, true);
  assert.equal(access.canManageTreasury, true);
  assert.equal(access.canViewTreasury, true);
  assert.equal(access.canManageAgenda, false);
  assert.equal(access.canPublish, false);
  assert.equal(access.canManageUsers, false);
  assert.equal(canAccessView(model, 'treasury'), true);
  assert.equal(canAccessView(model, 'settings'), false);
});

test('senha individual é armazenada somente como derivação criptográfica e autentica o associado', async () => {
  const state = baseState();
  const profile = await buildPortalUserPassword('SenhaForte2026', 'usr-1');
  state.portalUsers.push({
    id: 'usr-1', memberId: 'member-1', username: 'ana.lions', roleId: 'role-treasurer', active: true,
    ...profile
  });

  assert.equal(portalUserHasValidPasswordProfile(state.portalUsers[0]), true);
  assert.equal(JSON.stringify(state.portalUsers[0]).includes('SenhaForte2026'), false);
  assert.equal((await authenticatePortalUser('ANA.LIONS', 'SenhaForte2026', state))?.member.name, 'Ana Lions');
  assert.equal(await authenticatePortalUser('ana.lions', 'senha-incorreta', state), null);
});

test('alterar o cargo do usuário atualiza as permissões usadas no próximo acesso', async () => {
  const state = baseState();
  const profile = await buildPortalUserPassword('SenhaForte2026', 'usr-1');
  state.portalUsers.push({
    id: 'usr-1', memberId: 'member-1', username: 'ana', roleId: 'role-treasurer', active: true,
    ...profile
  });
  assert.equal((await authenticatePortalUser('ana', 'SenhaForte2026', state))?.role.name, 'Tesoureiro');

  state.portalUsers[0].roleId = 'role-secretary';
  const next = await authenticatePortalUser('ana', 'SenhaForte2026', state);
  assert.equal(next?.role.name, 'Secretário');
  assert.ok(next?.role.permissions.includes(ACCESS_CAPABILITIES.MANAGE_AGENDA));
  assert.ok(!next?.role.permissions.includes(ACCESS_CAPABILITIES.MANAGE_TREASURY));
});

test('usuário ativo sem senha válida é rejeitado pela validação do estado', () => {
  const state = baseState();
  state.portalUsers.push({
    id: 'usr-1', memberId: 'member-1', username: 'ana', roleId: 'role-director', active: true,
    passwordVersion: 1, passwordSalt: '', passwordHash: '', passwordIterations: 210000
  });
  const validation = validatePortalState(state);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(message => message.includes('não possui uma senha configurada')));
});


test('mutuário não pode receber usuário individual destinado a associado ativo', async () => {
  const state = baseState();
  state.birthdays.push({ id: 'mutual-1', name: 'Mutuário Exemplo', status: 'Mútua', active: true });
  const profile = await buildPortalUserPassword('SenhaForte2026', 'usr-mutual');
  state.portalUsers.push({
    id: 'usr-mutual', memberId: 'mutual-1', username: 'mutuario', roleId: 'role-director', active: true,
    ...profile
  });

  const validation = validatePortalState(state);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(message => message.includes('não é associada ativa')));
  assert.equal(await authenticatePortalUser('mutuario', 'SenhaForte2026', state), null);
});

test('atualização do Portal reaplica cargo alterado e encerra acesso revogado', async () => {
  const refresh = await source('assets/js/modules/portal-runtime/interface-refresh.js');
  assert.match(refresh, /applyAccessRole\(model, ACCESS_ROLES\.USER/);
  assert.match(refresh, /capabilities: role\.permissions/);
  assert.match(refresh, /reason: 'access-revoked'/);
  assert.match(refresh, /Seu acesso foi desativado/);
});

test('tela de acesso inclui usuário individual e o painel reserva acessos e backups ao Administrador', () => {
  const login = adminLoginHtml();
  assert.match(login, /data-login-mode="user"/);
  assert.match(login, /id="portalUsername"/);
  assert.match(login, /id="portalUserPassword"/);

  const state = baseState();
  const model = createAdminDashboardModel(state, { periodPreset: 'current-month', now: new Date(2026, 7, 8) });
  const adminHtml = adminDashboardHtml(model, {
    accessRole: 'admin',
    accessPolicy: { canManageUsers: true, canImport: true, canExportReports: true }
  });
  const userHtml = adminDashboardHtml(model, {
    accessRole: 'user',
    canWrite: true,
    accessPolicy: {
      user: { name: 'Ana Lions', roleName: 'Secretário' },
      label: 'Secretário', readOnly: false,
      canManagePeople: true, canManageAgenda: true, canManageNotices: true,
      canManageTreasury: false, canExportReports: true, canManageUsers: false, canImport: false
    }
  });
  assert.match(adminHtml, /Gerenciar acessos/);
  assert.match(adminHtml, /Baixar backup/);
  assert.doesNotMatch(userHtml, /Gerenciar acessos/);
  assert.doesNotMatch(userHtml, /Baixar backup/);
  assert.doesNotMatch(userHtml, /data-add="treasury"/);
  assert.match(userHtml, /data-add="event"/);
});

test('gerenciador de acesso é carregado sob demanda e oferece cargos personalizados', async () => {
  const [portalApp, lazyManager, manager, css] = await Promise.all([
    source('assets/js/modules/portal-app.js'),
    source('assets/js/modules/lazy-access-management.js'),
    source('assets/js/modules/access-management.js'),
    source('assets/css/components/access-management.css')
  ]);
  assert.doesNotMatch(portalApp, /from ['"]\.\/access-management\.js/);
  assert.match(lazyManager, /import\('\.\/access-management\.js\?v=6\.44\.1'\)/);
  assert.match(manager, /Novo cargo/);
  assert.match(manager, /Novo usuário/);
  assert.match(manager, /buildPortalUserPassword/);
  assert.match(css, /access-management/);
  assert.equal(defaultAccessRoles().length, 5);
});
