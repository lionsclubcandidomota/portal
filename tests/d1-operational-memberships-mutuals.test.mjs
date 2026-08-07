import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  queryD1OperationalMemberships,
  queryD1OperationalMutuals
} from '../cloudflare/attachment-worker/src/d1-operational-memberships.js';
import { getD1StorageStatus, writeD1PrivateState } from '../cloudflare/attachment-worker/src/d1-storage.js';
import {
  loadD1OperationalMemberships,
  loadD1OperationalMutuals
} from '../assets/js/modules/secure-storage/operational-memberships-client.js';
import {
  clearSecureStorageSession,
  setActiveSecureStorageSession
} from '../assets/js/modules/secure-storage/session-store.js?v=6.46.0';

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

const publicMembers = [
  { id: 'm1', name: 'Ana', memberNumber: '1', status: 'Ativo', active: true },
  { id: 'm2', name: 'Bruno', memberNumber: '2', status: 'Ativo', active: true },
  { id: 'mu1', name: 'Carlos', memberNumber: '3', status: 'Mútua', active: true }
];

async function fixture() {
  const database = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_portal_private_state.sql',
    '0003_treasury_granular_writes.sql',
    '0004_group_granular_writes.sql',
    '0005_analytics_read_models.sql',
    '0006_relational_operational_source.sql',
    '0007_operational_memberships_mutuals.sql'
  ]) database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations', migration), 'utf8'));
  const env = {
    PORTAL_DB: new SQLiteD1Database(database),
    PUBLIC_DATA_URL: 'https://portal.example/data/dados.json'
  };
  const state = {
    version: 11,
    settings: { membershipMonthlyFee: 50 },
    treasuryAccounts: [{ id: 'acc', name: 'Principal', active: true }],
    treasuryCategories: ['Mensalidades', 'Mútuas'],
    familyGroups: [{ id: 'fg1', name: 'Família Silva', primaryMemberId: 'm1', memberIds: ['m1', 'm2'] }],
    mutualGroups: [{
      id: 'mg1', name: 'Mútua 658', createdDate: '2026-01-01', closedDate: '',
      memberships: [
        { id: 'mm1', memberId: 'm1', joinedDate: '2026-01-01', endedDate: '' },
        { id: 'mm2', memberId: 'mu1', joinedDate: '2026-01-01', endedDate: '' }
      ],
      events: [{
        id: 'ev1', deceasedName: 'Associado do Distrito', deathDate: '2026-08-02',
        amountPerParticipant: 30, participantIds: ['m1', 'mu1'], cancelledAt: ''
      }]
    }],
    treasury: [
      { id: 'pay1', date: '2026-07-10', category: 'Mensalidades', status: 'Recebido', entry: 50, exit: 0, memberId: 'm1', memberIds: ['m1'], coveredMonths: ['2026-07'] },
      { id: 'mut1', date: '2026-08-05', category: 'Mútuas', status: 'Recebido', entry: 30, exit: 0, mutualGroupId: 'mg1', mutualEventId: 'ev1', mutualMemberId: 'm1', memberId: 'm1' }
    ]
  };
  await writeD1PrivateState(env, state, {
    revision: 'rev-1', updatedAt: '2026-08-07T12:00:00.000Z', updatedBy: 'teste', checksum: 'sum',
    activate: true, storageStatus: await getD1StorageStatus(env)
  });
  return { database, env };
}

async function withPublicFetch(callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { birthdays: publicMembers } }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
  try { return await callback(); } finally { globalThis.fetch = originalFetch; }
}

test('mensalidades usam diretório público, pagamentos relacionais e paginação no D1', async () => {
  const { database, env } = await fixture();
  const result = await withPublicFetch(() => queryD1OperationalMemberships(env, {
    start: '2026-07', end: '2026-08', page: 1, pageSize: 1, status: 'all'
  }));
  assert.equal(result.source, 'd1-relational');
  assert.equal(result.summary.members, 2);
  assert.equal(result.summary.expectedUnits, 4);
  assert.equal(result.summary.paidUnits, 1);
  assert.equal(result.summary.totalReceived, 50);
  assert.equal(result.total, 2);
  assert.equal(result.pages, 2);
  assert.deepEqual(result.items[0].paidMonths, ['2026-07']);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_members').get().total, 3);
  database.close();
});

test('Mútuas retornam eventos paginados e separam cobranças pagas das pendentes', async () => {
  const { database, env } = await fixture();
  const result = await withPublicFetch(() => queryD1OperationalMutuals(env, {
    group: 'mg1', start: '2026-08-01', end: '2026-08-31', status: 'pending', page: 1
  }));
  assert.equal(result.summary.events, 1);
  assert.equal(result.summary.charges, 2);
  assert.equal(result.summary.paid, 1);
  assert.equal(result.summary.pending, 1);
  assert.equal(result.events.length, 1);
  assert.deepEqual(result.events[0].visibleCharges.map(item => item.member.id), ['mu1']);
  assert.equal(result.pageGroups[0].currentMembers.length, 2);
  database.close();
});

test('clientes operacionais enviam filtros, paginação e sessão para as novas rotas', async () => {
  const workerUrl = 'https://lions-portal-anexos.example.workers.dev';
  const state = { settings: { secureStorage: { enabled: true, workerUrl } } };
  setActiveSecureStorageSession({ workerUrl, role: 'admin', token: 'token', expiresAt: Date.now() + 60_000 });
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify({ source: 'd1-relational', items: [], events: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    await loadD1OperationalMemberships(state, { start: '2026-07', end: '2026-08', family: 'fg1', status: 'pending', page: 2 });
    await loadD1OperationalMutuals(state, { group: 'mg1', status: 'paid', page: 3 });
  } finally {
    globalThis.fetch = originalFetch;
    clearSecureStorageSession();
  }
  assert.match(calls[0].url, /\/api\/operational\/memberships\?/);
  assert.match(calls[0].url, /family=fg1/);
  assert.match(calls[0].url, /page=2/);
  assert.match(calls[1].url, /\/api\/operational\/mutuals\?/);
  assert.match(calls[1].url, /group=mg1/);
  assert.match(calls[1].url, /page=3/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
});
