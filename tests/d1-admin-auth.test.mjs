import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AUTH_PASSWORD_ITERATIONS,
  authenticateAdministrator,
  bootstrapAdministrator,
  getAuthenticationStatus,
  requireAuthenticationSession,
  revokeAuthenticationSession
} from '../cloudflare/attachment-worker/src/auth.js';
import {
  clearSecureStorageSession,
  connectSecureStorageSession,
  getAuthenticationStatus as getClientAuthenticationStatus
} from '../assets/js/modules/secure-storage/client.js';

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

async function authDatabase() {
  const database = new DatabaseSync(':memory:');
  const first = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0001_portal_private_state.sql'), 'utf8');
  const second = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0002_admin_auth.sql'), 'utf8');
  database.exec(first);
  database.exec(second);
  return database;
}

function request(pathname = '/api/session', init = {}) {
  return new Request(`https://worker.example${pathname}`, {
    method: init.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.10',
      'User-Agent': 'Portal test',
      ...(init.headers || {})
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
}

test('migração de autenticação cria usuários, sessões e auditoria no D1', async () => {
  const migration = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/migrations/0002_admin_auth.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS portal_users/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS portal_auth_sessions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS portal_auth_audit/);
  assert.match(migration, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(migration, /password_hash TEXT NOT NULL/);
  assert.match(migration, /FOREIGN KEY \(user_id\) REFERENCES portal_users\(id\) ON DELETE CASCADE/);
});

test('primeiro Administrador é criado uma única vez e a senha fica derivada no D1', async () => {
  const database = await authDatabase();
  const env = {
    PORTAL_DB: new SQLiteD1Database(database),
    ADMIN_BOOTSTRAP_KEY: 'codigo-de-ativacao-com-mais-de-24-caracteres',
    GITHUB_TOKEN: 'segredo-github-do-worker',
    SESSION_TTL_SECONDS: '1800'
  };

  const before = await getAuthenticationStatus(env);
  assert.equal(before.bootstrapRequired, true);
  assert.equal(before.passwordLogin, false);

  const created = await bootstrapAdministrator(request('/api/auth/bootstrap'), env, {
    setupKey: env.ADMIN_BOOTSTRAP_KEY,
    displayName: 'João Administrador',
    username: 'Administrador',
    password: 'SenhaSegura123'
  });
  assert.deepEqual(created, {
    created: true,
    username: 'administrador',
    displayName: 'João Administrador'
  });

  const stored = database.prepare('SELECT * FROM portal_users').get();
  assert.equal(stored.username, 'administrador');
  assert.notEqual(stored.password_hash, 'SenhaSegura123');
  assert.equal(stored.password_hash.length, 64);
  assert.equal(stored.salt.length, 32);
  assert.equal(stored.password_iterations, AUTH_PASSWORD_ITERATIONS);

  const after = await getAuthenticationStatus(env);
  assert.equal(after.bootstrapRequired, false);
  assert.equal(after.passwordLogin, true);
  assert.equal(after.publicationAvailable, true);

  await assert.rejects(
    bootstrapAdministrator(request('/api/auth/bootstrap'), env, {
      setupKey: env.ADMIN_BOOTSTRAP_KEY,
      displayName: 'Outro',
      username: 'outro',
      password: 'OutraSenha123'
    }),
    /já foi criado/i
  );
  database.close();
});

test('login cria sessão opaca persistida apenas pelo hash e logout a revoga', async () => {
  const database = await authDatabase();
  const env = {
    PORTAL_DB: new SQLiteD1Database(database),
    ADMIN_BOOTSTRAP_KEY: 'codigo-de-ativacao-com-mais-de-24-caracteres',
    GITHUB_TOKEN: 'segredo-github-do-worker',
    SESSION_TTL_SECONDS: '1800'
  };
  await bootstrapAdministrator(request('/api/auth/bootstrap'), env, {
    setupKey: env.ADMIN_BOOTSTRAP_KEY,
    displayName: 'Administrador',
    username: 'admin',
    password: 'SenhaSegura123'
  });

  const session = await authenticateAdministrator(request(), env, {
    username: 'ADMIN',
    password: 'SenhaSegura123'
  });
  assert.equal(session.role, 'admin');
  assert.equal(session.user.username, 'admin');
  assert.equal(session.publication.available, true);
  assert.ok(session.token.length >= 40);

  const stored = database.prepare('SELECT token_hash, subject, revoked_at FROM portal_auth_sessions').get();
  assert.notEqual(stored.token_hash, session.token);
  assert.equal(stored.token_hash.length, 64);
  assert.equal(stored.subject, 'admin');
  assert.equal(stored.revoked_at, '');

  const authenticatedRequest = request('/api/private-state', {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.token}` }
  });
  const actor = await requireAuthenticationSession(authenticatedRequest, env, ['admin']);
  assert.equal(actor.sub, 'admin');

  await revokeAuthenticationSession(authenticatedRequest, env);
  await assert.rejects(
    requireAuthenticationSession(authenticatedRequest, env, ['admin']),
    error => error instanceof Response && error.status === 401
  );
  database.close();
});

test('cliente envia usuário e senha ao Worker e nunca solicita token GitHub no login', async t => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    calls.push({ pathname, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (pathname === '/api/auth/status') {
      return new Response(JSON.stringify({ initialized: true, bootstrapRequired: false, passwordLogin: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (pathname === '/api/session') {
      return new Response(JSON.stringify({
        token: 'session-token-opaco',
        role: 'admin',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        user: { username: 'administrador', displayName: 'Administrador' },
        publication: { available: true }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`Rota inesperada: ${pathname}`);
  };
  t.after(() => {
    clearSecureStorageSession();
    globalThis.fetch = previousFetch;
  });

  const state = { settings: { secureStorage: { enabled: true, workerUrl: 'https://portal-test.workers.dev' } } };
  const status = await getClientAuthenticationStatus(state);
  assert.equal(status.passwordLogin, true);
  await connectSecureStorageSession({
    state,
    role: 'admin',
    username: 'administrador',
    password: 'SenhaSegura123'
  });

  const login = calls.find(call => call.pathname === '/api/session');
  assert.deepEqual(login.body, {
    role: 'admin',
    username: 'administrador',
    password: 'SenhaSegura123'
  });
  assert.equal('credential' in login.body, false);
});
