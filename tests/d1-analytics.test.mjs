import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { queryD1DashboardAnalytics, queryD1ReportState } from '../cloudflare/attachment-worker/src/d1-analytics.js';
import { D1_SCHEMA_VERSION, getD1StorageStatus, writeD1PrivateState } from '../cloudflare/attachment-worker/src/d1-storage.js';
import { applyD1TreasuryAnalytics, createAdminDashboardModel } from '../assets/js/modules/admin-dashboard/domain.js';
import { loadD1DashboardAnalytics, loadD1ReportState } from '../assets/js/modules/secure-storage/analytics-client.js';
import { clearSecureStorageSession, setActiveSecureStorageSession } from '../assets/js/modules/secure-storage/session-store.js?v=6.47.0';

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

async function databaseFixture() {
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
    settings: { clubName: 'Lions Clube', membershipMonthlyFee: 40 },
    treasuryAccounts: [{ id: 'acc-1', name: 'Conta principal', active: true }],
    treasuryCategories: ['Doações', 'Mensalidades', 'Mútuas'],
    familyGroups: [{ id: 'fam-1', name: 'Família Silva', memberIds: ['m-1'], primaryMemberId: 'm-1' }],
    mutualGroups: [{
      id: 'mut-1',
      name: 'Mútua 658',
      createdDate: '2026-01-01',
      memberships: [{ id: 'mum-1', memberId: 'm-1', joinedDate: '2026-01-01', endedDate: '' }],
      events: [{ id: 'mue-1', deceasedName: 'Associado do Distrito', deathDate: '2026-08-05', amountPerParticipant: 25, participantIds: ['m-1'] }]
    }],
    treasury: [
      { id: 'mov-1', date: '2026-08-01', accountId: 'acc-1', category: 'Doações', status: 'Realizado', entry: 100, exit: 0, attachments: [] },
      { id: 'mov-2', date: '2026-08-02', accountId: 'acc-1', category: 'Despesas', status: 'Realizado', entry: 0, exit: 30, attachments: [] },
      { id: 'mov-3', date: '2026-08-10', accountId: 'acc-1', category: 'Mensalidades', status: 'Realizado', entry: 40, exit: 0, memberIds: ['m-1'], coveredMonths: ['2026-08'], attachments: [] },
      { id: 'mov-4', date: '2026-08-15', accountId: 'acc-1', category: 'Mútuas', status: 'Programado', entry: 25, exit: 0, mutualGroupId: 'mut-1', mutualEventId: 'mue-1', mutualMemberId: 'm-1', attachments: [] },
      { id: 'mov-5', date: '2026-09-01', accountId: 'acc-1', category: 'Doações', status: 'Realizado', entry: 10, exit: 0, attachments: [] }
    ]
  };
  await writeD1PrivateState(env, state, {
    revision: 'revision-analytics',
    updatedAt: '2026-08-07T12:00:00.000Z',
    updatedBy: 'teste',
    checksum: 'checksum-analytics',
    activate: true,
    storageStatus: await getD1StorageStatus(env)
  });
  return { database, env, state };
}

test('migração 0005 ativa modelos de leitura e eleva o esquema D1', async () => {
  const migration = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0005_analytics_read_models.sql'), 'utf8');
  assert.equal(D1_SCHEMA_VERSION, 9);
  assert.match(migration, /analytics_read_models/);
  assert.match(migration, /idx_treasury_movements_category_status_date/);
  assert.match(migration, /schema_version', '4'/);
});

test('dashboard usa uma agregação SQL por período e separa realizado de programado', async () => {
  const fixture = await databaseFixture();
  const analytics = await queryD1DashboardAnalytics(fixture.env, { start: '2026-08-01', end: '2026-08-31' });
  assert.equal(analytics.source, 'd1');
  assert.equal(analytics.treasury.total, 4);
  assert.equal(analytics.treasury.entryCount, 3);
  assert.equal(analytics.treasury.exitCount, 1);
  assert.equal(analytics.treasury.entriesValue, 165);
  assert.equal(analytics.treasury.exitsValue, 30);
  assert.equal(analytics.treasury.balance, 135);
  assert.equal(analytics.treasury.programmed.count, 1);
  assert.equal(analytics.treasury.realized.count, 3);

  const model = createAdminDashboardModel({ treasury: [], events: [], meetings: [], birthdays: [], notices: [] }, { periodPreset: 'all' });
  applyD1TreasuryAnalytics(model, analytics);
  assert.equal(model.treasury.dataSource, 'd1');
  assert.equal(model.treasury.total, 4);
  assert.equal(model.treasury.balance, 135);
  fixture.database.close();
});

test('relatórios privados carregam somente os recortes relacionais necessários', async () => {
  const fixture = await databaseFixture();
  const movements = await queryD1ReportState(fixture.env, 'movements', { start: '2026-08-01', end: '2026-08-31' });
  assert.deepEqual(movements.state.treasury.map(item => item.id), ['mov-1', 'mov-2', 'mov-3', 'mov-4']);
  assert.equal(movements.state.treasuryAccounts.length, 1);

  const memberships = await queryD1ReportState(fixture.env, 'memberships', { start: '2026-08-01', end: '2026-08-31' });
  assert.deepEqual(memberships.state.treasury.map(item => item.id), ['mov-3']);
  assert.equal(memberships.state.familyGroups.length, 1);

  const mutuals = await queryD1ReportState(fixture.env, 'mutuals', { start: '2026-08-01', end: '2026-08-31' });
  assert.deepEqual(mutuals.state.treasury.map(item => item.id), ['mov-4']);
  assert.equal(mutuals.state.mutualGroups.length, 1);
  fixture.database.close();
});


test('cliente consulta dashboard e relatório com sessão autenticada e filtros de período', async () => {
  const workerUrl = 'https://lions-portal-anexos.example.workers.dev';
  const state = { settings: { secureStorage: { enabled: true, workerUrl } } };
  setActiveSecureStorageSession({
    workerUrl,
    role: 'admin',
    token: 'session-token',
    expiresAt: Date.now() + 600_000
  });
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ source: 'd1', state: {}, treasury: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    await loadD1DashboardAnalytics(state, { start: '2026-08-01', end: '2026-08-31' });
    await loadD1ReportState(state, 'movements', { start: '2026-08-01', end: '2026-08-31' });
  } finally {
    globalThis.fetch = originalFetch;
    clearSecureStorageSession();
  }
  assert.match(calls[0].url, /\/api\/analytics\/dashboard\?start=2026-08-01&end=2026-08-31$/);
  assert.match(calls[1].url, /\/api\/analytics\/report\?type=movements&start=2026-08-01&end=2026-08-31$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer session-token');
});
