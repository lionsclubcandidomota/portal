const MAX_STORED_BYTES = 1250 * 1024;
const MAX_DELETE_KEYS = 25;
const MAX_PRIVATE_STATE_BYTES = 2 * 1024 * 1024;
const PRIVATE_STATE_KEY = '__portal/private-state-v1.json';
const PRIVATE_BACKUP_PREFIX = '__portal/backups/private-state-v1/';
const MAX_PRIVATE_BACKUPS = 20;
const MAX_INTEGRITY_REFERENCES = 500;
const SESSION_RATE_WINDOW_MS = 15 * 60 * 1000;
const SESSION_RATE_MAX_ATTEMPTS = 10;
const sessionAttempts = new Map();
const SESSION_VERSION = 1;
const DIRECTOR_PASSWORD_CONTEXT = 'lions-portal-director-password-v2';
const DIRECTOR_PASSWORD_ITERATIONS = 100000;
const SAFE_IDENTIFIER = /^[a-z0-9_-]{1,96}$/i;
const SAFE_OBJECT_KEY = /^treasury\/[a-z0-9/_-]+\.[a-z0-9]+$/i;
const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods'
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}

function errorResponse(error, status = 400, headers = {}) {
  const message = error instanceof Error ? error.message : String(error || 'Falha inesperada.');
  return json({ error: message }, status, headers);
}

function normalizeOriginList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function originAllowed(origin, env) {
  if (!origin) return false;
  return normalizeOriginList(env.ALLOWED_ORIGINS).some(allowed => {
    if (allowed === origin) return true;
    if (allowed.endsWith(':*')) return origin.startsWith(allowed.slice(0, -1));
    return false;
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!originAllowed(origin, env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function requireAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!originAllowed(origin, env)) throw new Response('Origem não autorizada.', { status: 403 });
}


function sessionRateKey(request) {
  return String(request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown')
    .split(',')[0]
    .trim()
    .slice(0, 80);
}

function enforceSessionRateLimit(request) {
  const now = Date.now();
  const key = sessionRateKey(request);
  const current = sessionAttempts.get(key);
  if (!current || now - current.startedAt >= SESSION_RATE_WINDOW_MS) {
    sessionAttempts.set(key, { startedAt: now, attempts: 1 });
    return;
  }
  current.attempts += 1;
  if (current.attempts > SESSION_RATE_MAX_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((SESSION_RATE_WINDOW_MS - (now - current.startedAt)) / 1000));
    throw new Response('Muitas tentativas de acesso. Aguarde antes de tentar novamente.', {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) }
    });
  }
}

function clearSessionRateLimit(request) {
  sessionAttempts.delete(sessionRateKey(request));
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeText(text) {
  return base64UrlEncodeBytes(encoder.encode(text));
}

function base64UrlDecodeText(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return decoder.decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
}

async function hmacKey(secret) {
  if (String(secret || '').length < 32) {
    throw new Error('SESSION_SECRET precisa possuir pelo menos 32 caracteres.');
  }
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signPayload(payload, secret) {
  const body = base64UrlEncodeText(JSON.stringify(payload));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body)));
  return `${body}.${base64UrlEncodeBytes(signature)}`;
}

async function verifySignedPayload(token, secret) {
  const [body, signatureText, extra] = String(token || '').split('.');
  if (!body || !signatureText || extra) throw new Error('Autorização inválida.');
  const normalized = signatureText.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const signature = Uint8Array.from(binary, character => character.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), signature, encoder.encode(body));
  if (!valid) throw new Error('Autorização inválida.');
  const payload = JSON.parse(base64UrlDecodeText(body));
  if (Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error('Autorização expirada.');
  return payload;
}

function sessionTtl(env) {
  return Math.min(8 * 60 * 60, Math.max(5 * 60, Number(env.SESSION_TTL_SECONDS || 1800)));
}

function downloadTtl(env) {
  return Math.min(15 * 60, Math.max(60, Number(env.DOWNLOAD_TTL_SECONDS || 300)));
}

async function createSessionToken(role, subject, env) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + sessionTtl(env);
  const token = await signPayload({
    v: SESSION_VERSION,
    type: 'session',
    role,
    sub: String(subject || role),
    iat: now,
    exp,
    nonce: crypto.randomUUID()
  }, env.SESSION_SECRET);
  return { token, exp };
}

async function requireSession(request, env, roles = []) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Response('Sessão não informada.', { status: 401 });
  let payload;
  try {
    payload = await verifySignedPayload(match[1], env.SESSION_SECRET);
  } catch (error) {
    throw new Response(error.message, { status: 401 });
  }
  if (payload.type !== 'session' || payload.v !== SESSION_VERSION) {
    throw new Response('Sessão incompatível.', { status: 401 });
  }
  if (roles.length && !roles.includes(payload.role)) {
    throw new Response('Este perfil não possui permissão para esta operação.', { status: 403 });
  }
  return payload;
}

async function validateAdminCredential(token, env) {
  const safeToken = String(token || '').trim();
  if (!safeToken || /\s/.test(safeToken)) throw new Error('Token administrativo inválido.');
  const owner = encodeURIComponent(env.GITHUB_OWNER || '');
  const repo = encodeURIComponent(env.GITHUB_REPO || '');
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${safeToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Lions-Portal-R2-Worker'
  };
  const [repositoryResponse, userResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch('https://api.github.com/user', { headers })
  ]);
  if (!repositoryResponse.ok) throw new Error('O token não possui acesso ao repositório configurado.');
  const repository = await repositoryResponse.json();
  if (repository.archived || repository.disabled || repository.permissions?.push !== true) {
    throw new Error('O token precisa possuir permissão de escrita no repositório do Portal.');
  }
  const user = userResponse.ok ? await userResponse.json() : null;
  return String(user?.login || user?.name || 'administrador');
}

function hexToBytes(value) {
  const normalized = String(value || '').toLowerCase();
  if (!/^[a-f0-9]+$/.test(normalized) || normalized.length % 2) return null;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(first, second) {
  const firstBytes = hexToBytes(first);
  const secondBytes = hexToBytes(second);
  if (!firstBytes || !secondBytes || firstBytes.length !== secondBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < firstBytes.length; index += 1) difference |= firstBytes[index] ^ secondBytes[index];
  return difference === 0;
}

async function directorPasswordHash(password, salt, iterations) {
  const safeIterations = Number(iterations || DIRECTOR_PASSWORD_ITERATIONS);
  if (!Number.isInteger(safeIterations) || safeIterations !== DIRECTOR_PASSWORD_ITERATIONS) {
    throw new Error('A senha da Diretoria utiliza uma configuração anterior incompatível com o Worker. Redefina a senha nas Configurações do Portal e publique a alteração.');
  }
  const material = await crypto.subtle.importKey('raw', encoder.encode(String(password || '')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: encoder.encode(`${DIRECTOR_PASSWORD_CONTEXT}:${salt}`),
    iterations: safeIterations
  }, material, 256);
  return [...new Uint8Array(bits)].map(value => value.toString(16).padStart(2, '0')).join('');
}


function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function privateStateSummary(state) {
  const source = objectValue(state);
  const settings = objectValue(source.settings);
  const director = objectValue(settings.accessProfiles?.director);
  const treasury = Array.isArray(source.treasury) ? source.treasury : [];
  const objectKeys = [];
  let invalidAttachmentReferences = 0;
  for (const movement of treasury) {
    for (const attachment of Array.isArray(movement?.attachments) ? movement.attachments : []) {
      const objectKey = String(attachment?.objectKey || '').trim();
      if (SAFE_OBJECT_KEY.test(objectKey)) objectKeys.push(objectKey);
      else if (attachment?.storage === 'r2' || objectKey) invalidAttachmentReferences += 1;
    }
  }
  const summary = {
    treasury: treasury.length,
    accounts: Array.isArray(source.treasuryAccounts) ? source.treasuryAccounts.length : 0,
    categories: Array.isArray(source.treasuryCategories) ? source.treasuryCategories.length : 0,
    familyGroups: Array.isArray(source.familyGroups) ? source.familyGroups.length : 0,
    mutualGroups: Array.isArray(source.mutualGroups) ? source.mutualGroups.length : 0,
    attachments: objectKeys.length,
    invalidAttachmentReferences,
    directorConfigured: Boolean(director.passwordHash && director.salt)
  };
  summary.protectedRecords = summary.treasury
    + summary.accounts
    + summary.categories
    + summary.familyGroups
    + summary.mutualGroups
    + summary.attachments
    + (summary.directorConfigured ? 1 : 0);
  return { summary, objectKeys };
}

function backupTimestamp(value = new Date().toISOString()) {
  return String(value).replace(/[^0-9]/g, '').slice(0, 17).padEnd(17, '0');
}

function privateBackupKey(revision, createdAt) {
  return `${PRIVATE_BACKUP_PREFIX}${backupTimestamp(createdAt)}-${sanitizeIdentifier(revision, 'revision')}-${crypto.randomUUID().slice(0, 8)}.json`;
}

function privateStateMetadata({ revision, updatedAt, updatedBy, checksum, summary, reason = 'automatic', label = '' }) {
  return {
    revision: String(revision || '').slice(0, 120),
    updatedAt: String(updatedAt || '').slice(0, 40),
    updatedBy: String(updatedBy || 'administrador').slice(0, 120),
    checksum: String(checksum || '').slice(0, 64),
    reason: String(reason || 'automatic').slice(0, 40),
    label: String(label || '').slice(0, 160),
    treasuryCount: String(summary.treasury),
    accountCount: String(summary.accounts),
    attachmentCount: String(summary.attachments),
    protectedRecordCount: String(summary.protectedRecords)
  };
}

async function privateStateEnvelope(state, { revision, updatedAt }) {
  const serializedState = JSON.stringify(state);
  const checksum = await sha256Hex(encoder.encode(serializedState));
  return {
    serialized: JSON.stringify({ version: 2, revision, updatedAt, checksum, state }),
    checksum,
    ...privateStateSummary(state)
  };
}

async function parsePrivateStateObject(object, label = 'estado privado') {
  let payload;
  try {
    payload = JSON.parse(await object.text());
  } catch {
    throw new Error(`O ${label} contém JSON inválido.`);
  }
  const state = payload?.state && typeof payload.state === 'object' && !Array.isArray(payload.state)
    ? payload.state
    : null;
  if (!state) throw new Error(`O ${label} está incompleto.`);
  const revision = String(object.customMetadata?.revision || payload.revision || '');
  const updatedAt = String(object.customMetadata?.updatedAt || payload.updatedAt || '');
  const expectedChecksum = String(object.customMetadata?.checksum || payload.checksum || '');
  const serializedState = JSON.stringify(state);
  const checksum = await sha256Hex(encoder.encode(serializedState));
  if (expectedChecksum && expectedChecksum !== checksum) {
    throw new Error(`O ${label} falhou na verificação de integridade.`);
  }
  const { summary, objectKeys } = privateStateSummary(state);
  return { state, revision, updatedAt, checksum, summary, objectKeys };
}

async function readPrivateStateRecord(env) {
  const object = await env.ATTACHMENTS.get(PRIVATE_STATE_KEY);
  if (!object) return null;
  return parsePrivateStateObject(object, 'armazenamento privado do Portal');
}

async function putPrivateBackup(env, record, { updatedBy = 'administrador', reason = 'automatic', label = '' } = {}) {
  const key = privateBackupKey(record.revision, record.updatedAt);
  const metadata = privateStateMetadata({
    revision: record.revision,
    updatedAt: record.updatedAt,
    updatedBy,
    checksum: record.checksum,
    summary: record.summary,
    reason,
    label
  });
  await env.ATTACHMENTS.put(key, record.serialized, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: metadata
  });
  return { key, size: encoder.encode(record.serialized).byteLength, ...metadata };
}

async function listAllPrivateBackupObjects(env) {
  const objects = [];
  let cursor;
  do {
    const page = await env.ATTACHMENTS.list({
      prefix: PRIVATE_BACKUP_PREFIX,
      limit: 1000,
      cursor,
      include: ['customMetadata']
    });
    objects.push(...(page.objects || []));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

function backupObjectInfo(object) {
  const metadata = object.customMetadata || {};
  return {
    key: object.key,
    size: Number(object.size || 0),
    createdAt: String(metadata.updatedAt || object.uploaded?.toISOString?.() || ''),
    revision: String(metadata.revision || ''),
    updatedBy: String(metadata.updatedBy || ''),
    reason: String(metadata.reason || 'automatic'),
    label: String(metadata.label || ''),
    checksum: String(metadata.checksum || ''),
    summary: {
      treasury: Number(metadata.treasuryCount || 0),
      accounts: Number(metadata.accountCount || 0),
      attachments: Number(metadata.attachmentCount || 0),
      protectedRecords: Number(metadata.protectedRecordCount || 0)
    }
  };
}

async function prunePrivateBackups(env) {
  const objects = await listAllPrivateBackupObjects(env);
  const ordered = objects.sort((a, b) => String(b.key).localeCompare(String(a.key)));
  const excess = ordered.slice(MAX_PRIVATE_BACKUPS).map(object => object.key);
  if (excess.length) await env.ATTACHMENTS.delete(excess);
  return Math.min(ordered.length, MAX_PRIVATE_BACKUPS);
}

async function persistPrivateState(env, state, session, { reason = 'automatic', label = '' } = {}) {
  const revision = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const updatedBy = String(session?.sub || 'administrador').slice(0, 120);
  const envelope = await privateStateEnvelope(state, { revision, updatedAt });
  const backup = await putPrivateBackup(env, envelope, { updatedBy, reason, label });
  await env.ATTACHMENTS.put(PRIVATE_STATE_KEY, envelope.serialized, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: privateStateMetadata({
      revision,
      updatedAt,
      updatedBy,
      checksum: envelope.checksum,
      summary: envelope.summary,
      reason,
      label
    })
  });
  await prunePrivateBackups(env);
  return { revision, updatedAt, checksum: envelope.checksum, summary: envelope.summary, backup };
}

async function publishedDirectorProfile(env) {
  if (!env.PUBLIC_DATA_URL) return null;
  const response = await fetch(`${env.PUBLIC_DATA_URL}${String(env.PUBLIC_DATA_URL).includes('?') ? '&' : '?'}ts=${Date.now()}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const state = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  return state?.settings?.accessProfiles?.director || null;
}

async function directorProfileForAuthentication(env) {
  const privateRecord = await readPrivateStateRecord(env);
  return privateRecord?.state?.settings?.accessProfiles?.director
    || await publishedDirectorProfile(env);
}

async function validateDirectorCredential(password, env) {
  const profile = await directorProfileForAuthentication(env);
  const salt = String(profile?.salt || '').toLowerCase();
  const hash = String(profile?.passwordHash || '').toLowerCase();
  const validProfile = Number(profile?.version || 0) >= 2
    && profile?.credentialType === 'password'
    && profile?.enabled !== false
    && /^[a-f0-9]{32}$/.test(salt)
    && /^[a-f0-9]{64}$/.test(hash);
  if (!validProfile) throw new Error('A senha da Diretoria ainda não foi configurada no Portal.');
  const candidate = await directorPasswordHash(password, salt, profile.iterations);
  if (!constantTimeEqual(candidate, hash)) throw new Error('Senha da Diretoria inválida.');
  return 'diretoria';
}

function sanitizeIdentifier(value, fallback) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return SAFE_IDENTIFIER.test(normalized) ? normalized : fallback;
}

function sanitizeFilename(value) {
  return String(value || 'documento')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'documento';
}

function contentDisposition(disposition, filename) {
  const safe = sanitizeFilename(filename).replace(/[^\x20-\x7E]+/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(sanitizeFilename(filename));
  return `${disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

async function sha256Hex(buffer) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function handleSession(request, env) {
  const body = await request.json().catch(() => ({}));
  const role = String(body.role || '').toLowerCase();
  let subject;
  if (role === 'admin') subject = await validateAdminCredential(body.credential, env);
  else if (role === 'director') subject = await validateDirectorCredential(body.credential, env);
  else throw new Error('Perfil de acesso não reconhecido.');
  const session = await createSessionToken(role, subject, env);
  return {
    token: session.token,
    role,
    expiresAt: new Date(session.exp * 1000).toISOString()
  };
}


async function handlePrivateStateRead(env, session) {
  const record = await readPrivateStateRecord(env);
  if (!record) return { found: false, state: null, revision: '', updatedAt: '', integrity: null };
  const response = {
    found: true,
    state: record.state,
    revision: record.revision,
    updatedAt: record.updatedAt,
    integrity: { checksum: record.checksum, summary: record.summary }
  };
  if (session.role !== 'director') return response;

  const state = JSON.parse(JSON.stringify(record.state));
  const profile = state?.settings?.accessProfiles?.director;
  if (profile && state.settings?.accessProfiles) {
    state.settings.accessProfiles.director = {
      version: Number(profile.version || 2),
      credentialType: String(profile.credentialType || 'password'),
      enabled: profile.enabled !== false,
      label: String(profile.label || 'Diretoria'),
      configuredAt: String(profile.configuredAt || '')
    };
  }
  return { ...response, state };
}

async function handlePrivateStateWrite(request, env, session) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_PRIVATE_STATE_BYTES + 64 * 1024) {
    throw new Response('O estado privado excede o limite permitido.', { status: 413 });
  }
  const body = await request.json().catch(() => ({}));
  const state = body?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('O estado privado informado é inválido.');
  }
  const serialized = JSON.stringify(state);
  if (encoder.encode(serialized).byteLength > MAX_PRIVATE_STATE_BYTES) {
    throw new Response('O estado privado excede o limite permitido.', { status: 413 });
  }

  const current = await readPrivateStateRecord(env);
  const expectedRevision = String(body.expectedRevision || '');
  if (current?.revision && expectedRevision !== current.revision) {
    throw new Response('Os dados privados foram atualizados em outra sessão. Recarregue o painel antes de publicar.', { status: 409 });
  }

  const incoming = privateStateSummary(state).summary;
  if (current?.summary?.protectedRecords > 0 && incoming.protectedRecords === 0) {
    throw new Response('Gravação bloqueada: o novo estado removeria todos os dados privados. Use a Central de Recuperação para restaurar uma versão válida.', { status: 422 });
  }

  if (current) {
    const safetyEnvelope = await privateStateEnvelope(current.state, {
      revision: current.revision || crypto.randomUUID(),
      updatedAt: current.updatedAt || new Date().toISOString()
    });
    await putPrivateBackup(env, safetyEnvelope, {
      updatedBy: String(session.sub || 'administrador'),
      reason: 'before-publication',
      label: 'Estado anterior à publicação'
    });
  }

  const saved = await persistPrivateState(env, state, session, {
    reason: current ? 'publication' : 'migration',
    label: current ? 'Estado confirmado após a publicação' : 'Migração inicial para o R2'
  });
  return { saved: true, ...saved };
}

async function handlePrivateBackupList(env) {
  const objects = await listAllPrivateBackupObjects(env);
  const backups = objects
    .map(backupObjectInfo)
    .sort((a, b) => String(b.key).localeCompare(String(a.key)))
    .slice(0, MAX_PRIVATE_BACKUPS);
  const current = await readPrivateStateRecord(env);
  return {
    backups,
    retention: MAX_PRIVATE_BACKUPS,
    current: current ? {
      revision: current.revision,
      updatedAt: current.updatedAt,
      checksum: current.checksum,
      summary: current.summary
    } : null
  };
}

async function handlePrivateBackupCreate(request, env, session) {
  const current = await readPrivateStateRecord(env);
  if (!current) throw new Response('Ainda não existe um estado privado para copiar.', { status: 404 });
  const body = await request.json().catch(() => ({}));
  const envelope = await privateStateEnvelope(current.state, {
    revision: current.revision || crypto.randomUUID(),
    updatedAt: new Date().toISOString()
  });
  const backup = await putPrivateBackup(env, envelope, {
    updatedBy: String(session.sub || 'administrador'),
    reason: 'manual',
    label: String(body.label || 'Backup manual criado pelo Administrador')
  });
  await prunePrivateBackups(env);
  return { created: true, backup };
}

function requirePrivateBackupKey(value) {
  const key = String(value || '').trim();
  if (!key.startsWith(PRIVATE_BACKUP_PREFIX) || !key.endsWith('.json') || key.includes('..')) {
    throw new Error('Identificador de backup inválido.');
  }
  return key;
}

async function handlePrivateBackupRestore(request, env, session) {
  const body = await request.json().catch(() => ({}));
  const key = requirePrivateBackupKey(body.key);
  const current = await readPrivateStateRecord(env);
  const expectedRevision = String(body.expectedRevision || '');
  if (current?.revision && expectedRevision !== current.revision) {
    throw new Response('Os dados privados foram atualizados em outra sessão. Atualize a Central de Recuperação antes de restaurar.', { status: 409 });
  }
  const object = await env.ATTACHMENTS.get(key);
  if (!object) throw new Response('O backup selecionado não foi encontrado.', { status: 404 });
  const backupRecord = await parsePrivateStateObject(object, 'backup privado selecionado');

  if (current) {
    const safetyEnvelope = await privateStateEnvelope(current.state, {
      revision: current.revision || crypto.randomUUID(),
      updatedAt: new Date().toISOString()
    });
    await putPrivateBackup(env, safetyEnvelope, {
      updatedBy: String(session.sub || 'administrador'),
      reason: 'before-restore',
      label: 'Antes de restaurar um backup do R2'
    });
  }

  const restored = await persistPrivateState(env, backupRecord.state, session, {
    reason: 'restored',
    label: `Restaurado de ${backupRecord.updatedAt || key.split('/').pop()}`
  });
  return {
    restored: true,
    found: true,
    state: backupRecord.state,
    revision: restored.revision,
    updatedAt: restored.updatedAt,
    integrity: { checksum: restored.checksum, summary: restored.summary }
  };
}

async function listTreasuryObjects(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.ATTACHMENTS.list({ prefix: 'treasury/', limit: 1000, cursor });
    keys.push(...(page.objects || []).map(object => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && keys.length < 5000);
  return keys;
}

async function handlePrivateIntegrity(env) {
  const current = await readPrivateStateRecord(env);
  if (!current) {
    return {
      status: 'error',
      found: false,
      checkedAt: new Date().toISOString(),
      errors: ['O estado privado principal não existe no R2.'],
      warnings: [],
      current: null,
      attachments: { referenced: 0, existing: 0, missing: [], invalid: 0, duplicates: 0, orphaned: [] }
    };
  }

  const references = current.objectKeys.slice(0, MAX_INTEGRITY_REFERENCES);
  const uniqueReferences = [...new Set(references)];
  const missing = [];
  for (let index = 0; index < uniqueReferences.length; index += 25) {
    const batch = uniqueReferences.slice(index, index + 25);
    const results = await Promise.all(batch.map(async key => ({ key, object: await env.ATTACHMENTS.head(key) })));
    missing.push(...results.filter(item => !item.object).map(item => item.key));
  }

  const storedKeys = await listTreasuryObjects(env);
  const referenceSet = new Set(uniqueReferences);
  const orphaned = storedKeys.filter(key => !referenceSet.has(key));
  const backups = await listAllPrivateBackupObjects(env);
  const duplicates = references.length - uniqueReferences.length;
  const errors = [];
  const warnings = [];
  if (missing.length) errors.push(`${missing.length} anexo(s) referenciado(s) não existem no R2.`);
  if (current.summary.invalidAttachmentReferences) warnings.push(`${current.summary.invalidAttachmentReferences} referência(s) de anexo possuem formato inválido.`);
  if (duplicates) warnings.push(`${duplicates} referência(s) de anexo estão duplicadas.`);
  if (orphaned.length) warnings.push(`${orphaned.length} objeto(s) de anexo não estão vinculados a movimentações atuais.`);
  if (!backups.length) warnings.push('Nenhum backup versionado foi encontrado no R2.');
  if (current.objectKeys.length > MAX_INTEGRITY_REFERENCES) warnings.push(`A verificação detalhada foi limitada aos primeiros ${MAX_INTEGRITY_REFERENCES} anexos.`);

  return {
    status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok',
    found: true,
    checkedAt: new Date().toISOString(),
    errors,
    warnings,
    current: {
      revision: current.revision,
      updatedAt: current.updatedAt,
      checksum: current.checksum,
      summary: current.summary
    },
    backups: { count: backups.length, retention: MAX_PRIVATE_BACKUPS },
    attachments: {
      referenced: current.objectKeys.length,
      checked: uniqueReferences.length,
      existing: uniqueReferences.length - missing.length,
      missing: missing.slice(0, 100),
      invalid: current.summary.invalidAttachmentReferences,
      duplicates,
      orphaned: orphaned.slice(0, 100),
      stored: storedKeys.length
    }
  };
}

async function handleUpload(request, env, session) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_STORED_BYTES + 256 * 1024) throw new Response('O envio excede o limite permitido.', { status: 413 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new Error('Arquivo não informado.');
  if (file.size <= 0 || file.size > MAX_STORED_BYTES) throw new Response('O arquivo excede o limite de 1,25 MB.', { status: 413 });
  const contentType = String(file.type || '').toLowerCase();
  const extension = MIME_EXTENSIONS[contentType];
  if (!extension) throw new Error('Formato de arquivo não permitido.');
  const movementId = sanitizeIdentifier(form.get('movementId'), 'movimentacao');
  const attachmentId = sanitizeIdentifier(form.get('attachmentId'), 'anexo');
  const name = sanitizeFilename(form.get('name') || file.name);
  const buffer = await file.arrayBuffer();
  const checksum = await sha256Hex(buffer);
  const objectKey = `treasury/${movementId}/${attachmentId}-${checksum.slice(0, 16)}.${extension}`;
  await env.ATTACHMENTS.put(objectKey, buffer, {
    httpMetadata: { contentType },
    customMetadata: {
      movementId,
      attachmentId,
      originalName: name,
      uploadedBy: String(session.sub || 'administrador').slice(0, 120),
      originalSize: String(Math.max(0, Number(form.get('originalSize') || file.size))),
      optimized: String(form.get('optimized') === 'true'),
      checksum
    }
  });
  return {
    objectKey,
    checksum,
    size: file.size,
    type: contentType,
    uploadedAt: new Date().toISOString()
  };
}

async function handleAccessRequest(request, env) {
  const body = await request.json().catch(() => ({}));
  const objectKey = String(body.objectKey || '').trim();
  if (!SAFE_OBJECT_KEY.test(objectKey)) throw new Error('Identificador de anexo inválido.');
  const object = await env.ATTACHMENTS.head(objectKey);
  if (!object) throw new Response('Anexo não encontrado.', { status: 404 });
  const now = Math.floor(Date.now() / 1000);
  const ticket = await signPayload({
    v: SESSION_VERSION,
    type: 'attachment-access',
    objectKey,
    disposition: body.disposition === 'attachment' ? 'attachment' : 'inline',
    filename: sanitizeFilename(body.filename || object.customMetadata?.originalName || 'documento'),
    iat: now,
    exp: now + downloadTtl(env),
    nonce: crypto.randomUUID()
  }, env.SESSION_SECRET);
  const origin = new URL(request.url).origin;
  return { url: `${origin}/api/attachments/object?ticket=${encodeURIComponent(ticket)}` };
}

async function handleObject(request, env) {
  const ticket = new URL(request.url).searchParams.get('ticket') || '';
  const payload = await verifySignedPayload(ticket, env.SESSION_SECRET);
  if (payload.type !== 'attachment-access' || !SAFE_OBJECT_KEY.test(String(payload.objectKey || ''))) {
    throw new Response('Autorização de anexo inválida.', { status: 401 });
  }
  const object = await env.ATTACHMENTS.get(payload.objectKey);
  if (!object) throw new Response('Anexo não encontrado.', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Disposition', contentDisposition(payload.disposition, payload.filename));
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  return new Response(object.body, { headers });
}

async function handleDelete(request, env) {
  const body = await request.json().catch(() => ({}));
  const keys = [...new Set((Array.isArray(body.objectKeys) ? body.objectKeys : [])
    .map(value => String(value || '').trim())
    .filter(value => SAFE_OBJECT_KEY.test(value)))]
    .slice(0, MAX_DELETE_KEYS);
  if (!keys.length) return { deleted: 0 };
  await env.ATTACHMENTS.delete(keys);
  return { deleted: keys.length };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    try {
      if (request.method === 'OPTIONS') {
        requireAllowedOrigin(request, env);
        return new Response(null, { status: 204, headers: cors });
      }

      if (url.pathname === '/health' && request.method === 'GET') {
        return json({ status: 'ok', storage: 'cloudflare-r2', version: SESSION_VERSION, directorPbkdf2Iterations: DIRECTOR_PASSWORD_ITERATIONS, privateState: 'r2', privateBackups: 'versioned', privateBackupRetention: MAX_PRIVATE_BACKUPS, attachmentIntegrity: 'available' }, 200, cors);
      }

      if (url.pathname === '/api/attachments/object' && request.method === 'GET') {
        return await handleObject(request, env);
      }

      requireAllowedOrigin(request, env);

      if (url.pathname === '/api/session' && request.method === 'POST') {
        enforceSessionRateLimit(request);
        const session = await handleSession(request, env);
        clearSessionRateLimit(request);
        return json(session, 200, cors);
      }

      if (url.pathname === '/api/private-state' && request.method === 'GET') {
        const session = await requireSession(request, env, ['admin', 'director']);
        return json(await handlePrivateStateRead(env, session), 200, cors);
      }

      if (url.pathname === '/api/private-state' && request.method === 'PUT') {
        const session = await requireSession(request, env, ['admin']);
        return json(await handlePrivateStateWrite(request, env, session), 200, cors);
      }

      if (url.pathname === '/api/private-state/backups' && request.method === 'GET') {
        await requireSession(request, env, ['admin', 'director']);
        return json(await handlePrivateBackupList(env), 200, cors);
      }

      if (url.pathname === '/api/private-state/backups' && request.method === 'POST') {
        const session = await requireSession(request, env, ['admin']);
        return json(await handlePrivateBackupCreate(request, env, session), 201, cors);
      }

      if (url.pathname === '/api/private-state/backups/restore' && request.method === 'POST') {
        const session = await requireSession(request, env, ['admin']);
        return json(await handlePrivateBackupRestore(request, env, session), 200, cors);
      }

      if (url.pathname === '/api/private-state/integrity' && request.method === 'GET') {
        await requireSession(request, env, ['admin', 'director']);
        return json(await handlePrivateIntegrity(env), 200, cors);
      }

      if (url.pathname === '/api/attachments/upload' && request.method === 'POST') {
        const session = await requireSession(request, env, ['admin']);
        return json(await handleUpload(request, env, session), 201, cors);
      }

      if (url.pathname === '/api/attachments/access' && request.method === 'POST') {
        await requireSession(request, env, ['admin', 'director']);
        return json(await handleAccessRequest(request, env), 200, cors);
      }

      if (url.pathname === '/api/attachments' && request.method === 'DELETE') {
        await requireSession(request, env, ['admin']);
        return json(await handleDelete(request, env), 200, cors);
      }

      return json({ error: 'Rota não encontrada.' }, 404, cors);
    } catch (error) {
      if (error instanceof Response) {
        const message = await error.text().catch(() => 'Falha na solicitação.');
        return errorResponse(message, error.status, cors);
      }
      console.error(error);
      return errorResponse(error, 400, cors);
    }
  }
};
