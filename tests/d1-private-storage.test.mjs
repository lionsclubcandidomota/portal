import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  D1_SCHEMA_VERSION,
  applyD1GroupsMutation,
  applyD1TreasuryMutation,
  composePrivateState,
  decomposePrivateState,
  getD1StorageStatus,
  readD1PrivateState,
  writeD1PrivateState
} from '../cloudflare/attachment-worker/src/d1-storage.js';
import {
  clearSecureStorageSession,
  connectSecureStorageSession,
  getPrivateStorageStatus,
  loadPrivatePortalState,
  migratePrivateStorageToD1,
  rollbackPrivateStorageToR2
} from '../assets/js/modules/secure-storage/client.js';
import { recoveryCenterHtml } from '../assets/js/modules/recovery-center/view.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerUrl = 'https://lions-portal-anexos.exemplo.workers.dev';
const state = {
  settings: { secureStorage: { enabled: true, workerUrl } },
  treasury: []
};


class SQLitePreparedStatement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new SQLitePreparedStatement(this.database, this.sql, values);
  }

  first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  run() {
    return this.database.prepare(this.sql).run(...this.values);
  }

  result() {
    const statement = this.database.prepare(this.sql);
    if (statement.columns().length) return { results: statement.all(...this.values) };
    statement.run(...this.values);
    return { results: [] };
  }
}

class SQLiteD1Database {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new SQLitePreparedStatement(this.database, sql);
  }

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

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('adaptador D1 preserva o estado privado e cria coleções relacionais', () => {
  const original = {
    version: 11,
    settings: { membershipMonthlyFee: 40, accessProfiles: { director: { enabled: true } } },
    treasuryAccounts: [{ id: 'acc-1', name: 'Conta', active: true }],
    treasuryCategories: ['Mensalidades', 'Mútuas'],
    familyGroups: [{ id: 'fam-1', name: 'Família', memberIds: ['m-1', 'm-2'], primaryMemberId: 'm-1' }],
    mutualGroups: [{
      id: 'mut-1',
      name: 'Mútua 658',
      createdDate: '2026-08-01',
      memberships: [{ id: 'membership-1', memberId: 'm-1', joinedDate: '2026-08-01', endedDate: '' }],
      events: [{ id: 'event-1', deceasedName: 'Associado', deathDate: '2026-08-05', amountPerParticipant: 15, participantIds: ['m-1'] }]
    }],
    treasury: [{
      id: 'mov-1',
      date: '2026-08-06',
      accountId: 'acc-1',
      category: 'Mútuas',
      status: 'Realizado',
      entry: 15,
      exit: 0,
      mutualGroupId: 'mut-1',
      mutualEventId: 'event-1',
      mutualMemberId: 'm-1',
      attachments: [{ id: 'att-1', storage: 'r2', objectKey: 'treasury/mov-1/att-1-a.pdf', name: 'Comprovante.pdf' }]
    }],
    futurePrivateField: { enabled: true }
  };
  const model = decomposePrivateState(original);
  assert.equal(D1_SCHEMA_VERSION, 4);
  assert.equal(model.treasury.length, 1);
  assert.equal(model.treasury[0].attachments.length, 1);
  assert.equal(model.familyGroups[0].members.length, 2);
  assert.equal(model.mutualGroups[0].events[0].participants.length, 1);

  const restored = composePrivateState({
    meta: { state_version: model.stateVersion },
    settings: { payload: model.settings },
    accounts: model.accounts,
    categories: model.categories,
    familyGroups: model.familyGroups,
    mutualGroups: model.mutualGroups,
    treasury: model.treasury,
    extras: model.extras
  });
  assert.deepEqual(restored, original);
});

test('migração SQL cria tabelas, vínculos e índices do Portal', async () => {
  const migration = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0001_portal_private_state.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS portal_meta/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS portal_state_snapshot/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS treasury_movements/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS mutual_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS treasury_attachments/);
  assert.match(migration, /FOREIGN KEY \(movement_id\) REFERENCES treasury_movements\(id\) ON DELETE CASCADE/);
  assert.match(migration, /idx_treasury_movements_date/);
  assert.match(migration, /schema_version', '1'/);
  const granularMigration = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0003_treasury_granular_writes.sql'), 'utf8');
  assert.match(granularMigration, /CREATE TABLE IF NOT EXISTS portal_mutations/);
  assert.match(granularMigration, /treasury_granular_writes/);
  assert.match(granularMigration, /schema_version', '2'/);
  const groupsMigration = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0004_group_granular_writes.sql'), 'utf8');
  assert.match(groupsMigration, /groups_granular_writes/);
  assert.match(groupsMigration, /idx_mutual_events_date/);
  assert.match(groupsMigration, /schema_version', '3'/);
  const analyticsMigration = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0005_analytics_read_models.sql'), 'utf8');
  assert.match(analyticsMigration, /analytics_read_models/);
  assert.match(analyticsMigration, /schema_version', '4'/);
});

test('gravação D1 é transacional, compacta e preserva o snapshot exato', async () => {
  const migration = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0001_portal_private_state.sql'), 'utf8');
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0003_treasury_granular_writes.sql'), 'utf8'));
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0004_group_granular_writes.sql'), 'utf8'));
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0005_analytics_read_models.sql'), 'utf8'));
  const env = { PORTAL_DB: new SQLiteD1Database(database) };
  const privateState = {
    version: 11,
    settings: { membershipMonthlyFee: 40 },
    treasuryAccounts: [{ id: 'acc-1', name: 'Conta principal', active: true }],
    treasuryCategories: ['Mútuas'],
    familyGroups: [],
    mutualGroups: [],
    treasury: Array.from({ length: 74 }, (_, index) => ({
      id: `mov-${index + 1}`,
      date: '2026-08-06',
      accountId: 'acc-1',
      category: 'Mútuas',
      status: 'Realizado',
      entry: 10,
      exit: 0,
      attachments: []
    }))
  };
  const initialStatus = await getD1StorageStatus(env);
  const saved = await writeD1PrivateState(env, privateState, {
    revision: 'revision-1',
    updatedAt: '2026-08-06T23:00:00.000Z',
    updatedBy: 'teste',
    checksum: 'checksum-1',
    activate: true,
    storageStatus: initialStatus
  });
  assert.ok(saved.statements <= 40, `A gravação utilizou ${saved.statements} consultas.`);
  const activeStatus = await getD1StorageStatus(env);
  const restored = await readD1PrivateState(env, { storageStatus: activeStatus });
  assert.equal(activeStatus.active, true);
  assert.equal(activeStatus.counts.treasury, 74);
  assert.deepEqual(restored.state, privateState);
  database.close();
});


test('movimentação e anexos são atualizados granularmente sem reconstruir as demais tabelas', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0001_portal_private_state.sql'), 'utf8'));
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0003_treasury_granular_writes.sql'), 'utf8'));
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0004_group_granular_writes.sql'), 'utf8'));
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0005_analytics_read_models.sql'), 'utf8'));
  const env = { PORTAL_DB: new SQLiteD1Database(database) };
  const initial = {
    version: 11,
    settings: { membershipMonthlyFee: 40 },
    treasuryAccounts: [{ id: 'acc-1', name: 'Conta principal', active: true }],
    treasuryCategories: ['Documentação'],
    familyGroups: [{ id: 'fam-1', name: 'Família', memberIds: ['m-1'] }],
    mutualGroups: [],
    treasury: [{ id: 'mov-1', date: '2026-08-01', accountId: 'acc-1', category: 'Documentação', status: 'Programado', entry: 0, exit: 25, attachments: [] }]
  };
  const initialStatus = await getD1StorageStatus(env);
  await writeD1PrivateState(env, initial, {
    revision: 'revision-1',
    updatedAt: '2026-08-07T02:00:00.000Z',
    updatedBy: 'teste',
    checksum: 'checksum-1',
    activate: true,
    storageStatus: initialStatus
  });

  const updatedMovement = {
    ...initial.treasury[0],
    status: 'Realizado',
    exit: 30,
    attachments: [{
      id: 'att-1',
      storage: 'r2',
      objectKey: 'treasury/mov-1/att-1-a.pdf',
      name: 'Comprovante.pdf',
      type: 'application/pdf',
      size: 1200,
      checksum: 'abc'
    }]
  };
  const nextState = structuredClone(initial);
  nextState.treasury = [updatedMovement];
  const saved = await applyD1TreasuryMutation(env, {
    mutationId: 'treasury-test-0001',
    expectedRevision: 'revision-1',
    revision: 'revision-2',
    updatedAt: '2026-08-07T02:05:00.000Z',
    updatedBy: 'administrador',
    checksum: 'checksum-2',
    nextState,
    upserts: [{ movement: updatedMovement, sortOrder: 0 }],
    deletes: [],
    storageStatus: await getD1StorageStatus(env)
  });

  assert.equal(saved.mode, 'granular-treasury');
  assert.equal(saved.changes.upserted, 1);
  assert.equal(saved.statements, 9);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM family_groups').get().total, 1);
  assert.equal(database.prepare('SELECT exit_amount FROM treasury_movements WHERE id = ?').get('mov-1').exit_amount, 30);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM treasury_attachments').get().total, 1);
  const restored = await readD1PrivateState(env, { storageStatus: await getD1StorageStatus(env) });
  assert.deepEqual(restored.state, nextState);

  const repeated = await applyD1TreasuryMutation(env, {
    mutationId: 'treasury-test-0001',
    expectedRevision: 'revision-1',
    revision: 'revision-2',
    nextState,
    upserts: [{ movement: updatedMovement, sortOrder: 0 }]
  });
  assert.equal(repeated.idempotent, true);

  await assert.rejects(
    applyD1TreasuryMutation(env, {
      mutationId: 'treasury-test-0002',
      expectedRevision: 'revision-1',
      revision: 'revision-3',
      updatedAt: '2026-08-07T02:06:00.000Z',
      updatedBy: 'outro',
      checksum: 'checksum-3',
      nextState,
      upserts: [{ movement: updatedMovement, sortOrder: 0 }],
      storageStatus: await getD1StorageStatus(env)
    }),
    error => error?.code === 'REVISION_CONFLICT'
  );
  database.close();
});



test('grupos familiares e de Mútuas são atualizados granularmente sem regravar movimentações', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0001_portal_private_state.sql'), 'utf8'));
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0003_treasury_granular_writes.sql'), 'utf8'));
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0004_group_granular_writes.sql'), 'utf8'));
  database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0005_analytics_read_models.sql'), 'utf8'));
  const env = { PORTAL_DB: new SQLiteD1Database(database) };
  const initial = {
    version: 11, settings: {},
    treasuryAccounts: [{ id: 'acc-1', name: 'Conta', active: true }],
    treasuryCategories: ['Mútuas'],
    familyGroups: [{ id: 'fam-1', name: 'Família A', memberIds: ['m-1'], primaryMemberId: 'm-1' }],
    mutualGroups: [{
      id: 'mut-1', name: 'Mútua 658', createdDate: '2026-08-01', closedDate: '',
      memberships: [{ id: 'mum-1', memberId: 'm-1', joinedDate: '2026-08-01', endedDate: '' }],
      events: []
    }],
    treasury: [{ id: 'mov-1', date: '2026-08-01', accountId: 'acc-1', category: 'Mútuas', status: 'Realizado', entry: 15, exit: 0, attachments: [] }]
  };
  await writeD1PrivateState(env, initial, {
    revision: 'groups-revision-1', updatedAt: '2026-08-07T10:00:00.000Z',
    updatedBy: 'teste', checksum: 'groups-checksum-1', activate: true,
    storageStatus: await getD1StorageStatus(env)
  });

  const nextState = structuredClone(initial);
  nextState.familyGroups[0].name = 'Família Atualizada';
  nextState.familyGroups[0].memberIds.push('m-2');
  nextState.mutualGroups[0].memberships.push({ id: 'mum-2', memberId: 'm-2', joinedDate: '2026-08-07', endedDate: '' });
  nextState.mutualGroups[0].events.push({
    id: 'mue-1', deceasedName: 'Associado do Distrito', deathDate: '2026-08-07',
    dueDate: '2026-08-20', amountPerParticipant: 20, participantIds: ['m-1', 'm-2']
  });

  const saved = await applyD1GroupsMutation(env, {
    mutationId: 'groups-test-0001', expectedRevision: 'groups-revision-1',
    revision: 'groups-revision-2', updatedAt: '2026-08-07T10:05:00.000Z',
    updatedBy: 'administrador', checksum: 'groups-checksum-2', nextState,
    familyGroups: { upserts: [{ group: nextState.familyGroups[0], sortOrder: 0 }], deletes: [] },
    mutualGroups: { upserts: [{ group: nextState.mutualGroups[0], sortOrder: 0 }], deletes: [] },
    storageStatus: await getD1StorageStatus(env)
  });

  assert.equal(saved.mode, 'granular-groups');
  assert.equal(saved.changes.familyMembers, 2);
  assert.equal(saved.changes.mutualEvents, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM treasury_movements').get().total, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM family_group_members').get().total, 2);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM mutual_memberships').get().total, 2);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM mutual_events').get().total, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM mutual_event_participants').get().total, 2);
  const restored = await readD1PrivateState(env, { storageStatus: await getD1StorageStatus(env) });
  assert.deepEqual(restored.state, nextState);

  const repeated = await applyD1GroupsMutation(env, {
    mutationId: 'groups-test-0001', expectedRevision: 'groups-revision-1',
    revision: 'groups-revision-2', nextState,
    familyGroups: { upserts: [{ group: nextState.familyGroups[0], sortOrder: 0 }] },
    mutualGroups: { upserts: [{ group: nextState.mutualGroups[0], sortOrder: 0 }] }
  });
  assert.equal(repeated.idempotent, true);

  const deletedState = structuredClone(nextState);
  deletedState.familyGroups = [];
  deletedState.mutualGroups = [];
  const deleted = await applyD1GroupsMutation(env, {
    mutationId: 'groups-test-0002', expectedRevision: 'groups-revision-2',
    revision: 'groups-revision-3', updatedAt: '2026-08-07T10:10:00.000Z',
    updatedBy: 'administrador', checksum: 'groups-checksum-3', nextState: deletedState,
    familyGroups: { upserts: [], deletes: ['fam-1'] },
    mutualGroups: { upserts: [], deletes: ['mut-1'] },
    storageStatus: await getD1StorageStatus(env)
  });
  assert.equal(deleted.changes.familyDeleted, 1);
  assert.equal(deleted.changes.mutualDeleted, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM family_groups').get().total, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM mutual_groups').get().total, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM mutual_events').get().total, 0);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM treasury_movements').get().total, 1);
  const restoredAfterDelete = await readD1PrivateState(env, { storageStatus: await getD1StorageStatus(env) });
  assert.deepEqual(restoredAfterDelete.state, deletedState);
  database.close();
});

test('cliente consulta o backend e executa migração e retorno com revisão otimista', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    calls.push({ pathname, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (pathname === '/api/session') {
      return response({ token: 'session-token', role: 'admin', expiresAt: new Date(Date.now() + 600_000).toISOString() });
    }
    if (pathname === '/api/private-state') {
      return response({ found: true, state: { treasury: [] }, revision: 'rev-r2', updatedAt: '2026-08-06T20:00:00.000Z' });
    }
    if (pathname === '/api/storage/status') {
      return response({ backend: 'r2', d1: { available: true, initialized: true, active: false, schemaVersion: 2 } });
    }
    if (pathname === '/api/storage/migrate-d1') {
      return response({ migrated: true, backend: 'd1', revision: 'rev-r2' });
    }
    if (pathname === '/api/storage/rollback-r2') {
      return response({ rolledBack: true, backend: 'r2', revision: 'rev-r2' });
    }
    return response({ error: 'unexpected' }, 500);
  };

  try {
    await connectSecureStorageSession({ state, role: 'admin', username: 'administrador', password: 'SenhaSegura123' });
    await loadPrivatePortalState(state);
    const status = await getPrivateStorageStatus(state);
    const migrated = await migratePrivateStorageToD1(state);
    const rolledBack = await rollbackPrivateStorageToR2(state);
    assert.equal(status.d1.initialized, true);
    assert.equal(migrated.backend, 'd1');
    assert.equal(rolledBack.backend, 'r2');
    assert.equal(calls.find(call => call.pathname === '/api/storage/migrate-d1').body.expectedRevision, 'rev-r2');
    assert.equal(calls.find(call => call.pathname === '/api/storage/rollback-r2').body.expectedRevision, 'rev-r2');
  } finally {
    clearSecureStorageSession();
    globalThis.fetch = originalFetch;
  }
});

test('Central de Recuperação diferencia D1 principal e R2 de contingência', () => {
  const common = {
    snapshots: [],
    diagnostic: { status: 'ok', errors: 0, warnings: 0, checkedAt: '2026-08-06T20:00:00.000Z', checks: [] },
    remote: {
      available: true,
      loading: false,
      canWrite: true,
      retention: 20,
      backups: [],
      current: { updatedAt: '2026-08-06T20:00:00.000Z', summary: { treasury: 74, accounts: 3 } },
      diagnostic: {
        status: 'ok',
        errors: [],
        warnings: [],
        current: { updatedAt: '2026-08-06T20:00:00.000Z', summary: { treasury: 74, accounts: 3 } },
        attachments: { referenced: 9, existing: 9, missing: [], orphaned: [] }
      }
    }
  };
  const ready = recoveryCenterHtml({
    ...common,
    remote: { ...common.remote, storage: { backend: 'r2', d1: { available: true, initialized: true, active: false, schemaVersion: 1 } } }
  });
  assert.match(ready, /Banco pronto para receber os dados/);
  assert.match(ready, /migratePrivateStorageD1Btn/);

  const active = recoveryCenterHtml({
    ...common,
    remote: { ...common.remote, storage: { backend: 'd1', d1: { available: true, initialized: true, active: true, schemaVersion: 1, updatedAt: '2026-08-06T20:00:00.000Z', counts: { treasury: 74, accounts: 3, mutualGroups: 1 } } } }
  });
  assert.match(active, /Banco estruturado ativo/);
  assert.match(active, /rollbackPrivateStorageR2Btn/);
  assert.match(active, /R2 permanece como espelho/);
});

test('Worker expõe rotas de migração, status e rollback do D1', async () => {
  const worker = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/src/index.js'), 'utf8');
  const config = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/wrangler.toml.example'), 'utf8');
  assert.match(worker, /\/api\/storage\/status/);
  assert.match(worker, /\/api\/storage\/migrate-d1/);
  assert.match(worker, /\/api\/storage\/rollback-r2/);
  assert.match(worker, /\/api\/private-state\/groups/);
  assert.match(worker, /handlePrivateGroupsMutation/);
  assert.match(worker, /privateState: storage\.backend/);
  assert.match(config, /\[\[d1_databases\]\]/);
  assert.match(config, /binding = "PORTAL_DB"/);
  assert.match(config, /migrations_dir = "migrations"/);
});
