const PORTAL_APP_ID = 'Lions Clube de Cândido Mota Dashboard';
const DEFAULT_SCHEMA_VERSION = 11;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 24 * 1024 * 1024;
const MAX_PUBLIC_STATE_BYTES = 2 * 1024 * 1024;
const PUBLIC_MEDIA_PREFIX = 'public/';
const PUBLIC_MEDIA_REFERENCE_PREFIX = 'r2://';
const SAFE_PUBLIC_PATH = /^public\/[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{1,10}$/i;
const encoder = new TextEncoder();

function text(value) {
  return String(value ?? '');
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizePath(value) {
  const path = text(value).trim().replace(/^\.\//, '').replaceAll('\\', '/');
  if (!SAFE_PUBLIC_PATH.test(path) || path.includes('../') || path.includes('/./')) {
    throw new Error(`Caminho de mídia pública inválido: ${path || 'vazio'}.`);
  }
  return path;
}

function canonicalReference(objectKey) {
  return `${PUBLIC_MEDIA_REFERENCE_PREFIX}${normalizePath(objectKey)}`;
}

function referenceObjectKey(value) {
  const reference = text(value).trim();
  if (!reference) return '';
  if (reference.startsWith(PUBLIC_MEDIA_REFERENCE_PREFIX)) {
    const key = reference.slice(PUBLIC_MEDIA_REFERENCE_PREFIX.length);
    return SAFE_PUBLIC_PATH.test(key) ? key : '';
  }
  if (/^\.\/public\//i.test(reference) || /^public\//i.test(reference)) {
    const key = reference.replace(/^\.\//, '');
    return SAFE_PUBLIC_PATH.test(key) ? key : '';
  }
  try {
    const url = new URL(reference);
    if (url.pathname === '/api/public/media') {
      const key = url.searchParams.get('key') || '';
      return SAFE_PUBLIC_PATH.test(key) ? key : '';
    }
  } catch {
    // Referência relativa não reconhecida.
  }
  return '';
}

function publicMediaUrl(requestUrl, objectKey) {
  const url = new URL('/api/public/media', requestUrl);
  url.searchParams.set('key', normalizePath(objectKey));
  return url.href;
}

function hydrateMediaReferences(state, requestUrl) {
  const hydrated = cloneValue(state || {});
  if (hydrated.settings && typeof hydrated.settings === 'object') {
    const key = referenceObjectKey(hydrated.settings.logo);
    if (key) hydrated.settings.logo = publicMediaUrl(requestUrl, key);
  }
  hydrated.birthdays = arrayValue(hydrated.birthdays).map(member => {
    const next = { ...member };
    const key = referenceObjectKey(next.photo);
    if (key) next.photo = publicMediaUrl(requestUrl, key);
    return next;
  });
  return hydrated;
}

function canonicalizeMediaReferences(state) {
  const next = cloneValue(state || {});
  if (next.settings && typeof next.settings === 'object') {
    const key = referenceObjectKey(next.settings.logo);
    if (key) next.settings.logo = canonicalReference(key);
  }
  next.birthdays = arrayValue(next.birthdays).map(member => {
    const item = { ...member };
    const key = referenceObjectKey(item.photo);
    if (key) item.photo = canonicalReference(key);
    return item;
  });
  return next;
}

function publicStateIsSafe(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const privateCollections = ['treasury', 'treasuryAccounts', 'treasuryCategories', 'familyGroups', 'mutualGroups'];
  for (const key of privateCollections) {
    if (Array.isArray(state[key]) && state[key].length > 0) return false;
    if (state[key] && !Array.isArray(state[key])) return false;
  }
  const director = state.settings?.accessProfiles?.director;
  if (director && (director.passwordHash || director.salt || director.iterations || director.tokenHash)) return false;
  const serialized = JSON.stringify(state);
  if (encoder.encode(serialized).byteLength > MAX_PUBLIC_STATE_BYTES) return false;
  return !/("githubToken"|"passwordHash"|"privateRevision"|"sessionToken"|"tokenHash")\s*:/i.test(serialized);
}

function normalizedPublicState(state) {
  if (!publicStateIsSafe(state)) {
    throw new Error('A publicação foi bloqueada porque o conteúdo enviado possui dados privados ou excede o limite permitido.');
  }
  const source = cloneValue(state);
  const { updatedAt: _updatedAt, deploymentId: _deploymentId, ...clean } = source;
  clean.settings = objectValue(clean.settings);
  clean.birthdays = arrayValue(clean.birthdays);
  clean.events = arrayValue(clean.events);
  clean.meetings = arrayValue(clean.meetings);
  clean.notices = arrayValue(clean.notices);
  clean.treasury = [];
  clean.treasuryAccounts = [];
  clean.treasuryCategories = [];
  clean.familyGroups = [];
  clean.mutualGroups = [];
  return canonicalizeMediaReferences(clean);
}

function base64DecodeBytes(value) {
  const binary = atob(text(value).replace(/\s+/g, ''));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function prepareAssets(mediaAssets = []) {
  let total = 0;
  const paths = new Set();
  const assets = [];
  for (const asset of arrayValue(mediaAssets)) {
    const path = normalizePath(asset?.path);
    if (paths.has(path)) throw new Error(`Mídia repetida na publicação: ${path}.`);
    paths.add(path);
    if (asset?.encoding !== 'base64' || !asset?.content) throw new Error(`Conteúdo inválido para ${path}.`);
    const bytes = base64DecodeBytes(asset.content);
    if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error(`${path} excede o limite de 8 MB.`);
    total += bytes.byteLength;
    if (total > MAX_TOTAL_ASSET_BYTES) throw new Error('As mídias da publicação excedem o limite total de 24 MB.');
    assets.push({
      path,
      objectKey: path,
      bytes,
      contentType: text(asset.contentType || 'application/octet-stream').slice(0, 120),
      kind: text(asset.kind || '').slice(0, 60),
      ownerId: text(asset.ownerId || '').slice(0, 120),
      checksum: await sha256Hex(bytes)
    });
  }
  return assets;
}

function payloadRow(item, index, dateKey, titleKey) {
  const source = objectValue(item);
  const id = text(source.id || `${titleKey}-${index}`).trim();
  if (!/^[a-z0-9_-]{1,120}$/i.test(id)) throw new Error(`O registro público ${titleKey} possui identificador inválido.`);
  return {
    id,
    sortOrder: index,
    date: text(source[dateKey] || '').slice(0, 20),
    status: text(source.status || source.priority || '').slice(0, 80),
    title: text(source[titleKey] || '').slice(0, 240),
    payload: JSON.stringify(source)
  };
}

function memberRow(member, index) {
  const source = objectValue(member);
  const id = text(source.id || `member-${index}`).trim();
  if (!/^[a-z0-9_-]{1,120}$/i.test(id)) throw new Error('Um associado possui identificador público inválido.');
  return {
    id,
    sortOrder: index,
    name: text(source.name).slice(0, 200),
    memberNumber: text(source.memberNumber).slice(0, 80),
    status: text(source.status || 'Ativo').slice(0, 80),
    active: source.active === false ? 0 : 1,
    mutual: source.mutual === true ? 1 : 0,
    payload: JSON.stringify(source)
  };
}

async function metaValues(db) {
  const result = await db.prepare(`SELECT key, value FROM portal_meta
    WHERE key IN ('public_revision', 'public_updated_at', 'public_updated_by', 'public_schema_version', 'public_migration_complete', 'schema_version')`).all();
  return Object.fromEntries((result.results || []).map(row => [text(row.key), text(row.value)]));
}

export async function getD1PublicStatus(env) {
  if (!env?.PORTAL_DB?.prepare) {
    return { available: false, initialized: false, active: false, revision: '', updatedAt: '', schemaVersion: 0 };
  }
  try {
    const table = await env.PORTAL_DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='portal_public_settings'"
    ).first();
    if (!table) return { available: true, initialized: false, active: false, revision: '', updatedAt: '', schemaVersion: 0 };
    const meta = await metaValues(env.PORTAL_DB);
    const counts = await env.PORTAL_DB.prepare(`SELECT
      (SELECT COUNT(*) FROM portal_members) AS members,
      (SELECT COUNT(*) FROM portal_public_events) AS events,
      (SELECT COUNT(*) FROM portal_public_meetings) AS meetings,
      (SELECT COUNT(*) FROM portal_public_notices) AS notices,
      (SELECT COUNT(*) FROM portal_public_media) AS media`).first();
    return {
      available: true,
      initialized: true,
      active: Boolean(meta.public_revision),
      revision: meta.public_revision || '',
      updatedAt: meta.public_updated_at || '',
      updatedBy: meta.public_updated_by || '',
      publicSchemaVersion: Number(meta.public_schema_version || DEFAULT_SCHEMA_VERSION),
      schemaVersion: Number(meta.schema_version || 0),
      migrationComplete: meta.public_migration_complete === '1',
      counts: {
        members: Number(counts?.members || 0),
        events: Number(counts?.events || 0),
        meetings: Number(counts?.meetings || 0),
        notices: Number(counts?.notices || 0),
        media: Number(counts?.media || 0)
      }
    };
  } catch (error) {
    return {
      available: true,
      initialized: false,
      active: false,
      revision: '',
      updatedAt: '',
      schemaVersion: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function parsePayload(value, label) {
  try {
    const parsed = JSON.parse(text(value || 'null'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('payload inválido');
    return parsed;
  } catch {
    throw new Error(`O registro público de ${label} contém JSON inválido no D1.`);
  }
}

function publicRevisionEtag(revision) {
  const value = text(revision).replaceAll('\"', '').trim();
  return value ? `"${value}"` : '';
}

function etagMatches(ifNoneMatch, etag) {
  if (!etag) return false;
  return text(ifNoneMatch)
    .split(',')
    .map(value => value.trim())
    .some(value => value === '*' || value === etag || value === `W/${etag}`);
}

async function readD1PublicMeta(env) {
  if (!env?.PORTAL_DB?.prepare) {
    return { available: false, initialized: false, active: false, revision: '', updatedAt: '', schemaVersion: 0 };
  }
  try {
    const table = await env.PORTAL_DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='portal_public_settings'"
    ).first();
    if (!table) return { available: true, initialized: false, active: false, revision: '', updatedAt: '', schemaVersion: 0 };
    const meta = await metaValues(env.PORTAL_DB);
    return {
      available: true,
      initialized: true,
      active: Boolean(meta.public_revision),
      revision: meta.public_revision || '',
      updatedAt: meta.public_updated_at || '',
      updatedBy: meta.public_updated_by || '',
      publicSchemaVersion: Number(meta.public_schema_version || DEFAULT_SCHEMA_VERSION),
      schemaVersion: Number(meta.schema_version || 0),
      migrationComplete: meta.public_migration_complete === '1'
    };
  } catch (error) {
    return {
      available: true, initialized: false, active: false, revision: '', updatedAt: '', schemaVersion: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function readD1PublicState(env, requestUrl, options = {}) {
  const status = await readD1PublicMeta(env);
  if (!status.active) return { found: false, status };
  const etag = publicRevisionEtag(status.revision);
  if (etagMatches(options.ifNoneMatch, etag)) {
    return { found: true, notModified: true, status, etag };
  }
  const db = env.PORTAL_DB;
  const [settings, members, events, meetings, notices] = await Promise.all([
    db.prepare('SELECT payload FROM portal_public_settings WHERE id = 1').first(),
    db.prepare('SELECT id, payload FROM portal_members ORDER BY sort_order, name, id').all(),
    db.prepare('SELECT id, payload FROM portal_public_events ORDER BY sort_order, event_date, id').all(),
    db.prepare('SELECT id, payload FROM portal_public_meetings ORDER BY sort_order, meeting_date, id').all(),
    db.prepare('SELECT id, payload FROM portal_public_notices ORDER BY sort_order, start_date, id').all()
  ]);
  const state = {
    settings: settings?.payload ? parsePayload(settings.payload, 'configurações') : {},
    birthdays: (members.results || []).map(row => parsePayload(row.payload, `associado ${text(row.id)}`)),
    events: (events.results || []).map(row => parsePayload(row.payload, `evento ${text(row.id)}`)),
    meetings: (meetings.results || []).map(row => parsePayload(row.payload, `reunião ${text(row.id)}`)),
    notices: (notices.results || []).map(row => parsePayload(row.payload, `aviso ${text(row.id)}`)),
    treasuryAccounts: [],
    treasuryCategories: [],
    familyGroups: [],
    mutualGroups: [],
    treasury: []
  };
  return {
    found: true,
    status,
    etag,
    envelope: {
      updatedAt: status.updatedAt,
      deploymentId: status.revision,
      revision: status.revision,
      source: 'd1',
      app: PORTAL_APP_ID,
      schemaVersion: status.publicSchemaVersion,
      version: status.publicSchemaVersion,
      data: hydrateMediaReferences(state, requestUrl)
    }
  };
}

async function putPublicAssets(env, assets, updatedAt) {
  if (assets.length && !env?.ATTACHMENTS?.put) throw new Error('O binding ATTACHMENTS do R2 não está configurado.');
  const uploaded = [];
  try {
    for (const asset of assets) {
      await env.ATTACHMENTS.put(asset.objectKey, asset.bytes, {
        httpMetadata: { contentType: asset.contentType, cacheControl: 'public, max-age=31536000, immutable' },
        customMetadata: {
          checksum: asset.checksum,
          kind: asset.kind,
          ownerId: asset.ownerId,
          updatedAt
        }
      });
      uploaded.push(asset.objectKey);
    }
    return uploaded;
  } catch (error) {
    await deletePublicAssets(env, uploaded).catch(() => {});
    throw error;
  }
}

async function deletePublicAssets(env, objectKeys) {
  if (!objectKeys.length || !env?.ATTACHMENTS?.delete) return;
  await env.ATTACHMENTS.delete(objectKeys);
}

export async function writeD1PublicState(env, body = {}, actor = {}) {
  if (!env?.PORTAL_DB?.prepare) throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  const status = await getD1PublicStatus(env);
  if (!status.initialized || status.schemaVersion < 9) throw new Error('Aplique a migração 0010 do conteúdo público no D1.');

  const currentRevision = status.revision || '';
  const expectedRevision = text(body.expectedPublicRevision || body.expectedDataSha || '').trim();
  if (expectedRevision && currentRevision && expectedRevision !== currentRevision) {
    const error = new Error('Conflito de edição. O conteúdo público foi alterado em outra sessão. Atualize o Portal antes de publicar novamente.');
    error.code = 'PUBLIC_REVISION_CONFLICT';
    throw error;
  }

  const cleanState = normalizedPublicState(body.state);
  const assets = await prepareAssets(body.mediaAssets);
  const assetPaths = new Set(assets.map(asset => asset.path));
  const deletedPaths = [...new Set(arrayValue(body.deletedPaths).map(value => {
    try { return normalizePath(value); } catch { return ''; }
  }).filter(Boolean))].filter(path => !assetPaths.has(path));

  const publishedAt = new Date().toISOString();
  const revision = `pub-${Date.now()}-${crypto.randomUUID()}`;
  const publishedBy = text(actor.sub || actor.name || 'administrador').slice(0, 120);
  const schemaVersion = Math.max(1, Number(body.schemaVersion || DEFAULT_SCHEMA_VERSION));
  const message = text(body.commitMessage || 'Atualiza conteúdo público do Portal').trim().slice(0, 240);
  const members = cleanState.birthdays.map(memberRow);
  const events = cleanState.events.map((item, index) => payloadRow(item, index, 'date', 'name'));
  const meetings = cleanState.meetings.map((item, index) => payloadRow(item, index, 'date', 'theme'));
  const notices = cleanState.notices.map((item, index) => payloadRow(item, index, 'date', 'title'));

  const uploadedPaths = await putPublicAssets(env, assets, publishedAt);
  const db = env.PORTAL_DB;
  const statements = [
    db.prepare(`INSERT INTO portal_public_settings (id, payload, updated_at, updated_by)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
      .bind(JSON.stringify(cleanState.settings), publishedAt, publishedBy),
    db.prepare('DELETE FROM portal_members'),
    db.prepare(`INSERT INTO portal_members
      (id, sort_order, name, member_number, status, active, mutual, payload, updated_at)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.sortOrder'), json_extract(value, '$.name'),
        json_extract(value, '$.memberNumber'), json_extract(value, '$.status'), json_extract(value, '$.active'),
        json_extract(value, '$.mutual'), json_extract(value, '$.payload'), ? FROM json_each(?)`)
      .bind(publishedAt, JSON.stringify(members)),
    db.prepare('DELETE FROM portal_public_events'),
    db.prepare(`INSERT INTO portal_public_events
      (id, sort_order, event_date, status, name, payload, updated_at)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.sortOrder'), json_extract(value, '$.date'),
        json_extract(value, '$.status'), json_extract(value, '$.title'), json_extract(value, '$.payload'), ? FROM json_each(?)`)
      .bind(publishedAt, JSON.stringify(events)),
    db.prepare('DELETE FROM portal_public_meetings'),
    db.prepare(`INSERT INTO portal_public_meetings
      (id, sort_order, meeting_date, theme, payload, updated_at)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.sortOrder'), json_extract(value, '$.date'),
        json_extract(value, '$.title'), json_extract(value, '$.payload'), ? FROM json_each(?)`)
      .bind(publishedAt, JSON.stringify(meetings)),
    db.prepare('DELETE FROM portal_public_notices'),
    db.prepare(`INSERT INTO portal_public_notices
      (id, sort_order, start_date, end_date, priority, title, payload, updated_at)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.sortOrder'), json_extract(value, '$.date'),
        COALESCE(json_extract(json_extract(value, '$.payload'), '$.endDate'), ''), json_extract(value, '$.status'),
        json_extract(value, '$.title'), json_extract(value, '$.payload'), ? FROM json_each(?)`)
      .bind(publishedAt, JSON.stringify(notices)),
    db.prepare(`INSERT INTO portal_public_media
      (object_key, public_path, content_type, size_bytes, checksum, kind, owner_id, updated_at)
      SELECT json_extract(value, '$.objectKey'), json_extract(value, '$.path'), json_extract(value, '$.contentType'),
        json_extract(value, '$.size'), json_extract(value, '$.checksum'), json_extract(value, '$.kind'),
        json_extract(value, '$.ownerId'), ? FROM json_each(?) WHERE 1
      ON CONFLICT(object_key) DO UPDATE SET public_path=excluded.public_path, content_type=excluded.content_type,
        size_bytes=excluded.size_bytes, checksum=excluded.checksum, kind=excluded.kind,
        owner_id=excluded.owner_id, updated_at=excluded.updated_at`)
      .bind(publishedAt, JSON.stringify(assets.map(asset => ({
        objectKey: asset.objectKey,
        path: asset.path,
        contentType: asset.contentType,
        size: asset.bytes.byteLength,
        checksum: asset.checksum,
        kind: asset.kind,
        ownerId: asset.ownerId
      })))),
    db.prepare(`DELETE FROM portal_public_media WHERE object_key IN (SELECT value FROM json_each(?))`)
      .bind(JSON.stringify(deletedPaths)),
    db.prepare(`INSERT INTO portal_meta (key, value)
      SELECT json_extract(value, '$.key'), json_extract(value, '$.value') FROM json_each(?) WHERE 1
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
      .bind(JSON.stringify([
        { key: 'public_revision', value: revision },
        { key: 'public_updated_at', value: publishedAt },
        { key: 'public_updated_by', value: publishedBy },
        { key: 'public_schema_version', value: String(schemaVersion) },
        { key: 'public_data_d1', value: '1' },
        { key: 'public_migration_complete', value: '1' },
        { key: 'member_directory_updated_at', value: publishedAt }
      ])),
    db.prepare(`INSERT INTO portal_module_revisions (module, revision, updated_at, updated_by)
      VALUES ('public', 1, ?, ?)
      ON CONFLICT(module) DO UPDATE SET revision=portal_module_revisions.revision+1,
        updated_at=excluded.updated_at, updated_by=excluded.updated_by`).bind(publishedAt, publishedBy),
    db.prepare(`INSERT INTO portal_module_revisions (module, revision, updated_at, updated_by)
      VALUES ('member-directory', 1, ?, ?)
      ON CONFLICT(module) DO UPDATE SET revision=portal_module_revisions.revision+1,
        updated_at=excluded.updated_at, updated_by=excluded.updated_by`).bind(publishedAt, publishedBy),
    db.prepare(`INSERT INTO portal_public_publications
      (revision, previous_revision, message, actor, schema_version, member_count, event_count,
       meeting_count, notice_count, media_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(revision, currentRevision, message, publishedBy, schemaVersion, members.length, events.length,
        meetings.length, notices.length, assets.length, publishedAt),
    db.prepare(`DELETE FROM portal_public_publications WHERE revision IN (
      SELECT revision FROM portal_public_publications ORDER BY created_at DESC LIMIT -1 OFFSET 100
    )`)
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    await deletePublicAssets(env, uploadedPaths).catch(() => {});
    throw error;
  }
  await deletePublicAssets(env, deletedPaths).catch(error => {
    console.warn('Falha ao remover mídia pública obsoleta do R2:', error);
  });

  return {
    sha: revision,
    revision,
    deploymentId: revision,
    committedAt: publishedAt,
    publishedAt,
    publishedBy,
    source: 'd1',
    backend: 'cloudflare-d1',
    mediaCount: assets.length,
    deletedMediaCount: deletedPaths.length,
    memberDirectory: { refreshed: true, total: members.length, updatedAt: publishedAt },
    counts: { members: members.length, events: events.length, meetings: meetings.length, notices: notices.length }
  };
}

function legacyStateFromPayload(payload) {
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload;
}

async function legacyMediaAsset(reference, baseUrl, kind, ownerId) {
  const value = text(reference).trim();
  const objectKey = referenceObjectKey(value);
  if (!objectKey) return null;
  const url = new URL(value.replace(/^\.\//, ''), new URL('../', baseUrl));
  const response = await fetch(url.href, { headers: { Accept: '*/*' }, cf: { cacheTtl: 0, cacheEverything: false } });
  if (!response.ok) throw new Error(`Não foi possível migrar a mídia pública ${objectKey} (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error(`${objectKey} excede o limite de 8 MB.`);
  return {
    path: objectKey,
    objectKey,
    bytes,
    contentType: text(response.headers.get('Content-Type') || 'application/octet-stream').split(';')[0],
    kind,
    ownerId: text(ownerId),
    checksum: await sha256Hex(bytes)
  };
}

export async function migrateLegacyPublicStateToD1(env, actor = {}) {
  const existing = await getD1PublicStatus(env);
  if (existing.active) {
    return { migrated: false, alreadyMigrated: true, revision: existing.revision, updatedAt: existing.updatedAt, counts: existing.counts || {} };
  }
  const legacyUrl = text(env.PUBLIC_DATA_URL).trim();
  if (!legacyUrl) throw new Error('PUBLIC_DATA_URL precisa apontar para o dados.json público atual durante a migração.');
  const response = await fetch(`${legacyUrl}${legacyUrl.includes('?') ? '&' : '?'}migration=${Date.now()}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!response.ok) throw new Error(`Não foi possível carregar os dados públicos atuais (${response.status}).`);
  const payload = await response.json();
  const legacyState = cloneValue(legacyStateFromPayload(payload));
  const state = normalizedPublicState(legacyState);
  const references = [];
  if (legacyState.settings?.logo) references.push({ reference: legacyState.settings.logo, kind: 'club-logo', ownerId: 'settings' });
  for (const member of arrayValue(legacyState.birthdays)) {
    if (member?.photo) references.push({ reference: member.photo, kind: 'member-photo', ownerId: member.id || member.memberNumber || '' });
  }
  const unique = new Map();
  for (const item of references) {
    const key = referenceObjectKey(item.reference);
    if (key && !unique.has(key)) unique.set(key, item);
  }
  const assets = [];
  for (const item of unique.values()) {
    const asset = await legacyMediaAsset(item.reference, legacyUrl, item.kind, item.ownerId);
    if (asset) assets.push(asset);
  }
  const base64Assets = assets.map(asset => ({
    path: asset.path,
    contentType: asset.contentType,
    content: (() => {
      let binary = '';
      for (let index = 0; index < asset.bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...asset.bytes.subarray(index, index + 0x8000));
      }
      return btoa(binary);
    })(),
    encoding: 'base64',
    kind: asset.kind,
    ownerId: asset.ownerId
  }));

  return writeD1PublicState(env, {
    state,
    schemaVersion: Number(payload?.schemaVersion || payload?.version || DEFAULT_SCHEMA_VERSION),
    commitMessage: 'Migração inicial do conteúdo público para o D1',
    mediaAssets: base64Assets,
    expectedPublicRevision: ''
  }, actor);
}

export async function publicPublicationStatus(env) {
  const status = await getD1PublicStatus(env);
  return {
    available: status.available && status.initialized,
    repositoryReady: false,
    databaseReady: status.initialized && status.schemaVersion >= 9,
    source: status.active ? 'd1' : 'not-migrated',
    revision: status.revision,
    updatedAt: status.updatedAt,
    counts: status.counts || {},
    warning: status.error || (!status.active ? 'O conteúdo público ainda precisa ser migrado para o D1.' : '')
  };
}

export async function handlePublicMedia(request, env) {
  const url = new URL(request.url);
  const key = text(url.searchParams.get('key')).trim();
  if (!SAFE_PUBLIC_PATH.test(key) || !key.startsWith(PUBLIC_MEDIA_PREFIX)) {
    return new Response('Mídia pública inválida.', { status: 400 });
  }
  if (!env?.ATTACHMENTS?.get) return new Response('Armazenamento de mídia indisponível.', { status: 503 });
  const object = await env.ATTACHMENTS.get(key);
  if (!object) return new Response('Mídia pública não encontrada.', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('ETag', object.httpEtag || `"${text(object.customMetadata?.checksum)}"`);
  return new Response(object.body, { headers });
}
