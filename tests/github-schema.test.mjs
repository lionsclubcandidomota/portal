import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_SCHEMA_VERSION } from '../assets/js/core/portal-schema.js';
import { PUBLIC_DATA_CONFIG, loadPublicD1Payload } from '../assets/js/public-data.js';
import { mergePortalStates } from '../assets/js/modules/portal-runtime/domain.js?v=6.47.2';
import {
  getD1PublicStatus,
  migrateLegacyPublicStateToD1,
  publicPublicationStatus,
  readD1PublicState,
  writeD1PublicState
} from '../cloudflare/attachment-worker/src/d1-public.js';
import { getD1StorageStatus } from '../cloudflare/attachment-worker/src/d1-storage.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class SQLitePreparedStatement {
  constructor(database, sql, values = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values) { return new SQLitePreparedStatement(this.database, this.sql, values); }
  first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  result() {
    const statement = this.database.prepare(this.sql);
    if (statement.columns().length) return { results: statement.all(...this.values) };
    const result = statement.run(...this.values);
    return { success: true, meta: { changes: Number(result.changes || 0) }, results: [] };
  }
}

class SQLiteD1Database {
  constructor(database) { this.database = database; this.queries = []; }
  prepare(sql) { this.queries.push(sql); return new SQLitePreparedStatement(this.database, sql); }
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

class MemoryR2Bucket {
  constructor() { this.objects = new Map(); this.putCalls = 0; this.deleteCalls = 0; }
  async put(key, value, options = {}) {
    this.putCalls += 1;
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    this.objects.set(key, { bytes, options });
    return { key };
  }
  async get(key) {
    const item = this.objects.get(key);
    if (!item) return null;
    return {
      body: item.bytes,
      httpEtag: `\"${item.options?.customMetadata?.checksum || key}\"`,
      customMetadata: item.options?.customMetadata || {},
      writeHttpMetadata(headers) {
        headers.set('Content-Type', item.options?.httpMetadata?.contentType || 'application/octet-stream');
      }
    };
  }
  async delete(keys) {
    this.deleteCalls += 1;
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
  }
}

async function createFixture() {
  const database = new DatabaseSync(':memory:');
  const migrationDirectory = path.join(projectRoot, 'cloudflare/attachment-worker/migrations');
  const migrations = (await readdir(migrationDirectory))
    .filter(name => /^\d{4}_.+\.sql$/.test(name))
    // Esta suíte valida a migração inicial a partir de um banco estruturalmente
    // atualizado, porém ainda sem a recuperação corretiva de dados da 0011.
    .filter(name => name !== '0011_recover_public_members_20260804.sql')
    .sort();
  for (const migration of migrations) {
    database.exec(await readFile(path.join(migrationDirectory, migration), 'utf8'));
  }
  const env = {
    PORTAL_DB: new SQLiteD1Database(database),
    ATTACHMENTS: new MemoryR2Bucket(),
    PUBLIC_DATA_URL: 'https://portal.example/data/dados.json'
  };
  return { database, env };
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function publicState() {
  return {
    settings: {
      clubName: 'Lions Clube de Cândido Mota',
      logo: './public/logo.png',
      primaryColor: '#00529B',
      accentColor: '#F2C100',
      initialized: true,
      accessProfiles: { director: { enabled: true, label: 'Diretoria' } }
    },
    birthdays: [{
      id: 'member-1', memberNumber: '001', name: 'Associada Teste', birthDate: '1980-08-10',
      photo: './public/members/member-1.jpg', status: 'Ativo', active: true, mutual: true
    }],
    events: [{ id: 'event-1', name: 'Campanha', date: '2026-08-20', status: 'Agendado' }],
    meetings: [{ id: 'meeting-1', theme: 'Reunião ordinária', date: '2026-08-22' }],
    notices: [{ id: 'notice-1', title: 'Aviso', date: '2026-08-08', endDate: '2026-08-12', priority: 'Alta' }],
    treasuryAccounts: [], treasuryCategories: [], familyGroups: [], mutualGroups: [], treasury: []
  };
}

const mediaAssets = [
  { path: 'public/logo.png', content: Buffer.from('logo').toString('base64'), encoding: 'base64', contentType: 'image/png', kind: 'club-logo', ownerId: 'settings' },
  { path: 'public/members/member-1.jpg', content: Buffer.from('photo').toString('base64'), encoding: 'base64', contentType: 'image/jpeg', kind: 'member-photo', ownerId: 'member-1' }
];

test('configuração pública usa o Worker/D1 sem credencial ou API do GitHub no navegador', async () => {
  assert.equal(PUBLIC_DATA_CONFIG.source, 'cloudflare-d1');
  assert.match(PUBLIC_DATA_CONFIG.workerUrl, /^https:\/\/.+\.workers\.dev$/);
  assert.equal(PUBLIC_DATA_CONFIG.statePath, '/api/public/state');
  const browserModule = await readFile(path.join(projectRoot, 'assets/js/public-data.js'), 'utf8');
  assert.doesNotMatch(browserModule, /api\.github\.com|Authorization:\s*`Bearer|GITHUB_TOKEN|saveGitHubState|connectGitHub/);
  assert.match(browserModule, /loadPublicD1Payload/);
});

test('carregamento público do D1 remove coleções e configurações privadas', async t => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    app: 'Lions', schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: '2026-08-07T12:00:00.000Z',
    revision: 'pub-test', deploymentId: 'pub-test',
    data: {
      settings: { clubName: 'Portal D1', membershipMonthlyFee: 99, accessProfiles: { director: { enabled: true, passwordHash: 'private' } } },
      birthdays: [], events: [], meetings: [], notices: [], treasury: [{ id: 'private' }]
    }
  });
  t.after(() => { globalThis.fetch = previousFetch; });

  const payload = await loadPublicD1Payload('https://worker.example/api/public/state');
  assert.equal(payload.state.settings.clubName, 'Portal D1');
  assert.equal('membershipMonthlyFee' in payload.state.settings, false);
  assert.equal('passwordHash' in (payload.state.settings.accessProfiles?.director || {}), false);
  assert.deepEqual(payload.state.treasury, []);
  assert.equal(payload.revision, 'pub-test');
});

test('cliente público reaproveita o payload quando o D1 responde 304 por ETag', async t => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  let call = 0;
  globalThis.fetch = async (_url, options = {}) => {
    requests.push(options);
    call += 1;
    if (call === 1) {
      return jsonResponse({
        app: 'Lions', schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: '2026-08-07T13:00:00.000Z',
        revision: 'pub-etag', deploymentId: 'pub-etag',
        data: { settings: { clubName: 'Cache D1' }, birthdays: [], events: [], meetings: [], notices: [] }
      }, 200, { ETag: '"pub-etag"' });
    }
    return new Response(null, { status: 304, headers: { ETag: '"pub-etag"' } });
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const url = 'https://worker.example/api/public/state?etag-test=1';
  const first = await loadPublicD1Payload(url);
  const second = await loadPublicD1Payload(url);
  assert.equal(first.revision, 'pub-etag');
  assert.equal(second.state.settings.clubName, 'Cache D1');
  assert.equal(requests[1].headers['If-None-Match'], '"pub-etag"');
  assert.equal(requests[1].cache, 'no-cache');
});

test('estado de migração pendente preserva aniversariantes já disponíveis no cache local', async t => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    migrationPending: true,
    migrationMessage: 'Recuperação em andamento',
    settings: { secureStorage: { enabled: true, workerUrl: 'https://worker.example' } },
    birthdays: [], events: [], meetings: [], notices: []
  });
  t.after(() => { globalThis.fetch = previousFetch; });

  const payload = await loadPublicD1Payload('https://worker.example/api/public/state?pending-test=1');
  const cached = {
    settings: { clubName: 'Lions' },
    birthdays: [{ id: 'member-cache', name: 'Associada em cache', birthDate: '1980-08-10' }],
    events: [{ id: 'event-cache' }], meetings: [], notices: []
  };
  const merged = mergePortalStates(cached, payload.state);

  assert.equal(payload.migrationPending, true);
  assert.equal(merged.birthdays.length, 1);
  assert.equal(merged.events.length, 1);
  assert.equal(merged.settings.secureStorage.enabled, true);
});

test('D1 armazena todo conteúdo estruturado público e o R2 armazena somente as mídias', async () => {
  const { database, env } = await createFixture();
  const storage = await getD1StorageStatus(env);
  assert.equal(storage.schemaVersion, 9);

  const result = await writeD1PublicState(env, {
    state: publicState(), schemaVersion: CURRENT_SCHEMA_VERSION,
    commitMessage: 'Migra conteúdo público para o banco', mediaAssets
  }, { sub: 'administrador' });

  assert.equal(result.source, 'd1');
  assert.equal(result.counts.members, 1);
  assert.equal(result.counts.events, 1);
  assert.equal(env.ATTACHMENTS.objects.size, 2);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_members').get().total, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_public_events').get().total, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_public_meetings').get().total, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_public_notices').get().total, 1);

  const record = await readD1PublicState(env, 'https://worker.example/api/public/state');
  assert.equal(record.found, true);
  assert.equal(record.envelope.data.settings.clubName, 'Lions Clube de Cândido Mota');
  assert.match(record.envelope.data.settings.logo, /^https:\/\/worker\.example\/api\/public\/media\?key=public%2Flogo\.png$/);
  assert.match(record.envelope.data.birthdays[0].photo, /api\/public\/media\?key=public%2Fmembers%2Fmember-1\.jpg/);
  assert.deepEqual(record.envelope.data.treasury, []);

  const status = await getD1PublicStatus(env);
  assert.equal(status.active, true);
  assert.equal(status.migrationComplete, true);
  assert.equal(status.counts.members, 1);
  assert.equal(status.counts.media, 2);
  database.close();
});

test('revalidação pública lê somente metadados quando a revisão do navegador continua atual', async () => {
  const { database, env } = await createFixture();
  const result = await writeD1PublicState(env, { state: publicState(), mediaAssets }, { sub: 'admin' });
  env.PORTAL_DB.queries.length = 0;

  const record = await readD1PublicState(env, 'https://worker.example/api/public/state', {
    ifNoneMatch: `"${result.revision}"`
  });

  assert.equal(record.notModified, true);
  assert.equal(record.etag, `"${result.revision}"`);
  const sql = env.PORTAL_DB.queries.join('\n');
  assert.doesNotMatch(sql, /FROM portal_members ORDER BY/i);
  assert.doesNotMatch(sql, /FROM portal_public_events ORDER BY/i);
  assert.doesNotMatch(sql, /COUNT\(\*\)/i);
  database.close();
});

test('falha no lote do D1 remove as novas mídias enviadas ao R2', async () => {
  const { database, env } = await createFixture();
  env.PORTAL_DB.batch = async () => { throw new Error('Falha simulada no D1'); };
  await assert.rejects(
    writeD1PublicState(env, { state: publicState(), mediaAssets }, { sub: 'admin' }),
    /Falha simulada no D1/
  );
  assert.equal(env.ATTACHMENTS.objects.size, 0);
  assert.ok(env.ATTACHMENTS.deleteCalls >= 1);
  database.close();
});

test('D1 bloqueia dados privados e conflitos de revisão antes de alterar tabelas ou R2', async () => {
  const { database, env } = await createFixture();
  await assert.rejects(
    writeD1PublicState(env, { state: { ...publicState(), treasury: [{ id: 'private' }] } }, { sub: 'admin' }),
    /dados privados/i
  );
  assert.equal(env.ATTACHMENTS.putCalls, 0);

  const first = await writeD1PublicState(env, { state: publicState(), mediaAssets }, { sub: 'admin' });
  const before = database.prepare('SELECT COUNT(*) AS total FROM portal_public_publications').get().total;
  await assert.rejects(
    writeD1PublicState(env, {
      state: publicState(), expectedPublicRevision: 'revision-obsoleta', mediaAssets: []
    }, { sub: 'admin' }),
    /Conflito de edição/i
  );
  assert.match(first.revision, /^pub-/);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_public_publications').get().total, before);
  database.close();
});

test('migração inicial importa JSON legado e mídias públicas para D1/R2 uma única vez', async t => {
  const { database, env } = await createFixture();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const target = String(url);
    if (target.startsWith(env.PUBLIC_DATA_URL)) {
      return jsonResponse({ schemaVersion: CURRENT_SCHEMA_VERSION, data: publicState() });
    }
    if (target === 'https://portal.example/public/logo.png') {
      return new Response(Buffer.from('legacy-logo'), { status: 200, headers: { 'Content-Type': 'image/png' } });
    }
    if (target === 'https://portal.example/public/members/member-1.jpg') return new Response('removida', { status: 404 });
    throw new Error(`URL inesperada na migração: ${target}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const migrated = await migrateLegacyPublicStateToD1(env, { sub: 'admin' });
  assert.equal(migrated.source, 'd1');
  assert.equal(migrated.missingMediaCount, 1);
  assert.equal(env.ATTACHMENTS.objects.size, 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS total FROM portal_members').get().total, 1);
  const repeated = await migrateLegacyPublicStateToD1(env, { sub: 'admin' });
  assert.equal(repeated.alreadyMigrated, true);

  const status = await publicPublicationStatus(env);
  assert.equal(status.available, true);
  assert.equal(status.databaseReady, true);
  assert.equal(status.source, 'd1');
  database.close();
});

test('migração recupera associados do diretório relacional quando o JSON legado não está mais disponível', async t => {
  const { database, env } = await createFixture();
  const member = publicState().birthdays[0];
  database.prepare(`INSERT INTO portal_members
    (id, sort_order, name, member_number, status, active, mutual, payload, updated_at)
    VALUES (?, 0, ?, ?, ?, 1, 0, ?, ?)`)
    .run(member.id, member.name, member.memberNumber, member.status, JSON.stringify(member), '2026-08-07T12:00:00.000Z');

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).startsWith(env.PUBLIC_DATA_URL)) return new Response('não encontrado', { status: 404 });
    throw new Error(`URL inesperada: ${url}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const migrated = await migrateLegacyPublicStateToD1(env, { sub: 'public-bootstrap' }, { repairEmpty: true });
  const record = await readD1PublicState(env, 'https://worker.example/api/public/state');

  assert.equal(migrated.recoveredFromD1, true);
  assert.match(migrated.legacyWarning, /404/);
  assert.equal(record.found, true);
  assert.equal(record.envelope.data.birthdays.length, 1);
  assert.equal(record.envelope.data.birthdays[0].name, 'Associada Teste');
  database.close();
});
