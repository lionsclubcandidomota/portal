const PASSWORD_CONTEXT = 'lions-portal-admin-password-v1';
const PASSWORD_ITERATIONS = 100000;
const PASSWORD_MAX_SUPPORTED_ITERATIONS = 100000;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
const SESSION_MAX_SECONDS = 8 * 60 * 60;
const SESSION_MIN_SECONDS = 5 * 60;
const FAILED_ATTEMPT_LIMIT = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const encoder = new TextEncoder();

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeUsername(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '')
    .slice(0, 64);
}

function normalizeDisplayName(value, fallback = 'Administrador') {
  return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, 100) || fallback;
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`A senha precisa possuir pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`A senha pode possuir no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  }
  if (!/[A-Za-zÀ-ÿ]/.test(value) || !/\d/.test(value)) {
    throw new Error('A senha precisa conter pelo menos uma letra e um número.');
  }
  return value;
}

function bytesToHex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value) {
  const text = String(value || '').toLowerCase();
  if (!/^[a-f0-9]+$/.test(text) || text.length % 2) return null;
  const result = new Uint8Array(text.length / 2);
  for (let index = 0; index < text.length; index += 2) {
    result[index / 2] = Number.parseInt(text.slice(index, index + 2), 16);
  }
  return result;
}

function randomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : encoder.encode(String(value || ''));
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

async function timingSafeTextEqual(first, second) {
  const firstDigest = hexToBytes(await sha256Hex(first));
  const secondDigest = hexToBytes(await sha256Hex(second));
  if (!firstDigest || !secondDigest || firstDigest.length !== secondDigest.length) return false;
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(firstDigest, secondDigest);
  }
  let difference = 0;
  for (let index = 0; index < firstDigest.length; index += 1) difference |= firstDigest[index] ^ secondDigest[index];
  return difference === 0;
}

async function passwordHash(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const requestedIterations = Number(iterations || PASSWORD_ITERATIONS);
  if (!Number.isInteger(requestedIterations) || requestedIterations < 1) {
    throw new Error('Quantidade de iterações da senha inválida.');
  }
  if (requestedIterations > PASSWORD_MAX_SUPPORTED_ITERATIONS) {
    throw new Error(`O hash da senha usa ${requestedIterations} iterações, acima do limite compatível de ${PASSWORD_MAX_SUPPORTED_ITERATIONS}.`);
  }
  const saltBytes = hexToBytes(saltHex);
  if (!saltBytes || saltBytes.length < 16) throw new Error('Salt de senha inválido.');
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(password || '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const context = encoder.encode(`${PASSWORD_CONTEXT}:`);
  const combinedSalt = new Uint8Array(context.length + saltBytes.length);
  combinedSalt.set(context, 0);
  combinedSalt.set(saltBytes, context.length);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: combinedSalt,
    iterations: requestedIterations
  }, material, 256);
  return bytesToHex(new Uint8Array(bits));
}

async function verifyPassword(password, user) {
  const expected = hexToBytes(String(user?.password_hash || ''));
  if (!expected) return false;
  const candidate = hexToBytes(await passwordHash(password, user.salt, user.password_iterations));
  if (!candidate || candidate.length !== expected.length) return false;
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(candidate, expected);
  }
  let difference = 0;
  for (let index = 0; index < candidate.length; index += 1) difference |= candidate[index] ^ expected[index];
  return difference === 0;
}

function sessionTtl(env) {
  return Math.min(
    SESSION_MAX_SECONDS,
    Math.max(SESSION_MIN_SECONDS, Number(env.SESSION_TTL_SECONDS || 1800))
  );
}

function clientAddress(request) {
  return String(request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '')
    .split(',')[0]
    .trim()
    .slice(0, 80);
}

function userAgent(request) {
  return String(request.headers.get('User-Agent') || '').slice(0, 240);
}

async function audit(env, {
  event,
  userId = null,
  username = '',
  outcome = 'success',
  request = null,
  details = null
}) {
  if (!env.PORTAL_DB) return;
  try {
    await env.PORTAL_DB.prepare(`
      INSERT INTO portal_auth_audit (
        id, user_id, username, event, outcome, ip_address, user_agent, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      String(username || '').slice(0, 64),
      String(event || '').slice(0, 60),
      String(outcome || '').slice(0, 20),
      request ? clientAddress(request) : '',
      request ? userAgent(request) : '',
      details ? JSON.stringify(safeObject(details)).slice(0, 3000) : '',
      nowIso()
    ).run();
  } catch (error) {
    console.warn('Falha ao registrar auditoria de autenticação:', error);
  }
}

export async function getAuthenticationStatus(env) {
  if (!env.PORTAL_DB) {
    return {
      available: false,
      initialized: false,
      bootstrapRequired: false,
      passwordLogin: false,
      publicationAvailable: Boolean(env.PORTAL_DB)
    };
  }
  try {
    const table = await env.PORTAL_DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'portal_users'"
    ).first();
    if (!table) {
      return {
        available: true,
        initialized: false,
        bootstrapRequired: false,
        passwordLogin: false,
        publicationAvailable: Boolean(env.PORTAL_DB)
      };
    }
    const result = await env.PORTAL_DB.prepare(
      "SELECT COUNT(*) AS total FROM portal_users WHERE role = 'admin' AND enabled = 1"
    ).first();
    const total = Number(result?.total || 0);
    return {
      available: true,
      initialized: true,
      bootstrapRequired: total === 0,
      passwordLogin: total > 0,
      publicationAvailable: Boolean(env.PORTAL_DB),
      emergencyLoginAvailable: false,
      passwordIterations: PASSWORD_ITERATIONS
    };
  } catch (error) {
    return {
      available: true,
      initialized: false,
      bootstrapRequired: false,
      passwordLogin: false,
      publicationAvailable: Boolean(env.PORTAL_DB),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function bootstrapAdministrator(request, env, body = {}) {
  if (!env.PORTAL_DB) throw new Error('O banco D1 não está vinculado ao Worker.');
  const expectedKey = String(env.ADMIN_BOOTSTRAP_KEY || '');
  const suppliedKey = String(body.setupKey || '');
  if (expectedKey.length < 24) {
    throw new Error('ADMIN_BOOTSTRAP_KEY ainda não foi configurada no Worker.');
  }
  if (!(await timingSafeTextEqual(expectedKey, suppliedKey))) {
    await audit(env, { event: 'bootstrap', outcome: 'denied', request });
    throw new Error('Código de ativação inválido.');
  }

  const existing = await env.PORTAL_DB.prepare(
    "SELECT COUNT(*) AS total FROM portal_users WHERE role = 'admin'"
  ).first();
  if (Number(existing?.total || 0) > 0) {
    throw new Error('O primeiro Administrador já foi criado.');
  }

  const username = normalizeUsername(body.username);
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
    throw new Error('Informe um usuário com 3 a 64 caracteres usando letras, números, ponto, hífen ou sublinhado.');
  }
  const password = validatePassword(body.password);
  const displayName = normalizeDisplayName(body.displayName, username);
  const salt = bytesToHex(randomBytes(16));
  const hash = await passwordHash(password, salt);
  const userId = crypto.randomUUID();
  const createdAt = nowIso();

  await env.PORTAL_DB.batch([
    env.PORTAL_DB.prepare(`
      INSERT INTO portal_users (
        id, username, display_name, role, password_hash, salt, password_iterations,
        enabled, must_change_password, failed_attempts, locked_until, last_login_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'admin', ?, ?, ?, 1, 0, 0, '', '', ?, ?)
    `).bind(userId, username, displayName, hash, salt, PASSWORD_ITERATIONS, createdAt, createdAt),
    env.PORTAL_DB.prepare(`
      INSERT INTO portal_meta (key, value) VALUES ('auth_initialized_at', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).bind(createdAt)
  ]);

  await audit(env, {
    event: 'bootstrap',
    userId,
    username,
    outcome: 'success',
    request,
    details: { displayName }
  });

  return { created: true, username, displayName };
}

async function dummyPasswordWork(password) {
  const salt = '00112233445566778899aabbccddeeff';
  await passwordHash(String(password || ''), salt, PASSWORD_ITERATIONS);
}

async function createDatabaseSession(env, request, {
  userId = null,
  username = '',
  displayName = '',
  role = 'admin',
  mustChangePassword = false
}) {
  const token = base64UrlEncode(randomBytes(32));
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + sessionTtl(env) * 1000).toISOString();
  const sessionId = crypto.randomUUID();
  await env.PORTAL_DB.prepare(`
    INSERT INTO portal_auth_sessions (
      id, user_id, role, subject, token_hash, created_at, expires_at,
      last_seen_at, revoked_at, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
  `).bind(
    sessionId,
    userId,
    role,
    username || role,
    tokenHash,
    createdAt,
    expiresAt,
    createdAt,
    clientAddress(request),
    userAgent(request)
  ).run();
  return {
    token,
    role,
    expiresAt,
    user: {
      id: userId || '',
      username: username || role,
      displayName: displayName || (role === 'director' ? 'Diretoria' : 'Administrador'),
      role,
      mustChangePassword: Boolean(mustChangePassword)
    },
    publication: { available: Boolean(env.PORTAL_DB) }
  };
}

export async function authenticateAdministrator(request, env, body = {}) {
  if (!env.PORTAL_DB) throw new Error('O banco D1 não está vinculado ao Worker.');
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');
  const user = username
    ? await env.PORTAL_DB.prepare(`
        SELECT * FROM portal_users WHERE username = ? COLLATE NOCASE AND role = 'admin' LIMIT 1
      `).bind(username).first()
    : null;

  if (!user) {
    await dummyPasswordWork(password);
    await audit(env, { event: 'login', username, outcome: 'failure', request });
    throw new Error('Usuário ou senha inválidos.');
  }
  if (Number(user.enabled || 0) !== 1) {
    await audit(env, { event: 'login', userId: user.id, username: user.username, outcome: 'disabled', request });
    throw new Error('Usuário ou senha inválidos.');
  }

  const lockedUntil = Date.parse(String(user.locked_until || '')) || 0;
  if (lockedUntil > Date.now()) {
    const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
    await audit(env, { event: 'login', userId: user.id, username: user.username, outcome: 'locked', request });
    throw new Error(`Acesso temporariamente bloqueado. Tente novamente em aproximadamente ${minutes} minuto(s).`);
  }

  const valid = await verifyPassword(password, user);
  if (!valid) {
    const attempts = Number(user.failed_attempts || 0) + 1;
    const nextLock = attempts >= FAILED_ATTEMPT_LIMIT
      ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
      : '';
    await env.PORTAL_DB.prepare(`
      UPDATE portal_users
      SET failed_attempts = ?, locked_until = ?, updated_at = ?
      WHERE id = ?
    `).bind(nextLock ? 0 : attempts, nextLock, nowIso(), user.id).run();
    await audit(env, { event: 'login', userId: user.id, username: user.username, outcome: 'failure', request });
    throw new Error('Usuário ou senha inválidos.');
  }

  const loggedAt = nowIso();
  await env.PORTAL_DB.prepare(`
    UPDATE portal_users
    SET failed_attempts = 0, locked_until = '', last_login_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(loggedAt, loggedAt, user.id).run();

  const session = await createDatabaseSession(env, request, {
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    mustChangePassword: Number(user.must_change_password || 0) === 1
  });
  await audit(env, { event: 'login', userId: user.id, username: user.username, outcome: 'success', request });
  return session;
}

export async function createDirectorSession(request, env, subject = 'diretoria') {
  return createDatabaseSession(env, request, {
    username: String(subject || 'diretoria'),
    displayName: 'Diretoria',
    role: 'director'
  });
}

async function sessionFromToken(env, token) {
  if (!token || !env.PORTAL_DB) return null;
  const tokenHash = await sha256Hex(token);
  return env.PORTAL_DB.prepare(`
    SELECT
      s.id AS session_id,
      s.user_id,
      s.role,
      s.subject,
      s.expires_at,
      s.revoked_at,
      u.username,
      u.display_name,
      u.enabled,
      u.must_change_password
    FROM portal_auth_sessions s
    LEFT JOIN portal_users u ON u.id = s.user_id
    WHERE s.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();
}

export async function requireAuthenticationSession(request, env, roles = []) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Response('Sessão não informada.', { status: 401 });
  const record = await sessionFromToken(env, match[1]);
  if (!record || record.revoked_at || (Date.parse(record.expires_at || '') || 0) <= Date.now()) {
    throw new Response('Sessão expirada ou inválida.', { status: 401 });
  }
  if (record.user_id && Number(record.enabled || 0) !== 1) {
    throw new Response('Usuário desativado.', { status: 401 });
  }
  if (roles.length && !roles.includes(record.role)) {
    throw new Response('Este perfil não possui permissão para esta operação.', { status: 403 });
  }
  return {
    sessionId: record.session_id,
    userId: record.user_id || '',
    role: record.role,
    sub: record.username || record.subject || record.role,
    name: record.display_name || record.subject || record.role,
    mustChangePassword: Number(record.must_change_password || 0) === 1
  };
}

export async function revokeAuthenticationSession(request, env) {
  const session = await requireAuthenticationSession(request, env, ['admin', 'director']);
  await env.PORTAL_DB.prepare(
    "UPDATE portal_auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at = ''"
  ).bind(nowIso(), session.sessionId).run();
  await audit(env, {
    event: 'logout',
    userId: session.userId || null,
    username: session.sub,
    outcome: 'success',
    request
  });
  return { revoked: true };
}

export async function listAdministratorUsers(env) {
  const result = await env.PORTAL_DB.prepare(`
    SELECT id, username, display_name, role, enabled, must_change_password,
           failed_attempts, locked_until, last_login_at, created_at, updated_at
    FROM portal_users
    ORDER BY display_name COLLATE NOCASE, username COLLATE NOCASE
  `).all();
  return (result.results || []).map(user => ({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    enabled: Number(user.enabled || 0) === 1,
    mustChangePassword: Number(user.must_change_password || 0) === 1,
    failedAttempts: Number(user.failed_attempts || 0),
    lockedUntil: user.locked_until || '',
    lastLoginAt: user.last_login_at || '',
    createdAt: user.created_at || '',
    updatedAt: user.updated_at || ''
  }));
}

export async function createAdministratorUser(request, env, actor, body = {}) {
  const username = normalizeUsername(body.username);
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
    throw new Error('Informe um usuário válido com pelo menos 3 caracteres.');
  }
  const password = validatePassword(body.password);
  const displayName = normalizeDisplayName(body.displayName, username);
  const salt = bytesToHex(randomBytes(16));
  const hash = await passwordHash(password, salt);
  const createdAt = nowIso();
  const userId = crypto.randomUUID();
  try {
    await env.PORTAL_DB.prepare(`
      INSERT INTO portal_users (
        id, username, display_name, role, password_hash, salt, password_iterations,
        enabled, must_change_password, failed_attempts, locked_until, last_login_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'admin', ?, ?, ?, 1, ?, 0, '', '', ?, ?)
    `).bind(
      userId,
      username,
      displayName,
      hash,
      salt,
      PASSWORD_ITERATIONS,
      body.mustChangePassword === false ? 0 : 1,
      createdAt,
      createdAt
    ).run();
  } catch (error) {
    if (/unique|constraint/i.test(String(error?.message || ''))) {
      throw new Error('Já existe um usuário com esse identificador.');
    }
    throw error;
  }
  await audit(env, {
    event: 'user-created',
    userId,
    username,
    outcome: 'success',
    request,
    details: { createdBy: actor.sub }
  });
  return { created: true, id: userId, username, displayName };
}

export async function updateAdministratorUser(request, env, actor, userId, body = {}) {
  const current = await env.PORTAL_DB.prepare('SELECT * FROM portal_users WHERE id = ? LIMIT 1')
    .bind(String(userId || ''))
    .first();
  if (!current) throw new Error('Usuário não encontrado.');
  const displayName = normalizeDisplayName(body.displayName, current.display_name);
  const enabled = body.enabled === undefined ? Number(current.enabled || 0) : (body.enabled ? 1 : 0);
  if (current.id === actor.userId && enabled !== 1) {
    throw new Error('O Administrador não pode desativar a própria conta.');
  }
  const updatedAt = nowIso();
  await env.PORTAL_DB.prepare(`
    UPDATE portal_users
    SET display_name = ?, enabled = ?, updated_at = ?
    WHERE id = ?
  `).bind(displayName, enabled, updatedAt, current.id).run();
  if (enabled !== 1) {
    await env.PORTAL_DB.prepare(
      "UPDATE portal_auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''"
    ).bind(updatedAt, current.id).run();
  }
  await audit(env, {
    event: 'user-updated',
    userId: current.id,
    username: current.username,
    outcome: 'success',
    request,
    details: { updatedBy: actor.sub, enabled: enabled === 1 }
  });
  return { updated: true };
}

export async function resetAdministratorPassword(request, env, actor, userId, body = {}) {
  const user = await env.PORTAL_DB.prepare('SELECT * FROM portal_users WHERE id = ? LIMIT 1')
    .bind(String(userId || ''))
    .first();
  if (!user) throw new Error('Usuário não encontrado.');
  const password = validatePassword(body.password);
  const salt = bytesToHex(randomBytes(16));
  const hash = await passwordHash(password, salt);
  const updatedAt = nowIso();
  await env.PORTAL_DB.batch([
    env.PORTAL_DB.prepare(`
      UPDATE portal_users
      SET password_hash = ?, salt = ?, password_iterations = ?, must_change_password = ?,
          failed_attempts = 0, locked_until = '', updated_at = ?
      WHERE id = ?
    `).bind(hash, salt, PASSWORD_ITERATIONS, body.mustChangePassword === false ? 0 : 1, updatedAt, user.id),
    env.PORTAL_DB.prepare(
      "UPDATE portal_auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''"
    ).bind(updatedAt, user.id)
  ]);
  await audit(env, {
    event: 'password-reset',
    userId: user.id,
    username: user.username,
    outcome: 'success',
    request,
    details: { resetBy: actor.sub }
  });
  return { reset: true };
}

export async function changeOwnPassword(request, env, actor, body = {}) {
  if (!actor.userId) throw new Error('A sessão atual não está vinculada a um usuário.');
  const user = await env.PORTAL_DB.prepare('SELECT * FROM portal_users WHERE id = ? LIMIT 1')
    .bind(actor.userId)
    .first();
  if (!user) throw new Error('Usuário não encontrado.');
  const currentPassword = String(body.currentPassword || '');
  if (!(await verifyPassword(currentPassword, user))) {
    throw new Error('A senha atual está incorreta.');
  }
  const password = validatePassword(body.newPassword);
  if (await verifyPassword(password, user)) {
    throw new Error('A nova senha precisa ser diferente da senha atual.');
  }
  const salt = bytesToHex(randomBytes(16));
  const hash = await passwordHash(password, salt);
  const updatedAt = nowIso();
  await env.PORTAL_DB.batch([
    env.PORTAL_DB.prepare(`
      UPDATE portal_users
      SET password_hash = ?, salt = ?, password_iterations = ?, must_change_password = 0,
          failed_attempts = 0, locked_until = '', updated_at = ?
      WHERE id = ?
    `).bind(hash, salt, PASSWORD_ITERATIONS, updatedAt, user.id),
    env.PORTAL_DB.prepare(`
      UPDATE portal_auth_sessions
      SET revoked_at = ?
      WHERE user_id = ? AND id <> ? AND revoked_at = ''
    `).bind(updatedAt, user.id, actor.sessionId)
  ]);
  await audit(env, {
    event: 'password-changed',
    userId: user.id,
    username: user.username,
    outcome: 'success',
    request
  });
  return { changed: true };
}

export const AUTH_PASSWORD_ITERATIONS = PASSWORD_ITERATIONS;
