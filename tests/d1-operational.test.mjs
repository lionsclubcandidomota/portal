import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { queryD1OperationalTreasury } from '../cloudflare/attachment-worker/src/d1-operational.js';
import {
  applyD1TreasuryMutation,
  getD1StorageStatus,
  readD1PrivateState,
  writeD1PrivateState
} from '../cloudflare/attachment-worker/src/d1-storage.js';
import { loadD1OperationalTreasury } from '../assets/js/modules/secure-storage/operational-client.js';
import {
  clearSecureStorageSession,
  setActiveSecureStorageSession
} from '../assets/js/modules/secure-storage/session-store.js?v=6.46.0';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

  all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
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

async function fixture() {
  const database = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_portal_private_state.sql',
    '0003_treasury_granular_writes.sql',
    '0004_group_granular_writes.sql',
    '0005_analytics_read_models.sql',
    '0006_relational_operational_source.sql'
  ]) {
    database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations', migration), 'utf8'));
  }
  const env = { PORTAL_DB: new SQLiteD1Database(database) };
  const state = {
    version: 11,
    settings: { membershipMonthlyFee: 40 },
    treasuryAccounts: [{ id: 'acc-1', name: 'Conta principal', active: true }],
    treasuryCategories: ['Doações', 'Despesas'],
    familyGroups: [],
    mutualGroups: [],
    treasury: [
      { id: 'mov-1', date: '2026-08-01', accountId: 'acc-1', category: 'Doações', description: 'Doação A', status: 'Realizado', entry: 100, exit: 0, attachments: [] },
      { id: 'mov-2', date: '2026-08-02', accountId: 'acc-1', category: 'Despesas', description: 'Conta de luz', status: 'Realizado', entry: 0, exit: 30, attachments: [] },
      { id: 'mov-3', date: '2026-08-03', accountId: 'acc-1', category: 'Doações', description: 'Doação B', status: 'Realizado', entry: 50, exit: 0, attachments: [] },
      { id: 'mov-4', date: '2026-08-10', accountId: 'acc-1', category: 'Doações', description: 'Doação futura', status: 'Programado', entry: 25, exit: 0, attachments: [] },
      { id: 'mov-5', date: '2026-08-11', accountId: 'acc-1', category: 'Despesas', description: 'Despesa futura', status: 'Programado', entry: 0, exit: 15, attachments: [] },
      { id: 'mov-6', date: '2026-09-01', accountId: 'acc-1', category: 'Doações', description: 'Fora do período', status: 'Realizado', entry: 10, exit: 0, attachments: [] }
    ]
  };
  await writeD1PrivateState(env, state, {
    revision: 'operational-rev-1',
    updatedAt: '2026-08-07T12:00:00.000Z',
    updatedBy: 'teste',
    checksum: 'checksum-1',
    activate: true,
    storageStatus: await getD1StorageStatus(env)
  });
  return { database, env, state };
}

test('consulta operacional pagina movimentações e calcula contagens no D1', async () => {
  const { database, env } = await fixture();
  const result = await queryD1OperationalTreasury(env, {
    start: '2026-08-01',
    end: '2026-08-31',
    filter: 'all',
    scheduledPage: 1,
    completedPage: 1,
    pageSize: 2
  });
  assert.equal(result.source, 'd1-relational');
  assert.deepEqual(result.counts, { all: 5, scheduled: 2, completed: 3, entries: 3, exits: 2 });
  assert.equal(result.summary.mode, 'realized');
  assert.equal(result.summary.entries, 150);
  assert.equal(result.summary.exits, 30);
  assert.equal(result.summary.result, 120);
  assert.deepEqual(result.scheduled.items.map(item => item.id), ['mov-4', 'mov-5']);
  assert.deepEqual(result.completed.items.map(item => item.id), ['mov-3', 'mov-2']);
  assert.equal(result.completed.pages, 2);
  database.close();
});

test('filtro programado retorna somente previsões e pesquisa ocorre no banco', async () => {
  const { database, env } = await fixture();
  const scheduled = await queryD1OperationalTreasury(env, {
    start: '2026-08-01', end: '2026-08-31', filter: 'scheduled', pageSize: 8
  });
  assert.equal(scheduled.summary.mode, 'scheduled');
  assert.equal(scheduled.summary.entries, 25);
  assert.equal(scheduled.summary.exits, 15);
  assert.equal(scheduled.completed.total, 0);

  const searched = await queryD1OperationalTreasury(env, {
    start: '2026-08-01', end: '2026-08-31', query: 'luz', filter: 'all'
  });
  assert.equal(searched.counts.all, 1);
  assert.deepEqual(searched.completed.items.map(item => item.id), ['mov-2']);
  database.close();
});

test('gravação granular deixa snapshot de recuperação intacto e leitura usa tabelas relacionais', async () => {
  const { database, env, state } = await fixture();
  const snapshotBefore = database.prepare('SELECT payload FROM portal_state_snapshot WHERE id = 1').get().payload;
  const nextState = structuredClone(state);
  nextState.treasury[0].entry = 175;
  await applyD1TreasuryMutation(env, {
    mutationId: 'operational-mutation-0001',
    expectedRevision: 'operational-rev-1',
    revision: 'operational-rev-2',
    updatedAt: '2026-08-07T12:05:00.000Z',
    updatedBy: 'administrador',
    checksum: 'checksum-2',
    nextState,
    upserts: [{ movement: nextState.treasury[0], sortOrder: 0 }],
    deletes: [],
    storageStatus: await getD1StorageStatus(env)
  });
  const snapshotAfter = database.prepare('SELECT payload FROM portal_state_snapshot WHERE id = 1').get().payload;
  assert.equal(snapshotAfter, snapshotBefore);
  assert.equal(database.prepare("SELECT value FROM portal_meta WHERE key = 'snapshot_stale'").get().value, '1');
  const restored = await readD1PrivateState(env, { storageStatus: await getD1StorageStatus(env) });
  assert.equal(restored.source, 'relational');
  assert.equal(restored.snapshotStale, true);
  assert.equal(restored.state.treasury[0].entry, 175);
  database.close();
});

test('cliente operacional envia paginação, filtros e sessão ao Worker', async () => {
  const workerUrl = 'https://lions-portal-anexos.example.workers.dev';
  const state = { settings: { secureStorage: { enabled: true, workerUrl } } };
  setActiveSecureStorageSession({
    workerUrl,
    role: 'admin',
    token: 'session-token',
    expiresAt: Date.now() + 600_000
  });
  let call = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    call = { url: String(url), options };
    return new Response(JSON.stringify({ source: 'd1-relational', scheduled: {}, completed: {}, counts: {}, summary: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    await loadD1OperationalTreasury(state, {
      start: '2026-08-01', end: '2026-08-31', query: 'doação', filter: 'entries',
      scheduledPage: 2, completedPage: 3, pageSize: 8
    });
  } finally {
    globalThis.fetch = originalFetch;
    clearSecureStorageSession();
  }
  assert.match(call.url, /\/api\/operational\/treasury\?/);
  assert.match(call.url, /filter=entries/);
  assert.match(call.url, /scheduledPage=2/);
  assert.match(call.url, /completedPage=3/);
  assert.equal(call.options.headers.Authorization, 'Bearer session-token');
});
