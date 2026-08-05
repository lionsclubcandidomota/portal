import { findSensitivePortalFields, stripSensitivePortalFields } from './portal-security.js?v=6.35.1';
import { normalizeMemberRecord } from './portal-members.js?v=6.35.1';
import { createPublicPortalState } from './portal-data-boundary.js?v=6.35.1';

export const PORTAL_APP_ID = 'Lions Clube de Cândido Mota Dashboard';
export const CURRENT_SCHEMA_VERSION = 11;

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
  'notices'
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

function uniqueIds(values = []) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function normalizeMutualGroupRecord(group) {
  const source = isPlainObject(group) ? group : {};
  const legacyCharges = Array.isArray(source.memberCharges) ? source.memberCharges : [];
  const fallbackDate = new Date().toISOString().slice(0, 10);
  const legacyStartedMonth = monthReference(source.startedMonth || source.referenceDate);
  const createdDate = dateReference(
    source.createdDate || source.startedDate,
    legacyStartedMonth ? `${legacyStartedMonth}-01` : fallbackDate
  );
  const membershipSource = Array.isArray(source.memberships) && source.memberships.length
    ? source.memberships
    : legacyCharges.map((charge, index) => ({
      id: `mum_${source.id || 'group'}_${charge?.memberId || index}`,
      memberId: charge?.memberId,
      joinedDate: createdDate,
      endedDate: ''
    }));
  const memberships = membershipSource
    .map((membership, index) => {
      const joinedMonth = monthReference(membership?.joinedMonth);
      const endedMonth = monthReference(membership?.endedMonth);
      return {
        id: String(membership?.id || `mum_${source.id || 'group'}_${membership?.memberId || index}`),
        memberId: String(membership?.memberId || '').trim(),
        joinedDate: dateReference(membership?.joinedDate, joinedMonth ? `${joinedMonth}-01` : createdDate),
        endedDate: dateReference(membership?.endedDate, endedMonth ? `${endedMonth}-01` : '')
      };
    })
    .filter(membership => membership.memberId && membership.joinedDate);
  const fallbackParticipants = uniqueIds(memberships.filter(item => !item.endedDate).map(item => item.memberId));
  const events = (Array.isArray(source.events) ? source.events : [])
    .map((event, index) => {
      const deathDate = dateReference(event?.deathDate || event?.eventDate || event?.chargeDate);
      return {
        id: String(event?.id || `mue_${source.id || 'group'}_${deathDate || index}`),
        deceasedName: String(event?.deceasedName || event?.associateName || event?.title || '').trim(),
        deceasedMemberNumber: String(event?.deceasedMemberNumber || event?.memberNumber || '').trim(),
        deceasedClub: String(event?.deceasedClub || event?.club || '').trim(),
        deathDate,
        dueDate: dateReference(event?.dueDate),
        amountPerParticipant: Math.max(0, Number(event?.amountPerParticipant ?? event?.amount ?? 0)),
        participantIds: uniqueIds(Array.isArray(event?.participantIds) ? event.participantIds : (event?.memberIds || fallbackParticipants)),
        notes: String(event?.notes || '').trim(),
        createdAt: String(event?.createdAt || ''),
        cancelledAt: String(event?.cancelledAt || '')
      };
    })
    .filter(event => event.id && event.deathDate && event.deceasedName && event.amountPerParticipant > 0)
    .sort((first, second) => first.deathDate.localeCompare(second.deathDate));

  const {
    memberCharges: _memberCharges,
    referenceDate: _referenceDate,
    monthlyAmount: _monthlyAmount,
    startedMonth: _startedMonth,
    amountHistory: _amountHistory,
    startedDate: _startedDate,
    endedDate: _endedDate,
    ...rest
  } = source;
  return {
    ...rest,
    id: String(source.id || ''),
    name: String(source.name || '').trim(),
    createdDate,
    closedDate: dateReference(source.closedDate || source.endedDate),
    closureReason: String(source.closureReason || source.endReason || '').trim(),
    notes: String(source.notes || '').trim(),
    memberships,
    events
  };
}

const TREASURY_ATTACHMENT_DATA_URL = /^data:(?:image\/(?:jpeg|jpg|png|webp|gif)|application\/(?:pdf|msword|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.(?:wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.oasis\.opendocument\.(?:text|spreadsheet))|text\/(?:plain|csv));base64,[a-z0-9+/=\s]+$/i;
const TREASURY_ATTACHMENT_PUBLIC_URL = /^\.\/public\/treasury\/[a-z0-9/_-]+\.[a-z0-9]+(?:\?[^\s]*)?$/i;
const TREASURY_ATTACHMENT_R2_KEY = /^treasury\/[a-z0-9/_-]+\.[a-z0-9]+$/i;

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
  const objectKey = TREASURY_ATTACHMENT_R2_KEY.test(String(source.objectKey || '').trim())
    ? String(source.objectKey).trim()
    : '';
  const secure = String(source.storage || '').toLowerCase() === 'r2' && objectKey;

  return {
    id: String(source.id || `att_${index}`),
    name: String(source.name || 'Documento').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').slice(0, 120),
    type: String(source.type || '').slice(0, 120),
    size: Math.max(0, Number(source.size || 0)),
    originalSize: Math.max(0, Number(source.originalSize || source.size || 0)),
    optimized: Boolean(source.optimized),
    ...(secure ? {
      storage: 'r2',
      objectKey,
      checksum: String(source.checksum || '').slice(0, 128),
      uploadedAt: String(source.uploadedAt || '')
    } : {}),
    ...(!secure && dataUrl ? { dataUrl } : {}),
    ...(!secure && url ? { url } : {})
  };
}

function normalizeTreasuryAttachments(value) {
  return (Array.isArray(value) ? value : [])
    .map(normalizeTreasuryAttachmentRecord)
    .filter(attachment => attachment.dataUrl || attachment.url || attachment.objectKey)
    .slice(0, 5);
}

function normalizeMutualMovementRecord(item) {
  if (!isPlainObject(item)) return item;
  const attachments = normalizeTreasuryAttachments(item.attachments);
  if (!item.mutualGroupId) return { ...item, attachments };
  const eventDate = dateReference(
    item.mutualEventDate || item.deathDate || item.mutualReferenceDate || item.date
  );
  const legacyReference = monthReference(
    item.mutualReferenceMonth || item.mutualReferenceDate || item.referenceMonth || item.date
  );
  const memberId = String(item.mutualMemberId || item.memberId || '').trim();
  const eventId = String(item.mutualEventId || (legacyReference ? `legacy-${legacyReference}` : '')).trim();
  const key = [String(item.mutualGroupId || '').trim(), eventId, memberId]
    .filter(Boolean)
    .join('::');
  return {
    ...item,
    attachments,
    mutualMemberId: memberId,
    mutualEventId: eventId,
    mutualEventDate: eventDate,
    mutualDeceasedName: String(item.mutualDeceasedName || item.deceasedName || '').trim(),
    mutualReferenceMonth: legacyReference,
    mutualReferenceDate: eventDate || (legacyReference ? `${legacyReference}-01` : ''),
    referenceMonth: legacyReference || String(item.referenceMonth || ''),
    coveredMonths: legacyReference ? [legacyReference] : (Array.isArray(item.coveredMonths) ? item.coveredMonths : []),
    mutualChargeKey: key || String(item.mutualChargeKey || '')
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
      logo: './public/logo.png',
      primaryColor: '#00529B',
      accentColor: '#F2C100',
      membershipMonthlyFee: 0,
      membershipFamilyPrimaryFee: 0,
      membershipFamilyAdditionalFee: 0,
      accessProfiles: {},
      secureStorage: { version: 1, enabled: false, workerUrl: '' },
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
    notices: []
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
  if (sourceSchemaVersion < 10) migrations.push('v9→v10: anexos financeiros passam a suportar armazenamento privado Cloudflare R2');
  if (sourceSchemaVersion < 11) migrations.push('v10→v11: mútuas passam a gerar cobranças somente por eventos de falecimento');

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
  const audience = String(safeMetadata.audience || '').trim().toLowerCase();
  const envelopeState = audience === 'public' || audience === 'public-cache'
    ? createPublicPortalState(normalized)
    : normalized;
  assertValidPortalState(envelopeState);

  return {
    ...safeMetadata,
    app: PORTAL_APP_ID,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: CURRENT_SCHEMA_VERSION,
    data: envelopeState
  };
}
