import { memberIsMutual } from '../../core/portal-members.js?v=6.46.5';

export const ADMIN_PERIOD_STORAGE = Object.freeze({
  preset: 'lions.admin.dashboard.period',
  start: 'lions.admin.dashboard.periodStart',
  end: 'lions.admin.dashboard.periodEnd'
});

export const EVENT_STATUS_ORDER = Object.freeze([
  'completed',
  'confirmed',
  'pending',
  'cancelled',
  'other'
]);

export const MEETING_STATUS_ORDER = Object.freeze([
  'pending',
  'progress',
  'completed',
  'cancelled',
  'other'
]);

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

export function inputDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateFromInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function periodBounds(preset, customStart = '', customEnd = '', now = new Date()) {
  const referenceDate = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  let start = null;
  let end = null;

  if (preset === 'current-month') {
    start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  } else if (preset === 'previous-month') {
    start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
    end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0);
  } else if (preset === 'current-quarter') {
    const quarterStart = Math.floor(referenceDate.getMonth() / 3) * 3;
    start = new Date(referenceDate.getFullYear(), quarterStart, 1);
    end = new Date(referenceDate.getFullYear(), quarterStart + 3, 0);
  } else if (preset === 'current-year') {
    start = new Date(referenceDate.getFullYear(), 0, 1);
    end = new Date(referenceDate.getFullYear(), 11, 31);
  } else if (preset === 'custom') {
    start = dateFromInput(customStart);
    end = dateFromInput(customEnd);
  }

  return {
    start: start ? inputDate(start) : '',
    end: end ? inputDate(end) : ''
  };
}

export function periodLabel(preset, bounds) {
  if (preset === 'all') return 'Todo o período cadastrado';
  if (!bounds?.start && !bounds?.end) return 'Período personalizado';

  const start = dateFromInput(bounds.start);
  const end = dateFromInput(bounds.end);

  if (start && end) return `${dateFormatter.format(start)} a ${dateFormatter.format(end)}`;
  if (start) return `A partir de ${dateFormatter.format(start)}`;
  if (end) return `Até ${dateFormatter.format(end)}`;
  return 'Período personalizado';
}

export function isInsidePeriod(item, bounds) {
  const date = String(item?.date || '');
  if (!bounds?.start && !bounds?.end) return true;
  if (!date) return false;
  if (bounds.start && date < bounds.start) return false;
  if (bounds.end && date > bounds.end) return false;
  return true;
}

export function normalizeDashboardStatus(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function titleCase(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)\S/g, letter => letter.toLocaleUpperCase('pt-BR'));
}

export function resolveEventStatus(item, today) {
  const raw = String(item?.status || '').trim();
  const status = normalizeDashboardStatus(raw);
  const date = String(item?.date || '');

  if (status.includes('cancel')) return { key: 'cancelled', label: 'Cancelados' };
  if (date && date < today) return { key: 'completed', label: 'Realizados' };
  if (status.includes('confirm')) return { key: 'confirmed', label: 'Confirmados' };
  if (status.includes('planej') || status.includes('pendent') || !status) {
    return { key: 'pending', label: 'Pendentes' };
  }
  if (status.includes('realiz') || status.includes('conclu')) {
    return { key: 'completed', label: 'Realizados' };
  }

  return { key: 'other', label: titleCase(raw) || 'Outros' };
}

export function resolveMeetingStatus(item, today) {
  const raw = String(item?.status || '').trim();
  const status = normalizeDashboardStatus(raw);
  const date = String(item?.date || '');

  if (status.includes('cancel')) return { key: 'cancelled', label: 'Cancelados' };
  if (status.includes('conclu') || status.includes('realiz')) {
    return { key: 'completed', label: 'Concluídos' };
  }
  if (status.includes('andamento')) return { key: 'progress', label: 'Em andamento' };
  if (status.includes('pendent') || status.includes('planej')) {
    return { key: 'pending', label: 'Pendentes' };
  }
  if (date && date < today) return { key: 'completed', label: 'Concluídos' };
  if (date === today) return { key: 'progress', label: 'Em andamento' };
  if (!status || status.includes('confirm')) return { key: 'pending', label: 'Pendentes' };

  return { key: 'other', label: titleCase(raw) || 'Outros' };
}

export function groupStatuses(items, resolver, preferredOrder, today = inputDate(new Date())) {
  const groups = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const status = resolver(item, today);
    const identity = `${status.key}:${status.label}`;
    const current = groups.get(identity) || { ...status, count: 0 };
    current.count += 1;
    groups.set(identity, current);
  }

  return [...groups.values()].sort((first, second) => {
    const firstOrder = preferredOrder.indexOf(first.key);
    const secondOrder = preferredOrder.indexOf(second.key);
    const safeFirst = firstOrder === -1 ? preferredOrder.length : firstOrder;
    const safeSecond = secondOrder === -1 ? preferredOrder.length : secondOrder;
    return safeFirst - safeSecond || first.label.localeCompare(second.label, 'pt-BR');
  });
}

export function summarizeBirthdayPeople(items) {
  const records = Array.isArray(items) ? items : [];
  const mutualCount = records.filter(memberIsMutual).length;

  return {
    total: records.length,
    associateCount: records.length - mutualCount,
    mutualCount
  };
}

export function summarizeTreasury(items) {
  const records = Array.isArray(items) ? items : [];
  const entries = records.filter(item => Number(item?.entry || 0) > 0);
  const exits = records.filter(item => Number(item?.exit || 0) > 0);
  const entriesValue = entries.reduce((sum, item) => sum + Number(item.entry || 0), 0);
  const exitsValue = exits.reduce((sum, item) => sum + Number(item.exit || 0), 0);

  return {
    total: records.length,
    entries,
    exits,
    entriesValue,
    exitsValue,
    balance: entriesValue - exitsValue,
    maxValue: Math.max(entriesValue, exitsValue)
  };
}

export function createAdminDashboardModel(state, {
  periodPreset = 'current-month',
  customStart = '',
  customEnd = '',
  now = new Date()
} = {}) {
  const safeState = state || {};
  const bounds = periodBounds(periodPreset, customStart, customEnd, now);
  const treasuryItems = (Array.isArray(safeState.treasury) ? safeState.treasury : [])
    .filter(item => isInsidePeriod(item, bounds));
  const events = (Array.isArray(safeState.events) ? safeState.events : [])
    .filter(item => isInsidePeriod(item, bounds));
  const meetings = (Array.isArray(safeState.meetings) ? safeState.meetings : [])
    .filter(item => isInsidePeriod(item, bounds));
  const today = inputDate(now);

  const birthdayPeople = summarizeBirthdayPeople(safeState.birthdays);

  return {
    bounds,
    periodPreset,
    customStart,
    customEnd,
    selectedPeriodLabel: periodLabel(periodPreset, bounds),
    customPeriodVisible: periodPreset === 'custom',
    treasury: summarizeTreasury(treasuryItems),
    events: {
      items: events,
      groups: groupStatuses(events, resolveEventStatus, EVENT_STATUS_ORDER, today)
    },
    meetings: {
      items: meetings,
      groups: groupStatuses(meetings, resolveMeetingStatus, MEETING_STATUS_ORDER, today)
    },
    birthdayCount: birthdayPeople.total,
    birthdayAssociateCount: birthdayPeople.associateCount,
    birthdayMutualCount: birthdayPeople.mutualCount,
    noticeCount: Array.isArray(safeState.notices) ? safeState.notices.length : 0,
    userCount: Array.isArray(safeState.portalUsers) ? safeState.portalUsers.length : 0,
    roleCount: Array.isArray(safeState.accessRoles) ? safeState.accessRoles.length : 0
  };
}
