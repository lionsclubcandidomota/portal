import {
  CURRENT_SCHEMA_VERSION,
  createPortalEnvelope,
  migratePortalPayload,
  validatePortalState
} from '../../core/portal-schema.js?v=6.38.0';
import {
  findSensitivePortalFields,
  stripSensitivePortalFields
} from '../../core/portal-security.js?v=6.38.0';

export const RECOVERY_SNAPSHOT_VERSION = 1;
export const MAX_RECOVERY_SNAPSHOTS = 12;

export const RECOVERY_AREAS = Object.freeze([
  { key: 'settings', label: 'Configurações', icon: '⚙️', description: 'Identidade visual, valores e preferências do portal.' },
  { key: 'birthdays', label: 'Associados', icon: '👥', description: 'Cadastros, aniversários e referências de fotografias.' },
  { key: 'treasuryAccounts', label: 'Contas da Tesouraria', icon: '🏦', description: 'Contas bancárias, caixa e saldos iniciais.' },
  { key: 'treasuryCategories', label: 'Categorias financeiras', icon: '🏷️', description: 'Categorias usadas nos lançamentos.' },
  { key: 'familyGroups', label: 'Grupos familiares', icon: '🏠', description: 'Titulares e integrantes das mensalidades familiares.' },
  { key: 'mutualGroups', label: 'Grupos de mútuas', icon: '🤲', description: 'Cobranças individuais e associados vinculados às mútuas.' },
  { key: 'treasury', label: 'Movimentações', icon: '💰', description: 'Entradas, saídas e baixas de mensalidades e mútuas.' },
  { key: 'events', label: 'Agenda', icon: '🗓️', description: 'Eventos e agendamentos cadastrados.' },
  { key: 'meetings', label: 'Compromissos', icon: '🤝', description: 'Reuniões e compromissos.' },
  { key: 'notices', label: 'Avisos', icon: '📢', description: 'Comunicados publicados no portal.' }
]);

export const SNAPSHOT_REASON_LABELS = Object.freeze({
  manual: 'Ponto de recuperação manual',
  'before-import': 'Antes de importar um backup',
  'before-publication': 'Antes de publicar alterações',
  'before-discard': 'Antes de descartar alterações',
  'before-reload': 'Antes de recarregar dados publicados',
  'before-restore': 'Antes de restaurar outro ponto'
});

const COLLECTIONS_WITH_IDS = Object.freeze([
  'birthdays',
  'treasuryAccounts',
  'familyGroups',
  'mutualGroups',
  'treasury',
  'events',
  'meetings',
  'notices'
]);

const DATE_FIELDS = Object.freeze({
  birthdays: ['birthDate'],
  mutualGroups: ['referenceDate'],
  treasury: ['date'],
  events: ['date', 'endDate'],
  meetings: ['date'],
  notices: ['date', 'endDate']
});

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function stablePortalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function recoveryChecksum(value) {
  const source = typeof value === 'string' ? value : stablePortalStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function byteLength(value) {
  const source = typeof value === 'string' ? value : JSON.stringify(value);
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(source).length;
  return unescape(encodeURIComponent(source)).length;
}

export function summarizePortalState(state) {
  const entries = (state.treasury || []).filter(item => Number(item?.entry || 0) > 0);
  const exits = (state.treasury || []).filter(item => Number(item?.exit || 0) > 0);
  return {
    birthdays: state.birthdays?.length || 0,
    treasuryAccounts: state.treasuryAccounts?.length || 0,
    familyGroups: state.familyGroups?.length || 0,
    mutualGroups: state.mutualGroups?.length || 0,
    treasury: state.treasury?.length || 0,
    treasuryEntries: entries.length,
    treasuryExits: exits.length,
    events: state.events?.length || 0,
    meetings: state.meetings?.length || 0,
    notices: state.notices?.length || 0
  };
}

export function createRecoverySnapshot({
  state,
  reason = 'manual',
  label = '',
  metadata = {},
  now = () => new Date(),
  id = ''
} = {}) {
  const migrated = migratePortalPayload(state);
  const createdAt = now().toISOString();
  const envelope = createPortalEnvelope(migrated.state, { savedAt: createdAt });
  const serializedPayload = stablePortalStringify(envelope);
  const stateChecksum = recoveryChecksum(stablePortalStringify(migrated.state));
  const suffix = recoveryChecksum(`${createdAt}:${stateChecksum}`).slice(-8);

  return {
    id: id || `recovery-${createdAt.replace(/\D/g, '').slice(0, 14)}-${suffix}`,
    snapshotVersion: RECOVERY_SNAPSHOT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    reason,
    label: String(label || SNAPSHOT_REASON_LABELS[reason] || 'Ponto de recuperação'),
    createdAt,
    checksum: stateChecksum,
    sizeBytes: byteLength(serializedPayload),
    summary: summarizePortalState(migrated.state),
    metadata: stripSensitivePortalFields(metadata || {}),
    payload: envelope
  };
}

export function verifyRecoverySnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['O ponto de recuperação não é um objeto válido.'], state: null };
  }
  if (!snapshot.id) errors.push('Identificador ausente.');
  if (!snapshot.createdAt || Number.isNaN(new Date(snapshot.createdAt).getTime())) {
    errors.push('Data de criação inválida.');
  }

  let state = null;
  try {
    const migrated = migratePortalPayload(snapshot.payload);
    state = migrated.state;
    const expectedChecksum = recoveryChecksum(stablePortalStringify(state));
    if (snapshot.checksum !== expectedChecksum) {
      const legacyState = snapshot.payload?.data || snapshot.payload;
      const legacyChecksum = recoveryChecksum(stablePortalStringify(legacyState));
      if (snapshot.checksum !== legacyChecksum) errors.push('A assinatura de integridade não confere.');
    }
  } catch (error) {
    errors.push(error?.message || 'O conteúdo do ponto não pôde ser lido.');
  }

  return { valid: errors.length === 0, errors, state };
}

export function pruneRecoverySnapshots(snapshots, maximum = MAX_RECOVERY_SNAPSHOTS) {
  return [...(snapshots || [])]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, Math.max(1, Number(maximum) || MAX_RECOVERY_SNAPSHOTS));
}

export function mergeRecoveryAreas(currentState, snapshotState, selectedAreas) {
  const current = migratePortalPayload(currentState).state;
  const recovery = migratePortalPayload(snapshotState).state;
  const selected = new Set(selectedAreas || []);
  const allowed = new Set(RECOVERY_AREAS.map(area => area.key));
  const result = cloneValue(current);

  for (const key of selected) {
    if (allowed.has(key)) result[key] = cloneValue(recovery[key]);
  }
  return migratePortalPayload(result).state;
}

function isIsoDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function createCheck(id, label, status, detail, count = 0) {
  return { id, label, status, detail, count };
}

export function diagnosePortalIntegrity(inputState) {
  let state;
  try {
    state = migratePortalPayload(inputState).state;
  } catch (error) {
    return {
      status: 'error',
      checkedAt: new Date().toISOString(),
      checks: [createCheck('schema', 'Estrutura dos dados', 'error', error?.message || 'Estrutura incompatível.', 1)],
      errors: 1,
      warnings: 0
    };
  }

  const checks = [];
  const schema = validatePortalState(state);
  checks.push(createCheck(
    'schema',
    'Estrutura e esquema',
    schema.valid ? 'ok' : 'error',
    schema.valid ? `Esquema v${CURRENT_SCHEMA_VERSION} reconhecido.` : schema.errors.join(' '),
    schema.errors.length
  ));

  const duplicateDetails = [];
  const missingIdDetails = [];
  for (const collection of COLLECTIONS_WITH_IDS) {
    const seen = new Set();
    for (const item of state[collection] || []) {
      const id = String(item?.id || '').trim();
      if (!id) missingIdDetails.push(collection);
      else if (seen.has(id)) duplicateDetails.push(`${collection}: ${id}`);
      else seen.add(id);
    }
  }
  const idIssues = duplicateDetails.length + missingIdDetails.length;
  checks.push(createCheck(
    'identifiers',
    'Identificadores dos registros',
    idIssues ? 'error' : 'ok',
    idIssues
      ? `${duplicateDetails.length} duplicado(s) e ${missingIdDetails.length} registro(s) sem identificador.`
      : 'Todos os registros possuem identificadores únicos.',
    idIssues
  ));

  const memberIds = new Set((state.birthdays || []).map(item => String(item?.id || '')).filter(Boolean));
  const familyIssues = [];
  for (const group of state.familyGroups || []) {
    const references = [...(group.memberIds || []), group.primaryMemberId].filter(Boolean);
    for (const reference of references) {
      if (!memberIds.has(String(reference))) familyIssues.push(`${group.name || group.id}: ${reference}`);
    }
  }
  checks.push(createCheck(
    'families',
    'Vínculos dos grupos familiares',
    familyIssues.length ? 'error' : 'ok',
    familyIssues.length ? `${familyIssues.length} vínculo(s) apontam para associados inexistentes.` : 'Todos os integrantes estão vinculados a associados existentes.',
    familyIssues.length
  ));

  const mutualIssues = [];
  for (const group of state.mutualGroups || []) {
    const seenMembers = new Set();
    for (const charge of group.memberCharges || []) {
      const reference = String(charge?.memberId || '');
      if (!reference || !memberIds.has(reference)) mutualIssues.push(`${group.name || group.id}: ${reference || 'sem associado'}`);
      if (seenMembers.has(reference)) mutualIssues.push(`${group.name || group.id}: cobrança duplicada para ${reference}`);
      seenMembers.add(reference);
      if (!(Number(charge?.amount || 0) > 0)) mutualIssues.push(`${group.name || group.id}: valor inválido para ${reference}`);
    }
  }
  checks.push(createCheck(
    'mutuals',
    'Vínculos e valores das mútuas',
    mutualIssues.length ? 'error' : 'ok',
    mutualIssues.length ? `${mutualIssues.length} inconsistência(s) encontrada(s) nas cobranças de mútuas.` : 'Todas as cobranças de mútuas são individuais e apontam para associados válidos.',
    mutualIssues.length
  ));

  const accountIds = new Set((state.treasuryAccounts || []).map(item => String(item?.id || '')).filter(Boolean));
  const accountIssues = (state.treasury || []).filter(item => item?.accountId && !accountIds.has(String(item.accountId)));
  checks.push(createCheck(
    'accounts',
    'Contas das movimentações',
    accountIssues.length ? 'error' : 'ok',
    accountIssues.length ? `${accountIssues.length} movimentação(ões) usam contas inexistentes.` : 'Todas as movimentações apontam para contas válidas.',
    accountIssues.length
  ));

  const categories = new Set((state.treasuryCategories || []).map(value => String(value).trim()).filter(Boolean));
  const categoryIssues = (state.treasury || []).filter(item => item?.category && !categories.has(String(item.category).trim()));
  checks.push(createCheck(
    'categories',
    'Categorias das movimentações',
    categoryIssues.length ? 'warning' : 'ok',
    categoryIssues.length ? `${categoryIssues.length} movimentação(ões) usam categorias fora do cadastro atual.` : 'As categorias financeiras estão consistentes.',
    categoryIssues.length
  ));

  let invalidDates = 0;
  for (const [collection, fields] of Object.entries(DATE_FIELDS)) {
    for (const item of state[collection] || []) {
      for (const field of fields) {
        if (item?.[field] && !isIsoDate(item[field])) invalidDates += 1;
      }
    }
  }
  checks.push(createCheck(
    'dates',
    'Datas dos registros',
    invalidDates ? 'warning' : 'ok',
    invalidDates ? `${invalidDates} data(s) não seguem o formato esperado AAAA-MM-DD.` : 'As datas verificadas possuem formato válido.',
    invalidDates
  ));

  const mediaReferences = [
    state.settings?.logo,
    ...(state.birthdays || []).map(item => item?.photo)
  ].filter(Boolean);
  const embeddedMedia = mediaReferences.filter(value => String(value).startsWith('data:image/')).length;
  const suspiciousMedia = mediaReferences.filter(value => {
    const reference = String(value);
    return !reference.startsWith('data:image/')
      && !reference.startsWith('./public/')
      && !reference.startsWith('https://')
      && !reference.startsWith('http://');
  }).length;
  const mediaIssues = embeddedMedia + suspiciousMedia;
  checks.push(createCheck(
    'media',
    'Referências de imagens',
    mediaIssues ? 'warning' : 'ok',
    mediaIssues
      ? `${embeddedMedia} imagem(ns) incorporada(s) e ${suspiciousMedia} referência(s) fora do padrão.`
      : `${mediaReferences.length} referência(s) de mídia seguem o padrão esperado.`,
    mediaIssues
  ));

  const sensitiveFields = findSensitivePortalFields(state);
  checks.push(createCheck(
    'settings-security',
    'Higiene das configurações',
    sensitiveFields.length ? 'error' : 'ok',
    sensitiveFields.length
      ? `${sensitiveFields.length} campo(s) sensível(is) foram encontrados no estado do portal.`
      : 'Nenhuma credencial, token ou segredo foi encontrado nos dados do portal.',
    sensitiveFields.length
  ));

  const errors = checks.filter(check => check.status === 'error').length;
  const warnings = checks.filter(check => check.status === 'warning').length;
  return {
    status: errors ? 'error' : warnings ? 'warning' : 'ok',
    checkedAt: new Date().toISOString(),
    checks,
    errors,
    warnings
  };
}
