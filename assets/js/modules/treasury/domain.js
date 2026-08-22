import { uiIcon } from '../visual-helpers.js?v=6.46.13';
import { memberCanJoinMutual, memberIsActive, memberIsInactive, memberIsMutual, memberStatusKey, memberStatusLabel } from '../../core/portal-members.js?v=6.46.13';
import { TREASURY_TRANSFER_CATEGORY } from './movement-domain.js';
import {
  DEFAULT_ACCOUNTS,
  coveredMonths,
  createStatusHelpers,
  isMembershipEntry,
  isMutualEntry,
  memberIds,
  membershipAllocationForMonth,
  membershipExpectedSnapshotForMonth,
  monthLabel,
  mutualActiveMemberIds,
  mutualEventMemberIds,
  mutualMemberIdsForMonth,
  mutualMemberIsIncluded,
  normalizeDateReference,
  normalizeMonthReference,
  normalizeMutualEvent,
  normalizeMutualGroup,
  referenceMonth
} from './shared-domain.js?v=6.46.13';
export {
  DEFAULT_ACCOUNTS,
  coveredMonths,
  createStatusHelpers,
  isMembershipEntry,
  isMutualEntry,
  memberIds,
  membershipAllocationForMonth,
  membershipExpectedSnapshotForMonth,
  monthLabel,
  mutualActiveMemberIds,
  mutualEventMemberIds,
  mutualMemberIdsForMonth,
  mutualMemberIsIncluded,
  normalizeDateReference,
  normalizeMonthReference,
  normalizeMutualEvent,
  normalizeMutualGroup,
  referenceMonth
};
export { parseCurrencyInput, currencyInputValue } from '../currency-input.js?v=6.46.13';
export { ALLOWED_SECTIONS, normalizeTreasurySection } from './section-domain.js?v=6.46.13';

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
  TREASURY_TRANSFER_CATEGORY,
  'Outros'
]);

export const PERIOD_LABELS = Object.freeze({
  all: 'Todo o período',
  month: 'Mês atual',
  '30days': 'Últimos 30 dias',
  year: 'Ano atual',
  custom: 'Período personalizado'
});

export function mutualChargeKey(groupId, eventId, memberId) {
  return [groupId, eventId, memberId]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join('::');
}

export function mutualReferenceMonth(item, parseDate) {
  const explicit = normalizeMonthReference(item?.mutualReferenceMonth || item?.mutualReferenceDate);
  if (explicit) return explicit;
  return referenceMonth(item, parseDate);
}

export function mutualReferenceDate(item, parseDate) {
  const explicit = normalizeDateReference(item?.mutualReferenceDate || item?.occurrenceDate);
  if (explicit) return explicit;
  const date = parseDate(item?.date);
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Compatibilidade: o esquema v10 não cria cobranças mensais automáticas.
export function mutualAmountForMonth() {
  return 0;
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


export function accountTypeIcon(type) {
  const key = String(type || '').toLowerCase();
  if (key.includes('aplica')) return uiIcon('trend-up');
  if (key.includes('caixa') || key.includes('dinheiro')) return uiIcon('money');
  if (key.includes('poup')) return uiIcon('bank');
  return uiIcon('wallet');
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
