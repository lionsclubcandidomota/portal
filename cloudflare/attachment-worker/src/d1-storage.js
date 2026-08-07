export const D1_SCHEMA_VERSION = 2;

const encoder = new TextEncoder();
const D1_JSON_BATCH_BYTES = 512 * 1024;
const D1_MAX_BOUND_BYTES = 1_800_000;
const D1_MAX_WRITE_QUERIES = 40;

const KNOWN_STATE_KEYS = new Set([
  'version',
  'settings',
  'treasuryAccounts',
  'treasuryCategories',
  'familyGroups',
  'mutualGroups',
  'treasury'
]);

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? '');
}

function numeric(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function boolInteger(value) {
  return value === false ? 0 : 1;
}

function parsePayload(value, label) {
  try {
    const parsed = JSON.parse(String(value || 'null'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('payload inválido');
    }
    return parsed;
  } catch {
    throw new Error(`O registro D1 de ${label} contém JSON inválido.`);
  }
}

function uniqueStrings(values) {
  return [...new Set(arrayValue(values).map(value => text(value).trim()).filter(Boolean))];
}

export function hasD1Binding(env) {
  return Boolean(env?.PORTAL_DB && typeof env.PORTAL_DB.prepare === 'function');
}



function treasuryMovementRecord(item, sortOrder = 0) {
  const movement = objectValue(item);
  const movementId = text(movement.id || `movement-${sortOrder}`);
  const attachments = arrayValue(movement.attachments).map((attachmentValue, attachmentSortOrder) => {
    const attachment = objectValue(attachmentValue);
    return {
      id: text(attachment.id || `${movementId}-attachment-${attachmentSortOrder}`),
      movementId,
      sortOrder: attachmentSortOrder,
      objectKey: text(attachment.objectKey) || null,
      name: text(attachment.name),
      type: text(attachment.type),
      size: Math.max(0, numeric(attachment.size)),
      checksum: text(attachment.checksum),
      payload: JSON.stringify(attachment)
    };
  });
  return {
    id: movementId,
    sortOrder: Math.max(0, Number(sortOrder || 0)),
    date: text(movement.date),
    accountId: text(movement.accountId),
    category: text(movement.category),
    status: text(movement.status),
    entryAmount: Math.max(0, numeric(movement.entry)),
    exitAmount: Math.max(0, numeric(movement.exit)),
    mutualGroupId: text(movement.mutualGroupId),
    mutualEventId: text(movement.mutualEventId),
    mutualMemberId: text(movement.mutualMemberId || movement.memberId),
    payload: JSON.stringify(movement),
    attachments
  };
}

export function decomposePrivateState(state) {
  const source = objectValue(state);
  const accounts = arrayValue(source.treasuryAccounts).map((item, sortOrder) => ({
    id: text(item?.id || `account-${sortOrder}`),
    sortOrder,
    name: text(item?.name),
    type: text(item?.type),
    active: boolInteger(item?.active),
    payload: JSON.stringify(objectValue(item))
  }));
  const categories = uniqueStrings(source.treasuryCategories).map((name, sortOrder) => ({ name, sortOrder }));
  const familyGroups = arrayValue(source.familyGroups).map((item, sortOrder) => {
    const group = objectValue(item);
    return {
      id: text(group.id || `family-${sortOrder}`),
      sortOrder,
      name: text(group.name),
      primaryMemberId: text(group.primaryMemberId),
      payload: JSON.stringify(group),
      members: uniqueStrings(group.memberIds).map((memberId, memberSortOrder) => ({ memberId, sortOrder: memberSortOrder }))
    };
  });
  const mutualGroups = arrayValue(source.mutualGroups).map((item, sortOrder) => {
    const group = objectValue(item);
    const groupId = text(group.id || `mutual-${sortOrder}`);
    const memberships = arrayValue(group.memberships).map((membershipValue, membershipSortOrder) => {
      const membership = objectValue(membershipValue);
      return {
        id: text(membership.id || `${groupId}-membership-${membershipSortOrder}`),
        groupId,
        sortOrder: membershipSortOrder,
        memberId: text(membership.memberId),
        joinedDate: text(membership.joinedDate || membership.joinedMonth),
        endedDate: text(membership.endedDate || membership.endedMonth),
        payload: JSON.stringify(membership)
      };
    });
    const events = arrayValue(group.events).map((eventValue, eventSortOrder) => {
      const event = objectValue(eventValue);
      const eventId = text(event.id || `${groupId}-event-${eventSortOrder}`);
      return {
        id: eventId,
        groupId,
        sortOrder: eventSortOrder,
        deceasedName: text(event.deceasedName),
        deathDate: text(event.deathDate),
        dueDate: text(event.dueDate),
        amountPerParticipant: numeric(event.amountPerParticipant),
        payload: JSON.stringify(event),
        participants: uniqueStrings(event.participantIds).map((memberId, participantSortOrder) => ({
          memberId,
          sortOrder: participantSortOrder
        }))
      };
    });
    return {
      id: groupId,
      sortOrder,
      name: text(group.name),
      createdDate: text(group.createdDate || group.startedMonth),
      closedDate: text(group.closedDate),
      payload: JSON.stringify(group),
      memberships,
      events
    };
  });
  const treasury = arrayValue(source.treasury).map((item, sortOrder) => treasuryMovementRecord(item, sortOrder));
  const extras = Object.entries(source)
    .filter(([key]) => !KNOWN_STATE_KEYS.has(key))
    .map(([key, value]) => ({ key, payload: JSON.stringify(value) }));

  return {
    stateVersion: Math.max(1, Number(source.version || 1)),
    settings: JSON.stringify(objectValue(source.settings)),
    accounts,
    categories,
    familyGroups,
    mutualGroups,
    treasury,
    extras
  };
}

export function composePrivateState({ meta = {}, settings = {}, accounts = [], categories = [], familyGroups = [], mutualGroups = [], treasury = [], extras = [] } = {}) {
  const state = {};
  for (const row of extras) {
    try {
      state[text(row.key)] = JSON.parse(String(row.payload || 'null'));
    } catch {
      throw new Error(`O campo adicional ${text(row.key)} contém JSON inválido no D1.`);
    }
  }
  state.version = Math.max(1, Number(meta.state_version || meta.stateVersion || 1));
  state.settings = settings?.payload ? parsePayload(settings.payload, 'configurações') : {};
  state.treasuryAccounts = accounts.map(row => parsePayload(row.payload, `conta ${text(row.id)}`));
  state.treasuryCategories = categories.map(row => text(row.name));
  state.familyGroups = familyGroups.map(row => parsePayload(row.payload, `grupo familiar ${text(row.id)}`));
  state.mutualGroups = mutualGroups.map(row => parsePayload(row.payload, `grupo de mútua ${text(row.id)}`));
  state.treasury = treasury.map(row => parsePayload(row.payload, `movimentação ${text(row.id)}`));
  return state;
}

export async function getD1StorageStatus(env) {
  if (!hasD1Binding(env)) {
    return {
      available: false,
      initialized: false,
      active: false,
      schemaVersion: 0,
      revision: '',
      updatedAt: '',
      counts: {}
    };
  }
  const db = env.PORTAL_DB;
  try {
    const row = await db.prepare(`SELECT
      (SELECT value FROM portal_meta WHERE key = 'migration_complete') AS migration_complete,
      (SELECT value FROM portal_meta WHERE key = 'schema_version') AS schema_version,
      (SELECT value FROM portal_meta WHERE key = 'revision') AS revision,
      (SELECT value FROM portal_meta WHERE key = 'updated_at') AS updated_at,
      (SELECT value FROM portal_meta WHERE key = 'migrated_at') AS migrated_at,
      (SELECT value FROM portal_meta WHERE key = 'updated_by') AS updated_by,
      (SELECT value FROM portal_meta WHERE key = 'checksum') AS checksum,
      (SELECT value FROM portal_meta WHERE key = 'treasury_granular_writes') AS treasury_granular_writes,
      (SELECT COUNT(*) FROM treasury_movements) AS treasury,
      (SELECT COUNT(*) FROM treasury_accounts) AS accounts,
      (SELECT COUNT(*) FROM family_groups) AS family_groups,
      (SELECT COUNT(*) FROM mutual_groups) AS mutual_groups,
      (SELECT COUNT(*) FROM treasury_attachments) AS attachments`).first();
    return {
      available: true,
      initialized: true,
      active: text(row?.migration_complete) === '1',
      schemaVersion: Number(row?.schema_version || 0),
      revision: text(row?.revision),
      updatedAt: text(row?.updated_at),
      migratedAt: text(row?.migrated_at),
      updatedBy: text(row?.updated_by),
      checksum: text(row?.checksum),
      granularTreasury: text(row?.treasury_granular_writes) === '1',
      counts: {
        treasury: Number(row?.treasury || 0),
        accounts: Number(row?.accounts || 0),
        familyGroups: Number(row?.family_groups || 0),
        mutualGroups: Number(row?.mutual_groups || 0),
        attachments: Number(row?.attachments || 0)
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      available: true,
      initialized: false,
      active: false,
      schemaVersion: 0,
      revision: '',
      updatedAt: '',
      counts: {},
      granularTreasury: false,
      error: /no such table/i.test(message) ? '' : message
    };
  }
}

export async function readD1PrivateState(env, { storageStatus = null } = {}) {
  const status = storageStatus || await getD1StorageStatus(env);
  if (!status.available || !status.initialized || !status.active) return null;
  const row = await env.PORTAL_DB.prepare(`SELECT
    payload,
    (SELECT value FROM portal_meta WHERE key = 'revision') AS revision,
    (SELECT value FROM portal_meta WHERE key = 'updated_at') AS updated_at,
    (SELECT value FROM portal_meta WHERE key = 'updated_by') AS updated_by,
    (SELECT value FROM portal_meta WHERE key = 'checksum') AS checksum,
    (SELECT value FROM portal_meta WHERE key = 'migrated_at') AS migrated_at,
    (SELECT value FROM portal_meta WHERE key = 'schema_version') AS schema_version
    FROM portal_state_snapshot WHERE id = 1`).first();
  if (!row?.payload) throw new Error('O D1 está ativo, mas o snapshot privado principal não foi encontrado.');
  let state;
  try {
    state = JSON.parse(String(row.payload));
  } catch {
    throw new Error('O snapshot privado principal do D1 contém JSON inválido.');
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('O snapshot privado principal do D1 está incompleto.');
  }
  return {
    state,
    revision: text(row.revision),
    updatedAt: text(row.updated_at),
    updatedBy: text(row.updated_by),
    checksum: text(row.checksum),
    migratedAt: text(row.migrated_at),
    schemaVersion: Number(row.schema_version || 0)
  };
}

function jsonRowBytes(value) {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

function jsonInsertStatements(db, sql, rows, label) {
  if (!rows.length) return [];
  const chunks = [];
  let current = [];
  let currentBytes = 2;
  for (const row of rows) {
    const rowBytes = jsonRowBytes(row) + (current.length ? 1 : 0);
    if (rowBytes + 2 > D1_MAX_BOUND_BYTES) {
      throw new Error(`Um registro de ${label} excede o limite seguro de gravação do D1.`);
    }
    if (current.length && currentBytes + rowBytes > D1_JSON_BATCH_BYTES) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += rowBytes;
  }
  if (current.length) chunks.push(current);
  return chunks.map(chunk => db.prepare(sql).bind(JSON.stringify(chunk)));
}

export async function writeD1PrivateState(env, state, {
  revision,
  updatedAt,
  updatedBy,
  checksum,
  migratedAt = '',
  activate = true,
  storageStatus = null
} = {}) {
  if (!hasD1Binding(env)) throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  const status = storageStatus || await getD1StorageStatus(env);
  if (!status.initialized) throw new Error('O banco D1 ainda não recebeu as migrações SQL do Portal.');
  if (status.schemaVersion !== D1_SCHEMA_VERSION) {
    throw new Error(`O esquema D1 está na versão ${status.schemaVersion}; o Worker requer a versão ${D1_SCHEMA_VERSION}.`);
  }

  const db = env.PORTAL_DB;
  const model = decomposePrivateState(state);
  const familyMembers = model.familyGroups.flatMap(group => group.members.map(member => ({
    groupId: group.id,
    memberId: member.memberId,
    sortOrder: member.sortOrder
  })));
  const mutualMemberships = model.mutualGroups.flatMap(group => group.memberships);
  const mutualEvents = model.mutualGroups.flatMap(group => group.events);
  const mutualParticipants = mutualEvents.flatMap(event => event.participants.map(participant => ({
    eventId: event.id,
    memberId: participant.memberId,
    sortOrder: participant.sortOrder
  })));
  const attachments = model.treasury.flatMap(movement => movement.attachments.map(attachment => ({
    ...attachment,
    objectKey: attachment.objectKey || null
  })));

  const statements = [
    db.prepare('DELETE FROM treasury_attachments'),
    db.prepare('DELETE FROM treasury_movements'),
    db.prepare('DELETE FROM mutual_event_participants'),
    db.prepare('DELETE FROM mutual_events'),
    db.prepare('DELETE FROM mutual_memberships'),
    db.prepare('DELETE FROM mutual_groups'),
    db.prepare('DELETE FROM family_group_members'),
    db.prepare('DELETE FROM family_groups'),
    db.prepare('DELETE FROM treasury_categories'),
    db.prepare('DELETE FROM treasury_accounts'),
    db.prepare('DELETE FROM portal_extras'),
    db.prepare('DELETE FROM portal_settings'),
    db.prepare('DELETE FROM portal_state_snapshot')
  ];

  statements.push(db.prepare(`INSERT INTO portal_state_snapshot (id, payload, updated_at)
    VALUES (1, ?, ?)` ).bind(JSON.stringify(state), text(updatedAt)));
  statements.push(...jsonInsertStatements(db, `INSERT INTO portal_settings (id, payload, updated_at)
    SELECT 1, json_extract(value, '$.payload'), json_extract(value, '$.updatedAt')
    FROM json_each(?)`, [{ payload: model.settings, updatedAt }], 'configurações'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO treasury_accounts
    (id, sort_order, name, type, active, payload, updated_at)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.sortOrder'),
      json_extract(value, '$.name'), json_extract(value, '$.type'),
      json_extract(value, '$.active'), json_extract(value, '$.payload'),
      json_extract(value, '$.updatedAt') FROM json_each(?)`, model.accounts.map(row => ({ ...row, updatedAt })), 'contas'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO treasury_categories (name, sort_order)
    SELECT json_extract(value, '$.name'), json_extract(value, '$.sortOrder') FROM json_each(?)`, model.categories, 'categorias'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO family_groups
    (id, sort_order, name, primary_member_id, payload, updated_at)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.sortOrder'),
      json_extract(value, '$.name'), json_extract(value, '$.primaryMemberId'),
      json_extract(value, '$.payload'), json_extract(value, '$.updatedAt')
    FROM json_each(?)`, model.familyGroups.map(({ members, ...row }) => ({ ...row, updatedAt })), 'grupos familiares'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO family_group_members (group_id, member_id, sort_order)
    SELECT json_extract(value, '$.groupId'), json_extract(value, '$.memberId'),
      json_extract(value, '$.sortOrder') FROM json_each(?)`, familyMembers, 'participantes familiares'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO mutual_groups
    (id, sort_order, name, created_date, closed_date, payload, updated_at)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.sortOrder'),
      json_extract(value, '$.name'), json_extract(value, '$.createdDate'),
      json_extract(value, '$.closedDate'), json_extract(value, '$.payload'),
      json_extract(value, '$.updatedAt') FROM json_each(?)`, model.mutualGroups.map(({ memberships, events, ...row }) => ({ ...row, updatedAt })), 'grupos de mútua'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO mutual_memberships
    (id, group_id, sort_order, member_id, joined_date, ended_date, payload)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.groupId'),
      json_extract(value, '$.sortOrder'), json_extract(value, '$.memberId'),
      json_extract(value, '$.joinedDate'), json_extract(value, '$.endedDate'),
      json_extract(value, '$.payload') FROM json_each(?)`, mutualMemberships, 'vínculos de mútua'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO mutual_events
    (id, group_id, sort_order, deceased_name, death_date, due_date, amount_per_participant, payload)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.groupId'),
      json_extract(value, '$.sortOrder'), json_extract(value, '$.deceasedName'),
      json_extract(value, '$.deathDate'), json_extract(value, '$.dueDate'),
      json_extract(value, '$.amountPerParticipant'), json_extract(value, '$.payload')
    FROM json_each(?)`, mutualEvents.map(({ participants, ...row }) => row), 'eventos de mútua'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO mutual_event_participants (event_id, member_id, sort_order)
    SELECT json_extract(value, '$.eventId'), json_extract(value, '$.memberId'),
      json_extract(value, '$.sortOrder') FROM json_each(?)`, mutualParticipants, 'cobranças de mútua'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO treasury_movements
    (id, sort_order, movement_date, account_id, category, status, entry_amount, exit_amount,
     mutual_group_id, mutual_event_id, mutual_member_id, payload, updated_at)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.sortOrder'),
      json_extract(value, '$.date'), json_extract(value, '$.accountId'),
      json_extract(value, '$.category'), json_extract(value, '$.status'),
      json_extract(value, '$.entryAmount'), json_extract(value, '$.exitAmount'),
      json_extract(value, '$.mutualGroupId'), json_extract(value, '$.mutualEventId'),
      json_extract(value, '$.mutualMemberId'), json_extract(value, '$.payload'),
      json_extract(value, '$.updatedAt') FROM json_each(?)`, model.treasury.map(({ attachments: ignored, ...row }) => ({ ...row, updatedAt })), 'movimentações'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO treasury_attachments
    (id, movement_id, sort_order, object_key, name, content_type, size_bytes, checksum, payload)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.movementId'),
      json_extract(value, '$.sortOrder'), json_extract(value, '$.objectKey'),
      json_extract(value, '$.name'), json_extract(value, '$.type'),
      json_extract(value, '$.size'), json_extract(value, '$.checksum'),
      json_extract(value, '$.payload') FROM json_each(?)`, attachments, 'anexos'));
  statements.push(...jsonInsertStatements(db, `INSERT INTO portal_extras (key, payload)
    SELECT json_extract(value, '$.key'), json_extract(value, '$.payload') FROM json_each(?)`, model.extras, 'campos adicionais'));

  const metadata = {
    schema_version: String(D1_SCHEMA_VERSION),
    state_version: String(model.stateVersion),
    migration_complete: activate ? '1' : '0',
    revision: text(revision),
    updated_at: text(updatedAt),
    updated_by: text(updatedBy),
    checksum: text(checksum),
    migrated_at: text(migratedAt || status.migratedAt || updatedAt)
  };
  statements.push(...jsonInsertStatements(db, `INSERT INTO portal_meta (key, value)
    SELECT json_extract(value, '$.key'), json_extract(value, '$.value')
    FROM json_each(?) WHERE 1
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`, Object.entries(metadata).map(([key, value]) => ({ key, value })), 'metadados'));

  if (statements.length > D1_MAX_WRITE_QUERIES) {
    throw new Error(`A sincronização exigiria ${statements.length} consultas D1; o limite seguro do Portal é ${D1_MAX_WRITE_QUERIES}.`);
  }
  await db.batch(statements);
  return {
    revision: text(revision),
    updatedAt: text(updatedAt),
    checksum: text(checksum),
    statements: statements.length,
    counts: {
      treasury: model.treasury.length,
      accounts: model.accounts.length,
      categories: model.categories.length,
      familyGroups: model.familyGroups.length,
      mutualGroups: model.mutualGroups.length,
      attachments: attachments.length
    }
  };
}

export async function deactivateD1PrivateState(env) {
  if (!hasD1Binding(env)) throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  const status = await getD1StorageStatus(env);
  if (!status.initialized) throw new Error('O banco D1 ainda não recebeu as migrações SQL do Portal.');
  await env.PORTAL_DB.prepare(`INSERT INTO portal_meta (key, value)
    VALUES ('migration_complete', '0')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run();
  return { active: false };
}


function parseMutationResponse(row) {
  if (!row?.response_json) return null;
  try {
    const response = JSON.parse(String(row.response_json));
    return response && typeof response === 'object' ? response : null;
  } catch {
    return null;
  }
}

export async function readD1Mutation(env, mutationId) {
  if (!hasD1Binding(env) || !mutationId) return null;
  try {
    const row = await env.PORTAL_DB.prepare(`SELECT response_json
      FROM portal_mutations WHERE mutation_id = ?`).bind(text(mutationId)).first();
    return parseMutationResponse(row);
  } catch (error) {
    if (/no such table/i.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}

export async function applyD1TreasuryMutation(env, {
  mutationId,
  expectedRevision,
  revision,
  updatedAt,
  updatedBy,
  checksum,
  nextState,
  upserts = [],
  deletes = [],
  storageStatus = null
} = {}) {
  if (!hasD1Binding(env)) throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  const status = storageStatus || await getD1StorageStatus(env);
  if (!status.initialized || !status.active) throw new Error('O banco D1 ainda não está ativo para gravações granulares.');
  if (status.schemaVersion !== D1_SCHEMA_VERSION) {
    throw new Error(`O esquema D1 está na versão ${status.schemaVersion}; o Worker requer a versão ${D1_SCHEMA_VERSION}.`);
  }

  const normalizedMutationId = text(mutationId).trim();
  if (!/^[a-z0-9_-]{8,120}$/i.test(normalizedMutationId)) {
    throw new Error('O identificador da alteração granular é inválido.');
  }
  const previousResult = await readD1Mutation(env, normalizedMutationId);
  if (previousResult) return { ...previousResult, idempotent: true };

  const uniqueDeletes = uniqueStrings(deletes);
  const normalizedUpserts = arrayValue(upserts).map((item, index) => {
    const source = objectValue(item);
    return treasuryMovementRecord(source.movement || source, Number(source.sortOrder ?? index));
  });
  const upsertIds = new Set();
  for (const row of normalizedUpserts) {
    if (!row.id || upsertIds.has(row.id)) throw new Error('A alteração contém movimentações repetidas ou sem identificador.');
    upsertIds.add(row.id);
  }
  if (normalizedUpserts.length + uniqueDeletes.length > 60) {
    throw new Error('A alteração granular contém registros demais. Use a sincronização completa para esta operação.');
  }
  if (!nextState || typeof nextState !== 'object' || Array.isArray(nextState)) {
    throw new Error('O estado resultante da alteração granular é inválido.');
  }

  const db = env.PORTAL_DB;
  const guardRevision = text(revision);
  const movementRows = normalizedUpserts.map(({ attachments, ...row }) => ({ ...row, updatedAt: text(updatedAt) }));
  const attachmentRows = normalizedUpserts.flatMap(row => row.attachments);
  const response = {
    saved: true,
    mode: 'granular-treasury',
    backend: 'd1',
    revision: guardRevision,
    updatedAt: text(updatedAt),
    checksum: text(checksum),
    mutationId: normalizedMutationId,
    changes: {
      upserted: movementRows.length,
      deleted: uniqueDeletes.length,
      attachments: attachmentRows.length
    }
  };

  const statements = [
    db.prepare(`UPDATE portal_meta SET value = ?
      WHERE key = 'revision' AND value = ?`).bind(guardRevision, text(expectedRevision)),
    db.prepare(`DELETE FROM treasury_movements
      WHERE id IN (SELECT value FROM json_each(?))
        AND EXISTS (SELECT 1 FROM portal_meta WHERE key = 'revision' AND value = ?)`)
      .bind(JSON.stringify(uniqueDeletes), guardRevision),
    db.prepare(`INSERT INTO treasury_movements
      (id, sort_order, movement_date, account_id, category, status, entry_amount, exit_amount,
       mutual_group_id, mutual_event_id, mutual_member_id, payload, updated_at)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.sortOrder'),
        json_extract(value, '$.date'), json_extract(value, '$.accountId'),
        json_extract(value, '$.category'), json_extract(value, '$.status'),
        json_extract(value, '$.entryAmount'), json_extract(value, '$.exitAmount'),
        json_extract(value, '$.mutualGroupId'), json_extract(value, '$.mutualEventId'),
        json_extract(value, '$.mutualMemberId'), json_extract(value, '$.payload'),
        json_extract(value, '$.updatedAt')
      FROM json_each(?)
      WHERE EXISTS (SELECT 1 FROM portal_meta WHERE key = 'revision' AND value = ?) AND 1
      ON CONFLICT(id) DO UPDATE SET
        sort_order = excluded.sort_order,
        movement_date = excluded.movement_date,
        account_id = excluded.account_id,
        category = excluded.category,
        status = excluded.status,
        entry_amount = excluded.entry_amount,
        exit_amount = excluded.exit_amount,
        mutual_group_id = excluded.mutual_group_id,
        mutual_event_id = excluded.mutual_event_id,
        mutual_member_id = excluded.mutual_member_id,
        payload = excluded.payload,
        updated_at = excluded.updated_at`)
      .bind(JSON.stringify(movementRows), guardRevision),
    db.prepare(`DELETE FROM treasury_attachments
      WHERE movement_id IN (SELECT json_extract(value, '$.id') FROM json_each(?))
        AND EXISTS (SELECT 1 FROM portal_meta WHERE key = 'revision' AND value = ?)`)
      .bind(JSON.stringify(movementRows), guardRevision),
    db.prepare(`INSERT INTO treasury_attachments
      (id, movement_id, sort_order, object_key, name, content_type, size_bytes, checksum, payload)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.movementId'),
        json_extract(value, '$.sortOrder'), json_extract(value, '$.objectKey'),
        json_extract(value, '$.name'), json_extract(value, '$.type'),
        json_extract(value, '$.size'), json_extract(value, '$.checksum'),
        json_extract(value, '$.payload')
      FROM json_each(?)
      WHERE EXISTS (SELECT 1 FROM portal_meta WHERE key = 'revision' AND value = ?)`)
      .bind(JSON.stringify(attachmentRows), guardRevision),
    db.prepare(`INSERT INTO portal_state_snapshot (id, payload, updated_at)
      SELECT 1, ?, ?
      WHERE EXISTS (SELECT 1 FROM portal_meta WHERE key = 'revision' AND value = ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
      .bind(JSON.stringify(nextState), text(updatedAt), guardRevision),
    db.prepare(`INSERT INTO portal_meta (key, value)
      SELECT json_extract(value, '$.key'), json_extract(value, '$.value')
      FROM json_each(?)
      WHERE EXISTS (SELECT 1 FROM portal_meta WHERE key = 'revision' AND value = ?) AND 1
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .bind(JSON.stringify([
        { key: 'updated_at', value: text(updatedAt) },
        { key: 'updated_by', value: text(updatedBy) },
        { key: 'checksum', value: text(checksum) },
        { key: 'last_granular_mutation_at', value: text(updatedAt) },
        { key: 'treasury_granular_writes', value: '1' }
      ]), guardRevision),
    db.prepare(`INSERT INTO portal_mutations
      (mutation_id, scope, expected_revision, applied_revision, response_json, actor, created_at)
      SELECT ?, 'treasury', ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM portal_meta WHERE key = 'revision' AND value = ?)`)
      .bind(normalizedMutationId, text(expectedRevision), guardRevision, JSON.stringify(response), text(updatedBy), text(updatedAt), guardRevision),
    db.prepare(`DELETE FROM portal_mutations
      WHERE mutation_id IN (
        SELECT mutation_id FROM portal_mutations ORDER BY created_at DESC LIMIT -1 OFFSET 250
      ) AND EXISTS (SELECT 1 FROM portal_meta WHERE key = 'revision' AND value = ?)`)
      .bind(guardRevision)
  ];

  await db.batch(statements);
  const applied = await readD1Mutation(env, normalizedMutationId);
  if (!applied || applied.revision !== guardRevision) {
    const conflict = new Error('Os dados privados foram atualizados em outra sessão. Recarregue o painel antes de salvar novamente.');
    conflict.code = 'REVISION_CONFLICT';
    throw conflict;
  }
  return { ...applied, idempotent: false, statements: statements.length };
}
