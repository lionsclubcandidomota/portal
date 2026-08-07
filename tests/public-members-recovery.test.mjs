import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeD1PublicState } from '../cloudflare/attachment-worker/src/d1-public.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationRoot = path.join(projectRoot, 'cloudflare/attachment-worker/migrations');

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

async function applyMigration(database, filename) {
  database.exec(await readFile(path.join(migrationRoot, filename), 'utf8'));
}

async function baseDatabase() {
  const database = new DatabaseSync(':memory:');
  for (const filename of [
    '0001_portal_private_state.sql',
    '0002_admin_auth.sql',
    '0003_treasury_granular_writes.sql',
    '0004_group_granular_writes.sql',
    '0005_analytics_read_models.sql',
    '0006_relational_operational_source.sql',
    '0007_operational_memberships_mutuals.sql',
    '0008_private_bootstrap_reference.sql',
    '0009_module_revisions.sql',
    '0010_public_portal_d1.sql'
  ]) await applyMigration(database, filename);
  return database;
}

test('migração corretiva restaura aniversariantes sem alterar a tesouraria', async () => {
  const database = await baseDatabase();
  database.prepare(`INSERT INTO treasury_movements
    (id, movement_date, category, status, entry_amount, exit_amount, payload, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('mov-preservada', '2026-08-01', 'Mensalidades', 'Recebido', 150, 0,
      JSON.stringify({ id: 'mov-preservada', description: 'Movimentação atual' }), '2026-08-07T12:00:00.000Z');

  const existingPayload = {
    id: 'b_ms3xe4af_85o3yp',
    name: 'João Augusto — cadastro atual',
    memberNumber: '26766037',
    birthDate: '',
    photo: 'r2://public/members/foto-atual.jpg',
    status: 'Ativo',
    active: true,
    membershipNotes: 'Informação atual preservada'
  };
  database.prepare(`INSERT INTO portal_members
    (id, sort_order, name, member_number, status, active, mutual, payload, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(existingPayload.id, 99, existingPayload.name, existingPayload.memberNumber, existingPayload.status,
      1, 0, JSON.stringify(existingPayload), '2026-08-07T12:00:00.000Z');

  await applyMigration(database, '0011_recover_public_members_20260804.sql');

  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_members').get().total, 32);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_members WHERE mutual = 1').get().total, 3);
  const recovered = database.prepare('SELECT name, sort_order, payload FROM portal_members WHERE id = ?')
    .get(existingPayload.id);
  const payload = JSON.parse(recovered.payload);
  assert.equal(recovered.name, existingPayload.name);
  assert.equal(recovered.sort_order, 99);
  assert.equal(payload.birthDate, '1995-01-02');
  assert.equal(payload.photo, existingPayload.photo);
  assert.equal(payload.membershipNotes, existingPayload.membershipNotes);

  const movement = database.prepare('SELECT entry_amount, payload FROM treasury_movements WHERE id = ?')
    .get('mov-preservada');
  assert.equal(movement.entry_amount, 150);
  assert.equal(JSON.parse(movement.payload).description, 'Movimentação atual');
  assert.equal(database.prepare("SELECT value FROM portal_meta WHERE key = 'schema_version'").get().value, '9');
  assert.equal(database.prepare("SELECT value FROM portal_meta WHERE key = 'public_revision'").get().value,
    'recovery-members-20260804-v1');

  await applyMigration(database, '0011_recover_public_members_20260804.sql');
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_members').get().total, 32);
  database.close();
});

test('publicação vazia não apaga um diretório de associados já existente', async () => {
  const database = await baseDatabase();
  await applyMigration(database, '0011_recover_public_members_20260804.sql');
  const env = { PORTAL_DB: new SQLiteD1Database(database) };

  await assert.rejects(() => writeD1PublicState(env, {
    state: { settings: {}, birthdays: [], events: [], meetings: [], notices: [] },
    schemaVersion: 11
  }, { sub: 'teste' }), /Publicação bloqueada/);

  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_members').get().total, 32);
  database.close();
});

test('status Mútua alimenta corretamente o indicador relacional mutual', async () => {
  const database = await baseDatabase();
  const env = { PORTAL_DB: new SQLiteD1Database(database) };

  await writeD1PublicState(env, {
    state: {
      settings: {},
      birthdays: [{ id: 'mutua-1', name: 'Participante', status: 'Mútua', active: true }],
      events: [], meetings: [], notices: []
    },
    schemaVersion: 11
  }, { sub: 'teste' });

  const row = database.prepare('SELECT mutual FROM portal_members WHERE id = ?').get('mutua-1');
  assert.equal(row.mutual, 1);
  database.close();
});
