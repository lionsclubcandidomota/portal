import { isTreasuryTransfer } from './movement-domain.js?v=6.46.13';

export const DEFAULT_ACCOUNTS = Object.freeze([
  { id: 'acc-current', name: 'Conta corrente', type: 'Conta corrente', initialBalance: 0, active: true },
  { id: 'acc-investment', name: 'Aplicação', type: 'Aplicação', initialBalance: 0, active: true },
  { id: 'acc-cash', name: 'Dinheiro em caixa', type: 'Dinheiro em caixa', initialBalance: 0, active: true }
]);

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

export function normalizeMutualEvent(event, index = 0) {
  const source = event && typeof event === 'object' ? event : {};
  const occurrenceDate = normalizeDateReference(source.occurrenceDate || source.date);
  const participantIds = [...new Set((Array.isArray(source.participantIds) ? source.participantIds : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))];
  return {
    id: String(source.id || `mue_${index}`),
    deceasedName: String(source.deceasedName || source.name || '').trim(),
    occurrenceDate,
    amount: Math.max(0, Number(source.amount || 0)),
    participantIds,
    notes: String(source.notes || '').trim(),
    createdAt: String(source.createdAt || '')
  };
}

export function normalizeMutualGroup(group, fallbackMonth = '') {
  const source = group && typeof group === 'object' ? group : {};
  const legacyCharges = Array.isArray(source.memberCharges) ? source.memberCharges : [];
  const startedMonth = normalizeMonthReference(
    source.startedMonth || source.referenceDate,
    normalizeMonthReference(fallbackMonth)
  );
  const existingMemberships = Array.isArray(source.memberships) ? source.memberships : [];
  const memberships = existingMemberships.length
    ? existingMemberships
      .map((membership, index) => ({
        id: String(membership?.id || `mum_${source.id || 'group'}_${membership?.memberId || index}`),
        memberId: String(membership?.memberId || '').trim(),
        joinedMonth: normalizeMonthReference(membership?.joinedMonth, startedMonth),
        endedMonth: normalizeMonthReference(membership?.endedMonth)
      }))
      .filter(membership => membership.memberId && membership.joinedMonth)
    : legacyCharges
      .map((charge, index) => ({
        id: `mum_${source.id || 'group'}_${charge?.memberId || index}`,
        memberId: String(charge?.memberId || '').trim(),
        joinedMonth: startedMonth,
        endedMonth: ''
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
    .map(normalizeMutualEvent)
    .filter(event => event.id && event.deceasedName && event.occurrenceDate && event.amount > 0)
    .sort((first, second) => second.occurrenceDate.localeCompare(first.occurrenceDate));

  const {
    memberCharges: _legacyCharges,
    referenceDate: _legacyReference,
    monthlyAmount: _legacyMonthlyAmount,
    amountHistory: _legacyAmountHistory,
    startedMonth: _legacyStartedMonth,
    chargeEvents: _legacyChargeEvents,
    occurrences: _legacyOccurrences,
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

export function mutualMemberIsIncluded(group, memberId, month) {
  const reference = normalizeMonthReference(month);
  const normalizedId = String(memberId || '');
  if (!reference || !normalizedId) return false;
  const normalized = normalizeMutualGroup(group, reference);
  return normalized.memberships.some(membership => (
    String(membership.memberId) === normalizedId
    && membership.joinedMonth <= reference
    && (!membership.endedMonth || membership.endedMonth >= reference)
  ));
}

export function mutualMemberIdsForMonth(group, month) {
  const normalized = normalizeMutualGroup(group, month);
  return [...new Set(normalized.memberships
    .filter(membership => mutualMemberIsIncluded(normalized, membership.memberId, month))
    .map(membership => String(membership.memberId)))];
}

export function mutualActiveMemberIds(group) {
  const normalized = normalizeMutualGroup(group);
  return [...new Set(normalized.memberships
    .filter(membership => !membership.endedMonth)
    .map(membership => String(membership.memberId))
    .filter(Boolean))];
}

export function mutualEventMemberIds(group, event) {
  const normalizedGroup = normalizeMutualGroup(group);
  const normalizedEvent = normalizeMutualEvent(event);
  if (normalizedEvent.participantIds.length) return normalizedEvent.participantIds;
  const referenceMonthValue = normalizeMonthReference(normalizedEvent.occurrenceDate);
  return referenceMonthValue
    ? mutualMemberIdsForMonth(normalizedGroup, referenceMonthValue)
    : mutualActiveMemberIds(normalizedGroup);
}

export function isMutualEntry(item, normalizeText = value => String(value || '').toLocaleLowerCase('pt-BR')) {
  return Number(item?.entry || 0) > 0
    && Boolean(item?.mutualGroupId && (item?.mutualMemberId || item?.memberId))
    && (Boolean(item?.mutualChargeKey) || normalizeText(item?.category || '').includes('mutua'));
}

export function isMembershipEntry(item, normalizeText) {
  return Number(item?.entry || 0) > 0
    && !item?.mutualGroupId
    && (!!item?.memberId || normalizeText(item?.category || '').includes('mensalidade'));
}

export function coveredMonths(item, parseDate) {
  if (Array.isArray(item?.coveredMonths) && item.coveredMonths.length) return item.coveredMonths;
  const reference = referenceMonth(item, parseDate);
  return reference ? [reference] : [];
}

export function membershipAllocationForMonth(item, memberId, month, parseDate) {
  const normalizedMemberId = String(memberId || '');
  const normalizedMonth = String(month || '');
  if (!normalizedMemberId || !/^\d{4}-\d{2}$/.test(normalizedMonth)) return 0;

  const allocations = Array.isArray(item?.memberAllocations) ? item.memberAllocations : [];
  const stored = allocations.find(allocation => String(allocation?.memberId || '') === normalizedMemberId);
  if (stored) {
    const monthAllocations = Array.isArray(stored.monthAllocations) ? stored.monthAllocations : [];
    const exact = monthAllocations.find(allocation => String(allocation?.month || '') === normalizedMonth);
    if (exact && Number.isFinite(Number(exact.amount))) return Math.max(0, Number(exact.amount));

    const allocationMonths = Array.isArray(stored.months) && stored.months.length
      ? stored.months.map(String)
      : coveredMonths(item, parseDate);
    if (allocationMonths.includes(normalizedMonth) && Number.isFinite(Number(stored.amount))) {
      return Math.max(0, Number(stored.amount)) / Math.max(1, allocationMonths.length);
    }
    return 0;
  }

  const ids = memberIds(item).map(String);
  const months = coveredMonths(item, parseDate);
  if (!ids.includes(normalizedMemberId) || !months.includes(normalizedMonth)) return 0;
  return Math.max(0, Number(item?.entry || 0)) / Math.max(1, ids.length * months.length);
}

export function membershipExpectedSnapshotForMonth(item, memberId, month, parseDate) {
  const normalizedMemberId = String(memberId || '');
  const normalizedMonth = String(month || '');
  if (!normalizedMemberId || !/^\d{4}-\d{2}$/.test(normalizedMonth)) return null;

  const allocations = Array.isArray(item?.memberAllocations) ? item.memberAllocations : [];
  const stored = allocations.find(allocation => String(allocation?.memberId || '') === normalizedMemberId);
  if (stored) {
    const monthAllocations = Array.isArray(stored.monthAllocations) ? stored.monthAllocations : [];
    const exact = monthAllocations.find(allocation => String(allocation?.month || '') === normalizedMonth);
    if (exact && Number.isFinite(Number(exact.expectedAmount)) && Number(exact.expectedAmount) > 0) {
      return Math.max(0, Number(exact.expectedAmount));
    }

    const allocationMonths = Array.isArray(stored.months) && stored.months.length
      ? stored.months.map(String)
      : coveredMonths(item, parseDate);
    if (allocationMonths.includes(normalizedMonth)
      && Number.isFinite(Number(stored.monthlyAmount))
      && Number(stored.monthlyAmount) > 0) {
      return Math.max(0, Number(stored.monthlyAmount));
    }
  }

  // Registros legados anteriores ao rateio detalhado representavam competências
  // já baixadas. A alocação efetivamente recebida funciona como snapshot histórico
  // para impedir que um reajuste posterior reabra uma mensalidade quitada.
  if (!allocations.length) {
    const legacyAmount = membershipAllocationForMonth(item, normalizedMemberId, normalizedMonth, parseDate);
    if (legacyAmount > 0) return legacyAmount;
  }

  return null;
}

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
      if (isTreasuryTransfer(item)) return 'Efetivado';
      return Number(item?.entry || 0) > 0 ? 'Recebido' : 'Pago';
    }
    if (raw) return raw;
    if (isProgrammed(item)) return 'Programado';
    if (isTreasuryTransfer(item)) return 'Efetivado';
    return Number(item?.entry || 0) > 0 ? 'Recebido' : 'Pago';
  };

  const statusClass = item => isOverdue(item)
    ? 'is-overdue'
    : (isProgrammed(item) ? 'is-scheduled' : 'is-completed');

  return { statusKey, isOverdue, isProgrammed, statusLabel, statusClass };
}
