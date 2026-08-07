import { memberCanJoinMutual, memberIsActive, memberIsInactive, memberIsMutual, memberStatusKey, memberStatusLabel } from '../../core/portal-members.js?v=6.42.0';

export const DEFAULT_ACCOUNTS = Object.freeze([
  { id: 'acc-current', name: 'Conta corrente', type: 'Conta corrente', initialBalance: 0, active: true },
  { id: 'acc-investment', name: 'Aplicação', type: 'Aplicação', initialBalance: 0, active: true },
  { id: 'acc-cash', name: 'Dinheiro em caixa', type: 'Dinheiro em caixa', initialBalance: 0, active: true }
]);

export const DEFAULT_CATEGORIES = Object.freeze([
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

export const ALLOWED_SECTIONS = new Set(['overview', 'memberships', 'mutuals', 'movements']);

export function normalizeTreasurySection(value) {
  if (value === 'launches') return 'movements';
  return ALLOWED_SECTIONS.has(value) ? value : 'movements';
}

export const PERIOD_LABELS = Object.freeze({
  all: 'Todo o período',
  month: 'Mês atual',
  '30days': 'Últimos 30 dias',
  year: 'Ano atual',
  custom: 'Período personalizado'
});

export function memberIds(item) {
  return Array.isArray(item?.memberIds) && item.memberIds.length
    ? item.memberIds
    : (item?.memberId ? [item.memberId] : []);
}

export function referenceMonth(item, parseDate) {
  const explicit = String(item?.referenceMonth || '').trim();
  if (/^\d{4}-\d{2}$/.test(explicit)) return explicit;

  const date = parseDate(item?.date);
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return 'Mês não informado';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
}


export function normalizeMonthReference(value, fallback = '') {
  const normalized = String(value || '').trim().slice(0, 7);
  return /^\d{4}-\d{2}$/.test(normalized) ? normalized : String(fallback || '');
}

export function normalizeDateReference(value, fallback = '') {
  const normalized = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : String(fallback || '');
}

export function mutualChargeKey(groupId, eventId, memberId) {
  return [groupId, eventId, memberId]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join('::');
}

export function mutualEventDate(item, parseDate) {
  const explicit = normalizeDateReference(item?.mutualEventDate || item?.deathDate || item?.eventDate);
  if (explicit) return explicit;
  const date = parseDate(item?.date);
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function mutualReferenceMonth(item, parseDate) {
  const eventDate = mutualEventDate(item, parseDate);
  if (eventDate) return eventDate.slice(0, 7);
  const explicit = normalizeMonthReference(item?.mutualReferenceMonth || item?.mutualReferenceDate);
  if (explicit) return explicit;
  return referenceMonth(item, parseDate);
}

function uniqueIds(values = []) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

export function normalizeMutualEvent(event, groupId = '', fallback = {}) {
  const source = event && typeof event === 'object' ? event : {};
  const deathDate = normalizeDateReference(
    source.deathDate || source.eventDate || source.chargeDate,
    normalizeDateReference(fallback.deathDate)
  );
  const amountPerParticipant = Math.max(0, Number(
    source.amountPerParticipant ?? source.amount ?? fallback.amountPerParticipant ?? 0
  ));
  const participantIds = uniqueIds(
    Array.isArray(source.participantIds)
      ? source.participantIds
      : Array.isArray(source.memberIds)
        ? source.memberIds
        : fallback.participantIds || []
  );
  return {
    id: String(source.id || `mue_${groupId || 'group'}_${deathDate || 'event'}`),
    deceasedName: String(source.deceasedName || source.associateName || source.title || '').trim(),
    deceasedMemberNumber: String(source.deceasedMemberNumber || source.memberNumber || '').trim(),
    deceasedClub: String(source.deceasedClub || source.club || '').trim(),
    deathDate,
    dueDate: normalizeDateReference(source.dueDate),
    amountPerParticipant,
    participantIds,
    notes: String(source.notes || '').trim(),
    createdAt: String(source.createdAt || ''),
    cancelledAt: String(source.cancelledAt || '')
  };
}

export function normalizeMutualGroup(group, fallbackDate = '') {
  const source = group && typeof group === 'object' ? group : {};
  const legacyCharges = Array.isArray(source.memberCharges) ? source.memberCharges : [];
  const legacyStartedMonth = normalizeMonthReference(source.startedMonth || source.referenceDate);
  const createdDate = normalizeDateReference(
    source.createdDate || source.startedDate,
    legacyStartedMonth ? `${legacyStartedMonth}-01` : normalizeDateReference(fallbackDate)
  );
  const legacyMemberIds = legacyCharges.map(charge => charge?.memberId);
  const membershipSource = Array.isArray(source.memberships) && source.memberships.length
    ? source.memberships
    : legacyMemberIds.map((memberId, index) => ({
      id: `mum_${source.id || 'group'}_${memberId || index}`,
      memberId,
      joinedDate: createdDate,
      endedDate: ''
    }));
  const memberships = membershipSource
    .map((membership, index) => {
      const joinedMonth = normalizeMonthReference(membership?.joinedMonth);
      const endedMonth = normalizeMonthReference(membership?.endedMonth);
      return {
        id: String(membership?.id || `mum_${source.id || 'group'}_${membership?.memberId || index}`),
        memberId: String(membership?.memberId || '').trim(),
        joinedDate: normalizeDateReference(membership?.joinedDate, joinedMonth ? `${joinedMonth}-01` : createdDate),
        endedDate: normalizeDateReference(membership?.endedDate, endedMonth ? `${endedMonth}-01` : '')
      };
    })
    .filter(membership => membership.memberId && membership.joinedDate);
  const events = (Array.isArray(source.events) ? source.events : [])
    .map(event => normalizeMutualEvent(event, source.id, {
      participantIds: memberships.filter(item => !item.endedDate).map(item => item.memberId)
    }))
    .filter(event => event.id && event.deathDate && event.deceasedName && event.amountPerParticipant > 0)
    .sort((first, second) => first.deathDate.localeCompare(second.deathDate));

  const {
    memberCharges: _legacyCharges,
    referenceDate: _legacyReference,
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
    closedDate: normalizeDateReference(source.closedDate || source.endedDate),
    closureReason: String(source.closureReason || source.endReason || '').trim(),
    notes: String(source.notes || '').trim(),
    memberships,
    events
  };
}

export function mutualGroupIsActive(group, onDate = '') {
  const normalized = normalizeMutualGroup(group, onDate);
  const reference = normalizeDateReference(onDate);
  if (!normalized.closedDate) return true;
  return reference ? normalized.closedDate >= reference : false;
}

export function mutualMemberIsIncluded(group, memberId, date) {
  const reference = normalizeDateReference(date);
  const normalizedId = String(memberId || '');
  if (!reference || !normalizedId) return false;
  const normalized = normalizeMutualGroup(group, reference);
  return normalized.memberships.some(membership => (
    String(membership.memberId) === normalizedId
    && membership.joinedDate <= reference
    && (!membership.endedDate || membership.endedDate >= reference)
  ));
}

export function mutualMemberIdsForDate(group, date) {
  const normalized = normalizeMutualGroup(group, date);
  return uniqueIds(normalized.memberships
    .filter(membership => mutualMemberIsIncluded(normalized, membership.memberId, date))
    .map(membership => membership.memberId));
}

export function mutualEventFor(group, eventId) {
  const normalized = normalizeMutualGroup(group);
  return normalized.events.find(event => String(event.id) === String(eventId || '')) || null;
}

export function mutualEventMemberIds(event) {
  return uniqueIds(Array.isArray(event?.participantIds) ? event.participantIds : []);
}

export function isMutualEntry(item, normalizeText = value => String(value || '').toLocaleLowerCase('pt-BR')) {
  return Number(item?.entry || 0) > 0
    && Boolean(item?.mutualGroupId && (item?.mutualMemberId || item?.memberId))
    && (Boolean(item?.mutualEventId || item?.mutualChargeKey) || normalizeText(item?.category || '').includes('mutua'));
}

export function isMembershipEntry(item, normalizeText) {
  return Number(item?.entry || 0) > 0
    && !item?.mutualGroupId
    && (!!item?.memberId || normalizeText(item?.category || '').includes('mensalidade'));
}

export function parseCurrencyInput(value) {
  const raw = String(value ?? '').trim().replace(/\s/g, '').replace(/R\$/gi, '');
  if (!raw) return 0;
  const normalizedValue = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const number = Number(normalizedValue);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function currencyInputValue(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function coveredMonths(item, parseDate) {
  if (Array.isArray(item?.coveredMonths) && item.coveredMonths.length) return item.coveredMonths;
  const reference = referenceMonth(item, parseDate);
  return reference ? [reference] : [];
}

export function addMonthsToReference(reference, count) {
  const [year, month] = String(reference).split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - 1 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function monthRange(startReference, endReference = startReference) {
  if (!/^\d{4}-\d{2}$/.test(String(startReference || ''))) return [];
  if (!/^\d{4}-\d{2}$/.test(String(endReference || ''))) return [];

  const [startYear, startMonth] = String(startReference).split('-').map(Number);
  const [endYear, endMonth] = String(endReference).split('-').map(Number);
  const startIndex = startYear * 12 + startMonth - 1;
  const endIndex = endYear * 12 + endMonth - 1;
  if (endIndex < startIndex) return [];

  return Array.from({ length: endIndex - startIndex + 1 }, (_, index) => {
    const absoluteMonth = startIndex + index;
    const year = Math.floor(absoluteMonth / 12);
    const month = absoluteMonth % 12 + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
}

export { memberCanJoinMutual, memberIsActive, memberIsInactive, memberIsMutual, memberStatusKey, memberStatusLabel };

export function createStatusHelpers({ parseDate, todayStart }) {
  const rawStatusKey = item => {
    const value = String(item?.status || '').trim().toLocaleLowerCase('pt-BR');
    if (value) return value;
    return parseDate(item?.date || '') > todayStart() ? 'programado' : 'realizado';
  };

  const isOverdue = item => {
    const status = rawStatusKey(item);
    const scheduled = ['programado', 'agendado', 'pendente', 'vencida', 'vencido'].includes(status);
    const date = parseDate(item?.date || '');
    return scheduled && date && date < todayStart();
  };

  const statusKey = item => isOverdue(item) ? 'vencida' : rawStatusKey(item);
  const isProgrammed = item => ['programado', 'agendado', 'pendente', 'vencida', 'vencido'].includes(statusKey(item));

  const statusLabel = item => {
    if (isOverdue(item)) return 'Vencida';
    const raw = String(item?.status || '').trim();
    const normalizedStatus = raw.toLocaleLowerCase('pt-BR');
    if (normalizedStatus === 'realizado') {
      return Number(item?.entry || 0) > 0 ? 'Recebido' : 'Pago';
    }
    if (raw) return raw;
    return isProgrammed(item) ? 'Programado' : (Number(item?.entry || 0) > 0 ? 'Recebido' : 'Pago');
  };

  const statusClass = item => isOverdue(item)
    ? 'is-overdue'
    : (isProgrammed(item) ? 'is-scheduled' : 'is-completed');

  return { statusKey, isOverdue, isProgrammed, statusLabel, statusClass };
}

export function accountTypeIcon(type) {
  const key = String(type || '').toLowerCase();
  if (key.includes('aplica')) return '📈';
  if (key.includes('caixa') || key.includes('dinheiro')) return '💵';
  if (key.includes('poup')) return '🏦';
  return '💳';
}

export function paginate(items, page, key, pageSize = 8) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = items.slice(start, start + pageSize);

  if (totalPages <= 1) return { visible, html: '', page: safePage, totalPages };

  return {
    visible,
    page: safePage,
    totalPages,
    html: `<nav class="list-pagination" aria-label="Paginação dos lançamentos"><button class="btn btn-ghost btn-sm" type="button" data-treasury-page="${key}" data-page="${safePage - 1}" ${safePage === 1 ? 'disabled' : ''}>← Anterior</button><span>Página <strong>${safePage}</strong> de ${totalPages}</span><button class="btn btn-ghost btn-sm" type="button" data-treasury-page="${key}" data-page="${safePage + 1}" ${safePage === totalPages ? 'disabled' : ''}>Próxima →</button></nav>`
  };
}

export function periodBounds({ selectedPeriod, customStart, customEnd, parseDate, todayStart }) {
  const now = todayStart();
  if (selectedPeriod === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
    };
  }
  if (selectedPeriod === '30days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { start, end: now };
  }
  if (selectedPeriod === 'year') {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear(), 11, 31)
    };
  }
  if (selectedPeriod === 'custom') {
    return {
      start: customStart ? parseDate(customStart) : null,
      end: customEnd ? parseDate(customEnd) : null
    };
  }
  return { start: null, end: null };
}

export function filterItemsByPeriod(items, bounds, parseDate) {
  const { start, end } = bounds;
  return (items || []).filter(item => {
    const date = parseDate(item.date);
    return (!start || date >= start) && (!end || date <= end);
  });
}
