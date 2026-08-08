import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  activeLeadershipAssignment,
  currentLeadershipRole,
  effectivePortalUserRole,
  lionYearBounds,
  lionYearForDate,
  transitionLeadershipRole
} from '../assets/js/core/portal-leadership.js?v=6.43.0';
import { migratePortalPayload, validatePortalState } from '../assets/js/core/portal-schema.js?v=6.43.0';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(root, relativePath), 'utf8');

function stateWithMember() {
  return migratePortalPayload({
    schemaVersion: 11,
    data: {
      settings: { clubName: 'Lions', initialized: true },
      birthdays: [{ id: 'member-1', name: 'Ana Lions', memberNumber: '123', status: 'Ativo', active: true }],
      treasuryAccounts: [], treasuryCategories: [], familyGroups: [], mutualGroups: [], treasury: [],
      events: [], meetings: [], notices: [], accessRoles: [], portalUsers: [], leadershipAssignments: []
    }
  }).state;
}

test('Ano Leonístico muda em primeiro de julho e usa limites completos', () => {
  assert.equal(lionYearForDate(new Date(2026, 5, 30, 12)), '2025/2026');
  assert.equal(lionYearForDate(new Date(2026, 6, 1, 12)), '2026/2027');
  assert.deepEqual(lionYearBounds('2026/2027'), {
    lionYear: '2026/2027', startsOn: '2026-07-01', endsOn: '2027-06-30'
  });
});

test('migração do esquema 11 cria histórico para usuários existentes sem apagar o cargo', () => {
  const result = migratePortalPayload({
    schemaVersion: 11,
    data: {
      settings: { clubName: 'Lions', initialized: true },
      birthdays: [{ id: 'member-1', name: 'Ana Lions', status: 'Ativo', active: true }],
      treasuryAccounts: [], treasuryCategories: [], familyGroups: [], mutualGroups: [], treasury: [],
      events: [], meetings: [], notices: [],
      accessRoles: [{ id: 'role-secretary', name: 'Secretário', active: true, permissions: [] }],
      portalUsers: [{ id: 'usr-1', memberId: 'member-1', username: 'ana', roleId: 'role-secretary', active: false }]
    }
  });
  assert.equal(result.schemaVersion, 12);
  assert.equal(result.state.portalUsers[0].roleId, 'role-secretary');
  assert.equal(result.state.leadershipAssignments.length, 1);
  assert.equal(result.state.leadershipAssignments[0].memberId, 'member-1');
  assert.ok(result.migrations.some(item => item.includes('v11→v12')));
});

test('cargo vigente concede permissões somente dentro do período', () => {
  const state = stateWithMember();
  state.leadershipAssignments = [{
    id: 'lead-1', memberId: 'member-1', roleId: 'role-treasurer', lionYear: '2026/2027',
    startsOn: '2026-07-01', endsOn: '2027-06-30', active: true
  }];
  assert.equal(currentLeadershipRole(state, 'member-1', new Date(2026, 7, 8)).role?.name, 'Tesoureiro');
  assert.equal(activeLeadershipAssignment(state, 'member-1', new Date(2027, 6, 1)), null);
});

test('histórico existente impede que roleId antigo continue concedendo acesso após o AL', () => {
  const state = stateWithMember();
  const user = { id: 'usr-1', memberId: 'member-1', roleId: 'role-president', active: true };
  state.leadershipAssignments = [{
    id: 'lead-old', memberId: 'member-1', roleId: 'role-president', lionYear: '2025/2026',
    startsOn: '2025-07-01', endsOn: '2026-06-30', active: true
  }];
  const access = effectivePortalUserRole(state, user, new Date(2026, 6, 1));
  assert.equal(access.role, null);
  assert.equal(access.expired, true);
});

test('troca de cargo encerra o anterior e preserva os dois registros', () => {
  const state = stateWithMember();
  state.leadershipAssignments = [{
    id: 'lead-old', memberId: 'member-1', roleId: 'role-secretary', lionYear: '2026/2027',
    startsOn: '2026-07-01', endsOn: '2027-06-30', active: true, createdAt: '', updatedAt: ''
  }];
  transitionLeadershipRole(state, {
    id: 'lead-new', memberId: 'member-1', roleId: 'role-treasurer',
    effectiveOn: '2026-09-15', lionYear: '2026/2027', now: new Date('2026-09-15T12:00:00Z')
  });
  assert.equal(state.leadershipAssignments.length, 2);
  assert.equal(state.leadershipAssignments.find(item => item.id === 'lead-old').endsOn, '2026-09-14');
  assert.equal(currentLeadershipRole(state, 'member-1', new Date(2026, 9, 1)).role?.name, 'Tesoureiro');
});

test('validação rejeita períodos fora do Ano Leonístico', () => {
  const state = stateWithMember();
  state.leadershipAssignments = [{
    id: 'lead-invalid', memberId: 'member-1', roleId: 'role-director', lionYear: '2026/2027',
    startsOn: '2026-06-30', endsOn: '2027-06-30', active: true
  }];
  const validation = validatePortalState(state);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(message => message.includes('Período inválido')));
});

test('gerenciador apresenta histórico, Ano Leonístico e designações', async () => {
  const [manager, css, refresh] = await Promise.all([
    source('assets/js/modules/access-management.js'),
    source('assets/css/components/access-management.css'),
    source('assets/js/modules/portal-runtime/interface-refresh.js')
  ]);
  assert.match(manager, /Histórico por Ano Leonístico/);
  assert.match(manager, /Nova designação/);
  assert.match(manager, /pattern="\[0-9\]\{4\}\/\[0-9\]\{4\}"/);
  assert.doesNotMatch(manager, /pattern="\\d\{4\}\/\\d\{4\}"/);
  assert.match(manager, /transitionLeadershipRole/);
  assert.match(css, /leadership-history-card/);
  assert.match(refresh, /effectivePortalUserRole/);
});

test('política da sessão remove capacidades quando a designação armazenada já terminou', async () => {
  const { accessPolicyFor } = await import('../assets/js/modules/portal-runtime/authorization.js?v=6.43.0');
  const policy = accessPolicyFor({
    accessRole: 'user',
    accessCapabilities: ['view-private-data', 'manage-treasury'],
    currentPortalUser: { roleStartsOn: '2000-07-01', roleEndsOn: '2001-06-30' }
  });
  assert.equal(policy.authenticated, false);
  assert.deepEqual(policy.capabilities, []);
});
