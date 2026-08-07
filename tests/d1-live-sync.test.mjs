import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyD1GroupsMutation,
  applyD1ReferenceMutation,
  applyD1TreasuryMutation,
  getD1StorageStatus,
  writeD1PrivateState
} from '../cloudflare/attachment-worker/src/d1-storage.js';
import {
  readD1GroupsModule,
  readD1ModuleRevisions,
  readD1ReferenceModule
} from '../cloudflare/attachment-worker/src/d1-sync.js';
import { createLiveSyncActions } from '../assets/js/modules/portal-runtime/live-sync.js?v=6.47.0';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class SQLitePreparedStatement {
  constructor(database, sql, values = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values) { return new SQLitePreparedStatement(this.database, this.sql, values); }
  first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  result() {
    const statement = this.database.prepare(this.sql);
    if (statement.columns().length) return { results: statement.all(...this.values) };
    statement.run(...this.values);
    return { results: [] };
  }
}
class SQLiteD1Database {
  constructor(database) { this.database = database; }
  prepare(sql) { return new SQLitePreparedStatement(this.database, sql); }
  async batch(statements) {
    this.database.exec('BEGIN');
    try {
      const results = statements.map(statement => statement.result());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

async function fixture() {
  const database = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_portal_private_state.sql',
    '0003_treasury_granular_writes.sql',
    '0004_group_granular_writes.sql',
    '0005_analytics_read_models.sql',
    '0006_relational_operational_source.sql',
    '0007_operational_memberships_mutuals.sql',
    '0008_private_bootstrap_reference.sql',
    '0009_module_revisions.sql',
    '0010_public_portal_d1.sql'
  ]) {
    database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations', migration), 'utf8'));
  }
  const env = { PORTAL_DB: new SQLiteD1Database(database) };
  const state = {
    version: 11,
    settings: { membershipMonthlyFee: 40 },
    treasuryAccounts: [{ id: 'acc-1', name: 'Conta principal', type: 'Conta corrente', active: true }],
    treasuryCategories: ['Mensalidades', 'Mútuas'],
    familyGroups: [{ id: 'fam-1', name: 'Família', memberIds: ['m-1'], primaryMemberId: 'm-1' }],
    mutualGroups: [{
      id: 'mut-1', name: 'Mútua 658', createdDate: '2026-01-01',
      memberships: [{ id: 'mum-1', memberId: 'm-1', joinedDate: '2026-01-01', endedDate: '' }],
      events: []
    }],
    treasury: [{ id: 'mov-1', date: '2026-08-01', category: 'Mensalidades', entry: 40, exit: 0, status: 'Recebido', memberId: 'm-1', attachments: [] }]
  };
  await writeD1PrivateState(env, state, {
    revision: 'revision-1', updatedAt: '2026-08-07T22:00:00.000Z', updatedBy: 'admin', checksum: 'checksum-1',
    activate: true, storageStatus: await getD1StorageStatus(env)
  });
  return { database, env, state };
}

test('migrações 0009 e 0010 mantêm revisões independentes por módulo e conteúdo público', async () => {
  const { database, env, state } = await fixture();
  const status = await getD1StorageStatus(env);
  assert.equal(status.schemaVersion, 9);
  assert.equal(status.moduleRevisionSync, true);
  const initial = await readD1ModuleRevisions(env);
  assert.equal(initial.modules.reference.revision, 1);
  assert.equal(initial.modules.groups.revision, 1);
  assert.equal(initial.modules.treasury.revision, 1);
  assert.equal(initial.modules.public.revision, 0);

  const treasuryState = structuredClone(state);
  treasuryState.treasury.push({ id: 'mov-2', date: '2026-08-02', category: 'Mútuas', entry: 20, exit: 0, status: 'Recebido', attachments: [] });
  await applyD1TreasuryMutation(env, {
    mutationId: 'live-sync-treasury-001', expectedRevision: 'revision-1', revision: 'revision-2',
    updatedAt: '2026-08-07T22:05:00.000Z', updatedBy: 'admin', checksum: 'checksum-2', nextState: treasuryState,
    upserts: [{ movement: treasuryState.treasury[1], sortOrder: 1 }], storageStatus: await getD1StorageStatus(env)
  });
  const afterTreasury = await readD1ModuleRevisions(env);
  assert.equal(afterTreasury.modules.treasury.revision, 2);
  assert.equal(afterTreasury.modules.memberships.revision, 2);
  assert.equal(afterTreasury.modules.mutuals.revision, 2);
  assert.equal(afterTreasury.modules.groups.revision, 1);

  const referenceState = structuredClone(treasuryState);
  referenceState.settings.membershipMonthlyFee = 45;
  await applyD1ReferenceMutation(env, {
    mutationId: 'live-sync-reference-001', expectedRevision: 'revision-2', revision: 'revision-3',
    updatedAt: '2026-08-07T22:10:00.000Z', updatedBy: 'admin', checksum: 'checksum-3', nextState: referenceState,
    storageStatus: await getD1StorageStatus(env)
  });
  const reference = await readD1ReferenceModule(env);
  assert.equal(reference.state.settings.membershipMonthlyFee, 45);
  assert.equal(reference.revision, 2);

  const groupState = structuredClone(referenceState);
  groupState.familyGroups[0].name = 'Família atualizada';
  await applyD1GroupsMutation(env, {
    mutationId: 'live-sync-groups-001', expectedRevision: 'revision-3', revision: 'revision-4',
    updatedAt: '2026-08-07T22:15:00.000Z', updatedBy: 'admin', checksum: 'checksum-4', nextState: groupState,
    familyGroups: { upserts: [{ group: groupState.familyGroups[0], sortOrder: 0 }], deletes: [] },
    mutualGroups: { upserts: [], deletes: [] }, storageStatus: await getD1StorageStatus(env)
  });
  const groups = await readD1GroupsModule(env);
  assert.equal(groups.state.familyGroups[0].name, 'Família atualizada');
  assert.equal(groups.revision, 2);
  database.close();
});

test('sincronização do Portal aplica apenas módulos alterados sem recarregar a página', async () => {
  let state = {
    settings: { membershipMonthlyFee: 40 },
    treasuryAccounts: [{ id: 'a1', name: 'Conta antiga' }],
    treasuryCategories: ['Antiga'],
    familyGroups: [{ id: 'f1', name: 'Família antiga' }],
    mutualGroups: [],
    treasury: []
  };
  let revisionsCall = 0;
  let invalidated = [];
  let renders = 0;
  const context = {
    model: {
      accessRole: 'admin', pendingChanges: 0, privateSavePending: 0,
      lastSyncedState: structuredClone(state)
    },
    dependencies: {
      getCurrentView: () => 'treasury',
      isModalOpen: () => false,
      invalidateOperationalReads: modules => { invalidated = modules; },
      applySettings: () => {},
      renderCurrentView: () => { renders += 1; },
      setDatabaseSyncStatus: () => {}
    },
    services: {
      hasActiveSecureStorageSession: () => true,
      loadD1ModuleRevisions: async () => {
        revisionsCall += 1;
        return revisionsCall === 1
          ? { revision: 'r1', modules: { reference: { revision: 1 }, groups: { revision: 1 }, treasury: { revision: 1 }, memberships: { revision: 1 }, mutuals: { revision: 1 }, 'member-directory': { revision: 0 }, public: { revision: 0 } } }
          : { revision: 'r2', updatedAt: '2026-08-07T23:00:00.000Z', modules: { reference: { revision: 2 }, groups: { revision: 2 }, treasury: { revision: 2 }, memberships: { revision: 2 }, mutuals: { revision: 2 }, 'member-directory': { revision: 0 }, public: { revision: 0 } } };
      },
      loadD1ReferenceModule: async () => ({ state: { settings: { membershipMonthlyFee: 50 }, treasuryAccounts: [{ id: 'a1', name: 'Conta nova' }], treasuryCategories: ['Nova'] } }),
      loadD1GroupsModule: async () => ({ state: { familyGroups: [{ id: 'f1', name: 'Família nova' }], mutualGroups: [{ id: 'm1', name: 'Mútua' }] } }),
      saveState: value => { state = structuredClone(value); }
    },
    environment: {
      window: { addEventListener() {}, removeEventListener() {}, setInterval() { return 1; }, clearInterval() {}, setTimeout() {} },
      document: { hidden: false, addEventListener() {}, removeEventListener() {} }
    },
    currentState: () => state,
    replaceCurrentState: value => { state = structuredClone(value); return state; },
    storeSyncedState: value => { context.model.lastSyncedState = structuredClone(value); },
    storeSyncMeta: () => {}
  };
  const live = createLiveSyncActions(context);
  const initialized = await live.check({ initialize: true });
  assert.equal(initialized.reason, 'initialized');
  const updated = await live.check({ reason: 'test' });
  assert.equal(updated.applied, true);
  assert.equal(state.settings.membershipMonthlyFee, 50);
  assert.equal(state.familyGroups[0].name, 'Família nova');
  assert.deepEqual(invalidated.sort(), ['groups', 'memberships', 'mutuals', 'reference', 'treasury'].sort());
  assert.equal(renders, 1);
});
