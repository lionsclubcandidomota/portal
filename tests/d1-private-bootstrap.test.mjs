import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyD1ReferenceMutation,
  getD1StorageStatus,
  readD1PrivateBootstrap,
  readD1PrivateState,
  writeD1PrivateState
} from '../cloudflare/attachment-worker/src/d1-storage.js';
import {
  createReferencePrivateMutation,
  savePrivateReferenceMutation
} from '../assets/js/modules/secure-storage/private-mutations.js';
import {
  clearSecureStorageSession,
  setActiveSecureStorageSession,
  setSecureStoragePrivateRevision
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

async function fixture() {
  const database = new DatabaseSync(':memory:');
  for (const migration of [
    '0001_portal_private_state.sql',
    '0003_treasury_granular_writes.sql',
    '0004_group_granular_writes.sql',
    '0005_analytics_read_models.sql',
    '0006_relational_operational_source.sql',
    '0007_operational_memberships_mutuals.sql',
    '0008_private_bootstrap_reference.sql'
  ]) {
    database.exec(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations', migration), 'utf8'));
  }
  const env = { PORTAL_DB: new SQLiteD1Database(database) };
  const state = {
    version: 11,
    settings: { membershipMonthlyFee: 40, membershipFamilyPrimaryFee: 35 },
    treasuryAccounts: [{ id: 'acc-1', name: 'Conta principal', type: 'Conta corrente', active: true }],
    treasuryCategories: ['Mensalidades', 'Mútuas', 'Projetos'],
    familyGroups: [{ id: 'fam-1', name: 'Família', memberIds: ['m-1'], primaryMemberId: 'm-1' }],
    mutualGroups: [{
      id: 'mut-1', name: 'Mútua 658', createdDate: '2026-01-01',
      memberships: [{ id: 'mum-1', memberId: 'm-1', joinedDate: '2026-01-01', endedDate: '' }],
      events: [{ id: 'mue-1', deceasedName: 'Associado', deathDate: '2026-08-01', amountPerParticipant: 20, participantIds: ['m-1'] }]
    }],
    treasury: [
      { id: 'ordinary-1', date: '2026-07-01', category: 'Projetos', entry: 100, exit: 0, status: 'Recebido', attachments: [] },
      { id: 'membership-1', date: '2026-08-01', category: 'Mensalidades', entry: 40, exit: 0, status: 'Recebido', memberId: 'm-1', coveredMonths: ['2026-08'], attachments: [] },
      { id: 'mutual-1', date: '2026-08-02', category: 'Mútuas', entry: 20, exit: 0, status: 'Recebido', mutualGroupId: 'mut-1', mutualEventId: 'mue-1', mutualMemberId: 'm-1', attachments: [] }
    ]
  };
  await writeD1PrivateState(env, state, {
    revision: 'revision-bootstrap', updatedAt: '2026-08-07T20:00:00.000Z', updatedBy: 'teste', checksum: 'checksum', activate: true,
    storageStatus: await getD1StorageStatus(env)
  });
  return { database, env, state };
}

test('bootstrap privado carrega referências e somente o conjunto financeiro necessário', async () => {
  const { database, env } = await fixture();
  const status = await getD1StorageStatus(env);
  assert.equal(status.schemaVersion, 8);
  assert.equal(status.privateBootstrapReadModel, true);
  const result = await readD1PrivateBootstrap(env, { storageStatus: status });
  assert.equal(result.partial, true);
  assert.equal(result.totalMovementCount, 3);
  assert.deepEqual(result.state.treasury.map(item => item.id), ['membership-1', 'mutual-1']);
  assert.equal(result.state.familyGroups.length, 1);
  assert.equal(result.state.mutualGroups[0].events[0].participantIds[0], 'm-1');
  database.close();
});

test('alteração granular de referências preserva movimentos e grupos relacionais', async () => {
  const { database, env, state } = await fixture();
  const nextState = structuredClone(state);
  nextState.settings.membershipMonthlyFee = 45;
  nextState.treasuryAccounts.push({ id: 'acc-2', name: 'Caixa', type: 'Dinheiro', active: true });
  nextState.treasuryCategories.push('Eventos');
  const result = await applyD1ReferenceMutation(env, {
    mutationId: 'reference-test-001', expectedRevision: 'revision-bootstrap', revision: 'revision-reference',
    updatedAt: '2026-08-07T21:00:00.000Z', updatedBy: 'teste', checksum: 'checksum-2', nextState,
    storageStatus: await getD1StorageStatus(env)
  });
  assert.equal(result.mode, 'granular-reference');
  const restored = await readD1PrivateState(env);
  assert.equal(restored.state.settings.membershipMonthlyFee, 45);
  assert.equal(restored.state.treasuryAccounts.length, 2);
  assert.equal(restored.state.treasury.length, 3);
  assert.equal(restored.state.mutualGroups.length, 1);
  database.close();
});

test('cliente detecta mudança isolada de configurações, contas e categorias', () => {
  const previous = {
    settings: { membershipMonthlyFee: 40 }, treasuryAccounts: [{ id: 'a', name: 'Conta' }], treasuryCategories: ['A'],
    familyGroups: [], mutualGroups: [], treasury: []
  };
  const next = structuredClone(previous);
  next.settings.membershipMonthlyFee = 42;
  const mutation = createReferencePrivateMutation(previous, next);
  assert.equal(mutation.scope, 'reference');
  assert.equal(mutation.reference.settings.membershipMonthlyFee, 42);
});

test('cliente envia referências privadas para a rota granular autenticada', async () => {
  const workerUrl = 'https://lions-portal-anexos.exemplo.workers.dev';
  const state = { settings: { secureStorage: { enabled: true, workerUrl } } };
  setActiveSecureStorageSession({ workerUrl, token: 'session-token', role: 'admin', expiresAt: Date.now() + 120_000 });
  setSecureStoragePrivateRevision('revision-before');
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ revision: 'revision-after', mode: 'granular-reference', changes: { settings: 1 } }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    const result = await savePrivateReferenceMutation(state, {
      scope: 'reference', reference: { settings: { membershipMonthlyFee: 50 }, treasuryAccounts: [], treasuryCategories: [] }
    }, { mutationId: 'reference-client-001' });
    assert.match(request.url, /\/api\/private-state\/reference$/);
    const body = JSON.parse(request.options.body);
    assert.equal(body.expectedRevision, 'revision-before');
    assert.equal(body.reference.settings.membershipMonthlyFee, 50);
    assert.equal(result.mode, 'granular-reference');
  } finally {
    globalThis.fetch = originalFetch;
    clearSecureStorageSession();
  }
});
