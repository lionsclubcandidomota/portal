import { findSensitivePortalFields, stripSensitivePortalFields } from './portal-security.js?v=6.46.4';
import { memberIsActive, normalizeMemberRecord } from './portal-members.js?v=6.46.4';
import {
  defaultAccessRoles,
  normalizeAccessRoleRecord,
  normalizePortalUserRecord
} from './portal-access.js?v=6.46.4';
import {
  assignmentDateRangeIsValid,
  lionYearBounds,
  lionYearForDate,
  normalizeLeadershipAssignmentRecord
} from './portal-leadership.js?v=6.46.4';

export const PORTAL_APP_ID = 'Lions Clube de Cândido Mota Dashboard';
export const CURRENT_SCHEMA_VERSION = 12;

export const DEFAULT_TREASURY_CATEGORIES = Object.freeze([
  'Mensalidades',
  'Mútuas',
  'Material de escritório',
  'Documentação',
  'Projeto',
  'Evento',
  'Patrocínio',
  'Combustível',
  'Taxa bancária',
  'Doação',
  'Outros'
]);

const COLLECTION_FIELDS = Object.freeze([
  'birthdays',
  'treasuryAccounts',
  'treasuryCategories',
  'familyGroups',
  'mutualGroups',
  'treasury',
  'events',
  'meetings',
  'notices',
  'accessRoles',
  'portalUsers',
  'leadershipAssignments'
]);

const ENVELOPE_FIELDS = new Set([
  'app',
  'version',
  'schemaVersion',
  'exportedAt',
  'savedAt',
  'updatedAt',
  'deploymentId',
  'data'
]);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function monthReference(value, fallback = '') {
  const normalized = String(value || '').trim().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(normalized) ? normalized : String(fallback || '');
}

function dateReference(value, fallback = '') {
  const normalized = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : String(fallback || '');
}

function normalizeMutualEventRecord(event, index = 0) {
  const source = isPlainObject(event) ? event : {};
  return {
    id: String(source.id || `mue_${index}`),
    deceasedName: String(source.deceasedName || source.name || '').trim(),
    occurrenceDate: dateReference(source.occurrenceDate || source.date),
    amount: Math.max(0, Number(source.amount || 0)),
    participantIds: [...new Set((Array.isArray(source.participantIds) ? source.participantIds : [])
      .map(value => String(value || '').trim())
      .filter(Boolean))],
    notes: String(source.notes || '').trim(),
    createdDate: dateReference(source.createdDate),
    createdAt: String(source.createdAt || '')
  };
}

function normalizeMutualGroupRecord(group) {
  const source = isPlainObject(group) ? group : {};
  const legacyCharges = Array.isArray(source.memberCharges) ? source.memberCharges : [];
  const fallbackMonth = new Date().toISOString().slice(0, 7);
  const startedMonth = monthReference(source.startedMonth || source.referenceDate, fallbackMonth);
  const membershipSource = Array.isArray(source.memberships) && source.memberships.length
    ? source.memberships
    : legacyCharges.map((charge, index) => ({
      id: `mum_${source.id || 'group'}_${charge?.memberId || index}`,
      memberId: charge?.memberId,
      joinedMonth: startedMonth,
      endedMonth: ''
    }));
  const memberships = membershipSource
    .map((membership, index) => ({
      id: String(membership?.id || `mum_${source.id || 'group'}_${membership?.memberId || index}`),
      memberId: String(membership?.memberId || '').trim(),
      joinedMonth: monthReference(membership?.joinedMonth, startedMonth),
      endedMonth: monthReference(membership?.endedMonth)
    }))
    .filter(membership => membership.memberId && membership.joinedMonth);
  const eventSource = Array.isArray(source.events)
    ? source.events
    : Array.isArray(source.chargeEvents)
      ? source.chargeEvents
      : Array.isArray(source.occurrences)
        ? source.occurrences
        : [];
  const events = eventSource
    .map(normalizeMutualEventRecord)
    .filter(event => event.id && event.deceasedName && event.occurrenceDate && event.amount > 0)
    .sort((first, second) => second.occurrenceDate.localeCompare(first.occurrenceDate));

  const {
    memberCharges: _memberCharges,
    referenceDate: _referenceDate,
    monthlyAmount: _monthlyAmount,
    amountHistory: _amountHistory,
    startedMonth: _startedMonth,
    chargeEvents: _chargeEvents,
    occurrences: _occurrences,
    ...rest
  } = source;
  return {
    ...rest,
    id: String(source.id || ''),
    name: String(source.name || '').trim(),
    notes: String(source.notes || '').trim(),
    memberships,
    events
  };
}

const TREASURY_ATTACHMENT_DATA_URL = /^data:(?:image\/(?:jpeg|jpg|png|webp|gif)|application\/(?:pdf|msword|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.(?:wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.oasis\.opendocument\.(?:text|spreadsheet))|text\/(?:plain|csv));base64,[a-z0-9+/=\s]+$/i;
const TREASURY_ATTACHMENT_PUBLIC_URL = /^\.\/public\/treasury\/[a-z0-9/_-]+\.[a-z0-9]+(?:\?[^\s]*)?$/i;

function normalizeTreasuryAttachmentRecord(attachment, index = 0) {
  const source = isPlainObject(attachment) ? attachment : {};
  const embedded = String(source.dataUrl || source.content || '').trim();
  const publicUrl = String(source.url || source.reference || '').trim();
  const dataUrl = TREASURY_ATTACHMENT_DATA_URL.test(embedded) ? embedded : '';
  const url = TREASURY_ATTACHMENT_PUBLIC_URL.test(publicUrl)
    ? publicUrl
    : publicUrl.startsWith('public/treasury/') && !publicUrl.includes('..')
      ? `./${publicUrl}`
      : '';

  return {
    id: String(source.id || `att_${index}`),
    name: String(source.name || 'Documento').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').slice(0, 120),
    type: String(source.type || '').slice(0, 120),
    size: Math.max(0, Number(source.size || 0)),
    originalSize: Math.max(0, Number(source.originalSize || source.size || 0)),
    optimized: Boolean(source.optimized),
    ...(dataUrl ? { dataUrl } : {}),
    ...(url ? { url } : {})
  };
}

function normalizeTreasuryAttachments(value) {
  return (Array.isArray(value) ? value : [])
    .map(normalizeTreasuryAttachmentRecord)
    .filter(attachment => attachment.dataUrl || attachment.url)
    .slice(0, 5);
}

function normalizeMutualMovementRecord(item) {
  if (!isPlainObject(item)) return item;
  const attachments = normalizeTreasuryAttachments(item.attachments);
  if (!item.mutualGroupId) return { ...item, attachments };
  const reference = monthReference(
    item.mutualReferenceMonth || item.mutualReferenceDate || item.referenceMonth || item.date
  );
  const occurrenceDate = dateReference(item.mutualReferenceDate || item.occurrenceDate || item.date);
  const memberId = String(item.mutualMemberId || item.memberId || '').trim();
  const eventId = String(item.mutualEventId || '').trim();
  const eventKey = [String(item.mutualGroupId || '').trim(), eventId, memberId]
    .filter(Boolean)
    .join('::');
  const legacyKey = [String(item.mutualGroupId || '').trim(), memberId, reference]
    .filter(Boolean)
    .join('::');
  return {
    ...item,
    attachments,
    mutualEventId: eventId,
    mutualMemberId: memberId,
    mutualReferenceMonth: reference,
    mutualReferenceDate: occurrenceDate || (reference ? `${reference}-01` : ''),
    referenceMonth: reference || String(item.referenceMonth || ''),
    coveredMonths: reference ? [reference] : (Array.isArray(item.coveredMonths) ? item.coveredMonths : []),
    mutualChargeKey: String(item.mutualChargeKey || eventKey || legacyKey)
  };
}

export class PortalSchemaError extends Error {
  constructor(message, code = 'INVALID_PORTAL_SCHEMA', details = {}) {
    super(message);
    this.name = 'PortalSchemaError';
    this.code = code;
    this.details = details;
  }
}

export function createDefaultPortalState() {
  return {
    settings: {
      clubName: 'Lions Clube de Cândido Mota',
      logo: './public/logo-ui.webp',
      primaryColor: '#00529B',
      accentColor: '#F2C100',
      fontFamily: 'modern',
      membershipMonthlyFee: 0,
      membershipFamilyPrimaryFee: 0,
      membershipFamilyAdditionalFee: 0,
      accessProfiles: {},
      initialized: false
    },
    birthdays: [],
    treasuryAccounts: [],
    treasuryCategories: [...DEFAULT_TREASURY_CATEGORIES],
    familyGroups: [],
    mutualGroups: [],
    treasury: [],
    events: [],
    meetings: [],
    notices: [],
    accessRoles: defaultAccessRoles(),
    portalUsers: [],
    leadershipAssignments: []
  };
}

export function detectPortalSchemaVersion(payload) {
  if (!isPlainObject(payload)) return 0;

  const explicit = Number(payload.schemaVersion);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;

  if (isPlainObject(payload.data) && (payload.app || payload.exportedAt || payload.deploymentId)) {
    const legacy = Number(payload.version);
    if (Number.isInteger(legacy) && legacy >= 0) return legacy;
  }

  return 0;
}

function extractLegacyState(payload) {
  if (!isPlainObject(payload)) {
    throw new PortalSchemaError('O conteúdo não possui uma estrutura de dados válida.');
  }

  if (!isPlainObject(payload.data)) {
    return cloneValue(payload);
  }

  const data = cloneValue(payload.data);

  for (const field of COLLECTION_FIELDS) {
    if (!hasOwn(data, field) && hasOwn(payload, field)) {
      data[field] = cloneValue(payload[field]);
    }
  }

  if (isPlainObject(payload.settings) || isPlainObject(data.settings)) {
    data.settings = {
      ...(isPlainObject(payload.settings) ? cloneValue(payload.settings) : {}),
      ...(isPlainObject(data.settings) ? cloneValue(data.settings) : {})
    };
  }

  return data;
}

function removeEnvelopeFieldsFromRawState(state) {
  if (!isPlainObject(state) || isPlainObject(state.data)) return state;
  const clean = {};
  for (const [key, value] of Object.entries(state)) {
    if (!ENVELOPE_FIELDS.has(key) || key === 'updatedAt' || key === 'deploymentId') {
      clean[key] = value;
    }
  }
  return clean;
}

export function normalizePortalStateShape(value) {
  if (!isPlainObject(value)) {
    throw new PortalSchemaError('O estado do portal deve ser um objeto JSON.');
  }

  const defaults = createDefaultPortalState();
  const state = stripSensitivePortalFields(removeEnvelopeFieldsFromRawState(cloneValue(value)));
  const normalized = {
    ...defaults,
    ...state,
    settings: {
      ...defaults.settings,
      ...(isPlainObject(state.settings) ? state.settings : {})
    }
  };

  for (const field of COLLECTION_FIELDS) {
    if (field === 'treasuryCategories') {
      const currentCategories = Array.isArray(state[field]) ? state[field] : [];
      normalized[field] = [...new Set([...DEFAULT_TREASURY_CATEGORIES, ...currentCategories].filter(Boolean))];
    } else if (Array.isArray(state[field])) {
      normalized[field] = state[field];
    } else {
      normalized[field] = [];
    }
  }

  normalized.birthdays = normalized.birthdays.map(normalizeMemberRecord);
  normalized.mutualGroups = normalized.mutualGroups.map(normalizeMutualGroupRecord);
  normalized.treasury = normalized.treasury.map(normalizeMutualMovementRecord);

  const roleSource = Array.isArray(state.accessRoles) && state.accessRoles.length
    ? state.accessRoles
    : defaultAccessRoles();
  const roleMap = new Map();
  roleSource.map(normalizeAccessRoleRecord).forEach(role => {
    if (role.id && role.name && !roleMap.has(role.id)) roleMap.set(role.id, role);
  });
  defaultAccessRoles().forEach(role => {
    if (!roleMap.has(role.id)) roleMap.set(role.id, role);
  });
  normalized.accessRoles = [...roleMap.values()];

  const knownMembers = new Set(normalized.birthdays.map(member => member.id));
  const knownRoles = new Set(normalized.accessRoles.map(role => role.id));
  const usernames = new Set();
  const memberUsers = new Set();
  normalized.portalUsers = (Array.isArray(state.portalUsers) ? state.portalUsers : [])
    .map(normalizePortalUserRecord)
    .filter(user => {
      if (!user.id || !user.username || !knownMembers.has(user.memberId) || !knownRoles.has(user.roleId)) return false;
      if (usernames.has(user.username) || memberUsers.has(user.memberId)) return false;
      usernames.add(user.username);
      memberUsers.add(user.memberId);
      return true;
    });

  const assignmentIds = new Set();
  normalized.leadershipAssignments = (Array.isArray(state.leadershipAssignments) ? state.leadershipAssignments : [])
    .map(normalizeLeadershipAssignmentRecord)
    .filter(assignment => {
      if (!assignment.id || assignmentIds.has(assignment.id)) return false;
      if (!knownMembers.has(assignment.memberId) || !knownRoles.has(assignment.roleId)) return false;
      if (!assignmentDateRangeIsValid(assignment)) return false;
      assignmentIds.add(assignment.id);
      return true;
    });

  const currentLionYear = lionYearForDate(new Date());
  const currentBounds = lionYearBounds(currentLionYear);
  normalized.portalUsers.forEach((user, index) => {
    const hasHistory = normalized.leadershipAssignments.some(assignment => assignment.memberId === user.memberId);
    if (hasHistory || !knownRoles.has(user.roleId)) return;
    normalized.leadershipAssignments.push(normalizeLeadershipAssignmentRecord({
      id: `leadership-migrated-${user.id || index + 1}`,
      memberId: user.memberId,
      roleId: user.roleId,
      lionYear: currentLionYear,
      startsOn: currentBounds.startsOn,
      endsOn: currentBounds.endsOn,
      active: user.active !== false,
      notes: 'Cargo migrado automaticamente do acesso individual.',
      createdAt: user.createdAt || '',
      updatedAt: user.updatedAt || ''
    }, normalized.leadershipAssignments.length));
  });

  return normalized;
}

export function validatePortalState(value) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(value)) {
    errors.push('O estado raiz deve ser um objeto.');
    return { valid: false, errors, warnings };
  }

  if (!isPlainObject(value.settings)) errors.push('settings deve ser um objeto.');

  for (const field of COLLECTION_FIELDS) {
    if (!Array.isArray(value[field])) errors.push(`${field} deve ser uma lista.`);
  }

  const roleIds = new Set();
  const roleNames = new Set();
  for (const role of Array.isArray(value.accessRoles) ? value.accessRoles : []) {
    if (!role?.id || !role?.name) errors.push('Todo cargo deve possuir identificador e nome.');
    if (roleIds.has(role?.id)) errors.push(`Cargo duplicado: ${role?.id}.`);
    if (roleNames.has(String(role?.name || '').trim().toLocaleLowerCase('pt-BR'))) errors.push(`Nome de cargo duplicado: ${role?.name}.`);
    roleIds.add(role?.id);
    roleNames.add(String(role?.name || '').trim().toLocaleLowerCase('pt-BR'));
  }

  const userIds = new Set();
  const usernames = new Set();
  const userMembers = new Set();
  const membersById = new Map((Array.isArray(value.birthdays) ? value.birthdays : []).map(member => [member.id, member]));
  const memberIds = new Set(membersById.keys());
  for (const user of Array.isArray(value.portalUsers) ? value.portalUsers : []) {
    if (!user?.id || !user?.username || !user?.memberId || !user?.roleId) errors.push('Todo usuário deve estar vinculado a um associado e a um cargo.');
    if (userIds.has(user?.id)) errors.push(`Usuário duplicado: ${user?.id}.`);
    if (usernames.has(user?.username)) errors.push(`Nome de usuário duplicado: ${user?.username}.`);
    if (userMembers.has(user?.memberId)) errors.push('Um associado não pode possuir mais de um usuário individual.');
    if (user?.memberId && !memberIds.has(user.memberId)) errors.push(`Usuário vinculado a um associado inexistente: ${user.memberId}.`);
    if (user?.active !== false && user?.memberId && memberIds.has(user.memberId) && !memberIsActive(membersById.get(user.memberId))) {
      errors.push(`Usuário ativo vinculado a uma pessoa que não é associada ativa: ${user.memberId}.`);
    }
    if (user?.roleId && !roleIds.has(user.roleId)) errors.push(`Usuário vinculado a um cargo inexistente: ${user.roleId}.`);
    const validPasswordHash = /^[a-f0-9]{64}$/i.test(String(user?.passwordHash || ''));
    const validPasswordSalt = /^[a-f0-9]{32}$/i.test(String(user?.passwordSalt || ''));
    if (user?.active !== false && (!validPasswordHash || !validPasswordSalt || Number(user?.passwordIterations || 0) < 100000)) {
      errors.push(`O usuário ${user.username || user.id} não possui uma senha configurada corretamente.`);
    } else {
      if (user?.passwordHash && !validPasswordHash) errors.push(`Hash de senha inválido para o usuário ${user.username || user.id}.`);
      if (user?.passwordSalt && !validPasswordSalt) errors.push(`Identificador de segurança inválido para o usuário ${user.username || user.id}.`);
    }
    userIds.add(user?.id);
    usernames.add(user?.username);
    userMembers.add(user?.memberId);
  }

  const assignmentIds = new Set();
  for (const assignment of Array.isArray(value.leadershipAssignments) ? value.leadershipAssignments : []) {
    if (!assignment?.id || !assignment?.memberId || !assignment?.roleId || !assignment?.lionYear) {
      errors.push('Todo histórico de cargo deve possuir associado, cargo e Ano Leonístico.');
    }
    if (assignmentIds.has(assignment?.id)) errors.push(`Histórico de cargo duplicado: ${assignment?.id}.`);
    if (assignment?.memberId && !memberIds.has(assignment.memberId)) errors.push(`Cargo vinculado a um associado inexistente: ${assignment.memberId}.`);
    if (assignment?.roleId && !roleIds.has(assignment.roleId)) errors.push(`Histórico vinculado a um cargo inexistente: ${assignment.roleId}.`);
    if (!assignmentDateRangeIsValid(assignment)) errors.push(`Período inválido no histórico de cargo ${assignment?.id || ''}.`);
    assignmentIds.add(assignment?.id);
  }

  const activeAssignments = (Array.isArray(value.leadershipAssignments) ? value.leadershipAssignments : [])
    .filter(assignment => assignment?.active !== false && assignmentDateRangeIsValid(assignment));
  for (let firstIndex = 0; firstIndex < activeAssignments.length; firstIndex += 1) {
    const first = activeAssignments[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < activeAssignments.length; secondIndex += 1) {
      const second = activeAssignments[secondIndex];
      if (first.memberId !== second.memberId) continue;
      if (first.startsOn <= second.endsOn && second.startsOn <= first.endsOn) {
        errors.push(`O associado ${first.memberId} possui cargos ativos sobrepostos no histórico.`);
      }
    }
  }

  const sensitivePaths = findSensitivePortalFields(value);
  if (sensitivePaths.length) {
    errors.push(`Campos sensíveis não são permitidos no estado do portal: ${sensitivePaths.join(', ')}.`);
  }

  if (!value.settings?.clubName) warnings.push('O nome do clube não está definido.');
  if (!value.settings?.initialized) warnings.push('O portal ainda não foi marcado como inicializado.');

  const embeddedPhotos = Array.isArray(value.birthdays)
    ? value.birthdays.filter(item => String(item?.photo || '').startsWith('data:image/')).length
    : 0;
  if (embeddedPhotos > 0) {
    warnings.push(`${embeddedPhotos} foto(s) incorporada(s) serão convertidas em arquivos na próxima publicação.`);
  }
  if (String(value.settings?.logo || '').startsWith('data:image/')) {
    warnings.push('O logotipo incorporado será convertido em arquivo na próxima publicação.');
  }

  const embeddedAttachments = Array.isArray(value.treasury)
    ? value.treasury.reduce((total, item) => total + (Array.isArray(item?.attachments)
      ? item.attachments.filter(attachment => String(attachment?.dataUrl || '').startsWith('data:')).length
      : 0), 0)
    : 0;
  if (embeddedAttachments > 0) {
    warnings.push(`${embeddedAttachments} anexo(s) financeiro(s) serão convertidos em arquivos na próxima publicação.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidPortalState(value) {
  const validation = validatePortalState(value);
  if (!validation.valid) {
    throw new PortalSchemaError(
      `O arquivo possui uma estrutura incompatível: ${validation.errors.join(' ')}`,
      'INVALID_PORTAL_STATE',
      validation
    );
  }
  return value;
}

export function migratePortalPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new PortalSchemaError('O arquivo JSON não contém um objeto válido.');
  }

  const sourceSchemaVersion = detectPortalSchemaVersion(payload);
  if (sourceSchemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new PortalSchemaError(
      `Este arquivo utiliza o esquema ${sourceSchemaVersion}, mas esta versão do portal suporta até o esquema ${CURRENT_SCHEMA_VERSION}. Atualize o portal antes de importar ou editar esses dados.`,
      'UNSUPPORTED_FUTURE_SCHEMA',
      { sourceSchemaVersion, supportedSchemaVersion: CURRENT_SCHEMA_VERSION }
    );
  }

  const migrations = [];
  let state = extractLegacyState(payload);

  if (sourceSchemaVersion < 1) migrations.push('v0→v1: estado local sem envelope');
  if (sourceSchemaVersion < 2) migrations.push('v1→v2: envelope de backup normalizado');
  if (sourceSchemaVersion < 3) migrations.push('v2→v3: coleções e configurações consolidadas em data');
  if (sourceSchemaVersion < 4) migrations.push('v3→v4: imagens incorporadas passam a ser publicadas como arquivos independentes');
  if (sourceSchemaVersion < 5) migrations.push('v4→v5: credenciais legadas e campos sensíveis são removidos dos dados do portal');
  if (sourceSchemaVersion < 6) migrations.push('v5→v6: grupos e cobranças individuais de mútuas são incorporados ao portal');
  if (sourceSchemaVersion < 7) migrations.push('v6→v7: mútuas passam a usar grupos mensais, competências e histórico de participantes');
  if (sourceSchemaVersion < 8) migrations.push('v7→v8: cadastros passam a distinguir Associados, Mutuários e registros inativos');
  if (sourceSchemaVersion < 9) migrations.push('v8→v9: movimentações financeiras passam a aceitar comprovantes e documentos anexos');
  if (sourceSchemaVersion < 10) migrations.push('v9→v10: cobranças de mútuas deixam de ser mensais e passam a existir somente por ocorrência de falecimento');
  if (sourceSchemaVersion < 11) migrations.push('v10→v11: usuários individuais, cargos e permissões passam a integrar o Portal');
  if (sourceSchemaVersion < 12) migrations.push('v11→v12: cargos passam a ser vinculados ao Ano Leonístico com histórico e expiração automática');

  state = normalizePortalStateShape(state);
  assertValidPortalState(state);

  return {
    state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sourceSchemaVersion,
    migrated: sourceSchemaVersion !== CURRENT_SCHEMA_VERSION,
    migrations,
    metadata: {
      app: payload.app || '',
      exportedAt: payload.exportedAt || '',
      savedAt: payload.savedAt || '',
      updatedAt: payload.updatedAt || state.updatedAt || '',
      deploymentId: payload.deploymentId || state.deploymentId || ''
    }
  };
}

export function createPortalEnvelope(state, metadata = {}) {
  const normalized = normalizePortalStateShape(state);
  const safeMetadata = stripSensitivePortalFields(metadata);
  assertValidPortalState(normalized);

  return {
    ...safeMetadata,
    app: PORTAL_APP_ID,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: CURRENT_SCHEMA_VERSION,
    data: normalized
  };
}
