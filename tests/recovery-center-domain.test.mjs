import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SCHEMA_VERSION } from '../assets/js/core/portal-schema.js';
import {
  createRecoverySnapshot,
  diagnosePortalIntegrity,
  mergeRecoveryAreas,
  pruneRecoverySnapshots,
  recoveryChecksum,
  summarizePortalState,
  verifyRecoverySnapshot
} from '../assets/js/modules/recovery-center/domain.js';

function baseState() {
  return {
    settings: {
      clubName: 'Lions',
      logo: './public/logo.png',
      initialized: true
    },
    birthdays: [{ id: 'b1', name: 'João', birthDate: '1995-01-02', photo: './public/members/b1.jpg' }],
    treasuryAccounts: [{ id: 'a1', name: 'Conta' }],
    treasuryCategories: ['Mensalidades'],
    familyGroups: [{ id: 'f1', name: 'Família', memberIds: ['b1'], primaryMemberId: 'b1' }],
    mutualGroups: [],
    treasury: [{ id: 't1', date: '2026-07-30', category: 'Mensalidades', accountId: 'a1', entry: 40, exit: 0 }],
    events: [{ id: 'e1', name: 'Evento', date: '2026-08-01' }],
    meetings: [{ id: 'm1', theme: 'Reunião', date: '2026-08-02' }],
    notices: [{ id: 'n1', title: 'Aviso', date: '2026-07-30' }]
  };
}

test('checksum de recuperação é determinístico e muda com o conteúdo', () => {
  assert.equal(recoveryChecksum({ b: 2, a: 1 }), recoveryChecksum({ a: 1, b: 2 }));
  assert.notEqual(recoveryChecksum({ a: 1 }), recoveryChecksum({ a: 2 }));
});

test('cria e valida um ponto de recuperação versionado', () => {
  const snapshot = createRecoverySnapshot({
    state: baseState(),
    reason: 'manual',
    now: () => new Date('2026-07-30T21:00:00.000Z')
  });
  const verification = verifyRecoverySnapshot(snapshot);

  assert.equal(verification.valid, true);
  assert.equal(snapshot.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(snapshot.summary.birthdays, 1);
  assert.equal(snapshot.summary.treasury, 1);
});

test('detecta adulteração no conteúdo de um ponto', () => {
  const snapshot = createRecoverySnapshot({ state: baseState() });
  snapshot.payload.data.notices[0].title = 'Alterado sem atualizar assinatura';

  const verification = verifyRecoverySnapshot(snapshot);
  assert.equal(verification.valid, false);
  assert.match(verification.errors.join(' '), /assinatura/i);
});

test('mantém apenas os pontos mais recentes no limite definido', () => {
  const snapshots = [1, 2, 3].map(day => ({ id: String(day), createdAt: `2026-07-0${day}T12:00:00.000Z` }));
  assert.deepEqual(pruneRecoverySnapshots(snapshots, 2).map(item => item.id), ['3', '2']);
});

test('restauração seletiva substitui somente as áreas escolhidas', () => {
  const current = baseState();
  const recovery = baseState();
  current.notices = [{ id: 'n-current', title: 'Atual' }];
  current.events = [{ id: 'e-current', name: 'Atual' }];
  recovery.notices = [{ id: 'n-old', title: 'Antigo' }];
  recovery.events = [{ id: 'e-old', name: 'Antigo' }];

  const merged = mergeRecoveryAreas(current, recovery, ['notices']);
  assert.equal(merged.notices[0].id, 'n-old');
  assert.equal(merged.events[0].id, 'e-current');
});

test('diagnóstico aprova vínculos consistentes', () => {
  const diagnostic = diagnosePortalIntegrity(baseState());
  assert.equal(diagnostic.status, 'ok');
  assert.equal(diagnostic.errors, 0);
  assert.equal(diagnostic.warnings, 0);
});

test('diagnóstico encontra IDs duplicados, vínculos órfãos e datas inválidas', () => {
  const state = baseState();
  state.birthdays.push({ id: 'b1', name: 'Duplicado', birthDate: '2026-02-31' });
  state.familyGroups[0].memberIds.push('inexistente');
  state.treasury[0].accountId = 'conta-inexistente';
  state.treasury[0].category = 'Categoria removida';

  const diagnostic = diagnosePortalIntegrity(state);
  assert.equal(diagnostic.status, 'error');
  assert.ok(diagnostic.errors >= 3);
  assert.ok(diagnostic.warnings >= 2);
});

test('resumo contabiliza os principais módulos do portal', () => {
  const summary = summarizePortalState(baseState());
  assert.deepEqual(summary, {
    birthdays: 1,
    treasuryAccounts: 1,
    familyGroups: 1,
    mutualGroups: 0,
    treasury: 1,
    treasuryEntries: 1,
    treasuryExits: 0,
    events: 1,
    meetings: 1,
    notices: 1
  });
});

test('ponto legado v4 mantém a integridade e remove credenciais ao restaurar', () => {
  const legacyState = baseState();
  legacyState.settings.adminUser = 'legacy';
  legacyState.settings.adminPassword = 'legacy-secret';
  const snapshot = {
    id: 'legacy-v4',
    createdAt: '2026-07-30T20:00:00.000Z',
    checksum: recoveryChecksum(legacyState),
    payload: {
      app: 'Lions Clube de Cândido Mota Dashboard',
      schemaVersion: 4,
      version: 4,
      data: legacyState
    }
  };

  const verification = verifyRecoverySnapshot(snapshot);
  assert.equal(verification.valid, true);
  assert.equal('adminUser' in verification.state.settings, false);
  assert.equal('adminPassword' in verification.state.settings, false);
});

test('metadados de recuperação não armazenam tokens ou segredos', () => {
  const snapshot = createRecoverySnapshot({
    state: baseState(),
    metadata: {
      sourceFileName: 'backup.json',
      githubToken: 'token-secret',
      nested: { password: 'secret', safe: true }
    }
  });

  assert.deepEqual(snapshot.metadata, {
    sourceFileName: 'backup.json',
    nested: { safe: true }
  });
});
