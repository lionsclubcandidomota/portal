import { memberIsActive, memberStatusLabel } from '../../core/portal-members.js?v=6.34.1';
import { dateFromInput, periodLabel } from '../admin-dashboard/domain.js';
import {
  isMutualEntry,
  mutualAmountForMonth,
  mutualMemberIsIncluded,
  mutualReferenceMonth,
  normalizeMutualGroup
} from '../treasury/domain.js';

export const REPORT_TYPES = Object.freeze({
  movements: Object.freeze({ label: 'Movimentações financeiras', icon: '💰' }),
  memberships: Object.freeze({ label: 'Mensalidades', icon: '🧾' }),
  mutuals: Object.freeze({ label: 'Mútuas', icon: '🤲' }),
  birthdays: Object.freeze({ label: 'Aniversariantes', icon: '🎂' }),
  agenda: Object.freeze({ label: 'Agenda', icon: '🗓️' }),
  notices: Object.freeze({ label: 'Avisos', icon: '📢' })
});

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const birthdayDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' });
const generatedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || '').trim();
}

function validBounds(bounds = {}) {
  const start = dateFromInput(bounds.start);
  const end = dateFromInput(bounds.end);
  return {
    start: start ? bounds.start : '',
    end: end ? bounds.end : ''
  };
}

export function dateInsideBounds(value, bounds = {}) {
  const date = normalizeText(value);
  if (!date) return false;
  const safeBounds = validBounds(bounds);
  if (safeBounds.start && date < safeBounds.start) return false;
  if (safeBounds.end && date > safeBounds.end) return false;
  return true;
}

export function dateRangeOverlaps(startValue, endValue, bounds = {}) {
  const start = normalizeText(startValue);
  const end = normalizeText(endValue) || start;
  const safeBounds = validBounds(bounds);
  if (!safeBounds.start && !safeBounds.end) return true;
  if (safeBounds.start && end && end < safeBounds.start) return false;
  if (safeBounds.end && start && start > safeBounds.end) return false;
  return true;
}

export function monthRange(startMonth, endMonth = startMonth) {
  if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) return [];
  if (endMonth < startMonth) return [];
  const [startYear, startIndex] = startMonth.split('-').map(Number);
  const [endYear, endIndex] = endMonth.split('-').map(Number);
  const cursor = new Date(startYear, startIndex - 1, 1);
  const end = new Date(endYear, endIndex - 1, 1);
  const months = [];
  while (cursor <= end && months.length < 240) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function reportMonths(state, bounds = {}, now = new Date()) {
  const safeBounds = validBounds(bounds);
  if (safeBounds.start || safeBounds.end) {
    const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return monthRange(
      safeBounds.start ? safeBounds.start.slice(0, 7) : fallback,
      safeBounds.end ? safeBounds.end.slice(0, 7) : (safeBounds.start ? safeBounds.start.slice(0, 7) : fallback)
    );
  }

  const references = safeArray(state?.treasury)
    .filter(item => String(item?.category || '').toLocaleLowerCase('pt-BR').includes('mensal'))
    .flatMap(item => safeArray(item.coveredMonths).length
      ? item.coveredMonths
      : [item.referenceMonth || String(item.date || '').slice(0, 7)])
    .filter(value => /^\d{4}-\d{2}$/.test(value))
    .sort();

  if (references.length) return monthRange(references[0], references.at(-1));
  return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
}

function monthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value || '—';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
}

function formatDate(value) {
  const date = dateFromInput(value);
  return date ? shortDate.format(date) : '—';
}

function formatBirthday(value) {
  const date = dateFromInput(value);
  return date ? birthdayDate.format(date) : '—';
}

function accountName(state, accountId) {
  return safeArray(state?.treasuryAccounts).find(account => account.id === accountId)?.name || 'Não informada';
}

function familyName(state, memberId) {
  return safeArray(state?.familyGroups).find(group => safeArray(group.memberIds).includes(memberId))?.name || 'Individual';
}

function isMembershipEntry(item) {
  return String(item?.category || '').trim().toLocaleLowerCase('pt-BR') === 'mensalidades';
}

function coveredMonths(item) {
  const months = safeArray(item?.coveredMonths).filter(value => /^\d{4}-\d{2}$/.test(value));
  if (months.length) return months;
  const reference = item?.referenceMonth || String(item?.date || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(reference) ? [reference] : [];
}

function itemMemberIds(item) {
  const ids = safeArray(item?.memberIds).filter(Boolean);
  if (ids.length) return ids;
  return item?.memberId ? [item.memberId] : [];
}

function memberMonthAllocation(item, memberId) {
  const months = coveredMonths(item);
  const allocation = safeArray(item?.memberAllocations)
    .find(entry => entry.memberId === memberId);
  const total = allocation
    ? Number(allocation.amount || 0)
    : Number(item?.entry || 0) / Math.max(1, itemMemberIds(item).length);
  return total / Math.max(1, months.length);
}

function birthdayInsideBounds(value, bounds = {}) {
  const birth = dateFromInput(value);
  if (!birth) return false;
  const safeBounds = validBounds(bounds);
  if (!safeBounds.start && !safeBounds.end) return true;

  const referenceStart = dateFromInput(safeBounds.start || safeBounds.end);
  const referenceEnd = dateFromInput(safeBounds.end || safeBounds.start);
  if (!referenceStart || !referenceEnd) return true;
  const start = safeBounds.start
    ? referenceStart
    : new Date(referenceEnd.getFullYear(), 0, 1);
  const end = safeBounds.end
    ? referenceEnd
    : new Date(referenceStart.getFullYear(), 11, 31);
  const month = String(birth.getMonth() + 1).padStart(2, '0');
  const day = String(birth.getDate()).padStart(2, '0');

  for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
    const occurrence = `${year}-${month}-${day}`;
    if (occurrence >= (safeBounds.start || occurrence) && occurrence <= (safeBounds.end || occurrence)) return true;
  }
  return false;
}

function buildMovementReport(state, bounds) {
  const items = safeArray(state?.treasury)
    .filter(item => dateInsideBounds(item.date, bounds))
    .sort((first, second) => String(first.date).localeCompare(String(second.date)));
  const entryTotal = items.reduce((sum, item) => sum + Number(item.entry || 0), 0);
  const exitTotal = items.reduce((sum, item) => sum + Number(item.exit || 0), 0);

  return {
    key: 'movements',
    title: REPORT_TYPES.movements.label,
    description: 'Entradas e saídas registradas no período selecionado.',
    columns: ['Data', 'Descrição', 'Categoria', 'Conta', 'Entrada', 'Saída', 'Status', 'Observações'],
    rows: items.map(item => [
      formatDate(item.date),
      item.description || '—',
      item.category || '—',
      accountName(state, item.accountId),
      Number(item.entry || 0) ? money.format(Number(item.entry || 0)) : '—',
      Number(item.exit || 0) ? money.format(Number(item.exit || 0)) : '—',
      item.status || '—',
      item.notes || '—'
    ]),
    summary: [
      { label: 'Lançamentos', value: String(items.length) },
      { label: 'Entradas', value: money.format(entryTotal) },
      { label: 'Saídas', value: money.format(exitTotal) },
      { label: 'Saldo', value: money.format(entryTotal - exitTotal) }
    ]
  };
}

function buildMembershipReport(state, bounds, now) {
  const months = reportMonths(state, bounds, now);
  const entries = safeArray(state?.treasury)
    .filter(item => isMembershipEntry(item) && !String(item.status || '').toLocaleLowerCase('pt-BR').includes('program'));
  const members = safeArray(state?.birthdays)
    .filter(memberIsActive)
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR'));
  let paidUnits = 0;
  let totalReceived = 0;

  const rows = members.map(member => {
    const paidMonths = [];
    let memberTotal = 0;
    months.forEach(month => {
      const payments = entries.filter(item => itemMemberIds(item).includes(member.id) && coveredMonths(item).includes(month));
      if (!payments.length) return;
      paidMonths.push(month);
      payments.forEach(item => { memberTotal += memberMonthAllocation(item, member.id); });
    });
    const pendingMonths = months.filter(month => !paidMonths.includes(month));
    paidUnits += paidMonths.length;
    totalReceived += memberTotal;

    return [
      member.name || '—',
      member.memberNumber || '—',
      familyName(state, member.id),
      paidMonths.length ? paidMonths.map(monthLabel).join(', ') : 'Nenhum',
      pendingMonths.length ? pendingMonths.map(monthLabel).join(', ') : 'Nenhum',
      money.format(memberTotal),
      pendingMonths.length ? 'Pendente' : 'Em dia'
    ];
  });

  return {
    key: 'memberships',
    title: REPORT_TYPES.memberships.label,
    description: `Controle de mensalidades de ${months.map(monthLabel).join(' a ')}.`,
    columns: ['Associado', 'Número', 'Plano/Família', 'Meses quitados', 'Meses pendentes', 'Total recebido', 'Situação'],
    rows,
    summary: [
      { label: 'Associados ativos', value: String(members.length) },
      { label: 'Meses analisados', value: String(months.length) },
      { label: 'Mensalidades quitadas', value: String(paidUnits) },
      { label: 'Pendências', value: String(Math.max(0, members.length * months.length - paidUnits)) },
      { label: 'Total recebido', value: money.format(totalReceived) }
    ]
  };
}


function mutualReportMonths(state, bounds = {}, now = new Date()) {
  const safeBounds = validBounds(bounds);
  if (safeBounds.start || safeBounds.end) {
    const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = safeBounds.start ? safeBounds.start.slice(0, 7) : (safeBounds.end ? safeBounds.end.slice(0, 7) : fallback);
    const end = safeBounds.end ? safeBounds.end.slice(0, 7) : start;
    return monthRange(start, end);
  }

  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const groupStarts = safeArray(state?.mutualGroups)
    .map(group => normalizeMutualGroup(group, current).startedMonth)
    .filter(value => /^\d{4}-\d{2}$/.test(value));
  const paymentReferences = safeArray(state?.treasury)
    .filter(item => isMutualEntry(item))
    .map(item => mutualReferenceMonth(item, dateFromInput))
    .filter(value => /^\d{4}-\d{2}$/.test(value));
  const references = [...groupStarts, ...paymentReferences, current].sort();
  return monthRange(references[0] || current, references.at(-1) || current);
}

function latestMutualPayment(items = []) {
  return [...items].sort((first, second) => String(second?.paymentDate || second?.date || '')
    .localeCompare(String(first?.paymentDate || first?.date || '')))[0] || null;
}

function buildMutualReport(state, bounds, now) {
  const months = mutualReportMonths(state, bounds, now);
  const members = new Map(safeArray(state?.birthdays).map(member => [String(member.id), member]));
  const payments = safeArray(state?.treasury).filter(item => isMutualEntry(item));
  const groups = safeArray(state?.mutualGroups)
    .map(group => normalizeMutualGroup(group, months[0] || ''))
    .filter(group => group.id)
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR'));

  const charges = groups.flatMap(group => months.flatMap(month => {
    if (group.startedMonth && month < group.startedMonth) return [];
    const memberIds = [...new Set(group.memberships
      .map(membership => String(membership.memberId || ''))
      .filter(memberId => memberId && mutualMemberIsIncluded(group, memberId, month)))];

    return memberIds.map(memberId => {
      const member = members.get(memberId) || { id: memberId, name: 'Associado não encontrado', memberNumber: '' };
      const matchingPayments = payments.filter(item => (
        String(item.mutualGroupId || '') === String(group.id)
        && String(item.mutualMemberId || item.memberId || '') === memberId
        && mutualReferenceMonth(item, dateFromInput) === month
      ));
      const payment = latestMutualPayment(matchingPayments);
      const expected = mutualAmountForMonth(group, month);
      return { group, month, member, payment, expected };
    });
  }));

  const paid = charges.filter(item => item.payment);
  const expectedTotal = charges.reduce((sum, item) => sum + Number(item.expected || 0), 0);
  const receivedTotal = paid.reduce((sum, item) => sum + Number(item.payment?.entry || item.expected || 0), 0);

  return {
    key: 'mutuals',
    title: REPORT_TYPES.mutuals.label,
    description: `Cobranças mensais de mútuas de ${months.length ? months.map(monthLabel).join(' a ') : 'período sem competências'}.`,
    columns: ['Grupo', 'Competência', 'Associado', 'Número', 'Valor previsto', 'Situação', 'Data da baixa', 'Conta', 'Valor recebido'],
    rows: charges.map(item => [
      item.group.name || '—',
      monthLabel(item.month),
      item.member.name || '—',
      item.member.memberNumber || '—',
      money.format(Number(item.expected || 0)),
      item.payment ? 'Paga' : 'Em aberto',
      item.payment ? formatDate(item.payment.paymentDate || item.payment.date) : '—',
      item.payment ? accountName(state, item.payment.accountId) : '—',
      item.payment ? money.format(Number(item.payment.entry || item.expected || 0)) : '—'
    ]),
    summary: [
      { label: 'Grupos', value: String(groups.length) },
      { label: 'Competências', value: String(months.length) },
      { label: 'Cobranças', value: String(charges.length) },
      { label: 'Pagas', value: String(paid.length) },
      { label: 'Em aberto', value: String(Math.max(0, charges.length - paid.length)) },
      { label: 'Total previsto', value: money.format(expectedTotal) },
      { label: 'Total recebido', value: money.format(receivedTotal) }
    ]
  };
}

function buildBirthdayReport(state, bounds) {
  const items = safeArray(state?.birthdays)
    .filter(member => birthdayInsideBounds(member.birthDate, bounds))
    .sort((first, second) => String(first.birthDate || '').slice(5).localeCompare(String(second.birthDate || '').slice(5)));

  return {
    key: 'birthdays',
    title: REPORT_TYPES.birthdays.label,
    description: 'Associados e Mutuários com aniversário dentro do período selecionado.',
    columns: ['Pessoa', 'Número', 'Aniversário', 'Situação'],
    rows: items.map(member => [
      member.name || '—',
      member.memberNumber || '—',
      formatBirthday(member.birthDate),
      memberStatusLabel(member)
    ]),
    summary: [
      { label: 'Aniversariantes', value: String(items.length) },
      { label: 'Associados ativos', value: String(items.filter(memberIsActive).length) },
      { label: 'Mutuários', value: String(items.filter(member => memberStatusLabel(member) === 'Mútua').length) },
      { label: 'Inativos', value: String(items.filter(member => memberStatusLabel(member) === 'Inativo').length) }
    ]
  };
}

function buildAgendaReport(state, bounds) {
  const events = safeArray(state?.events).filter(item => dateInsideBounds(item.date, bounds)).map(item => ({
    type: 'Evento',
    date: item.date,
    time: item.time,
    title: item.name,
    location: item.locationType === 'virtual' ? item.onlineUrl : item.location,
    status: item.status || 'Confirmado',
    details: item.description
  }));
  const meetings = safeArray(state?.meetings).filter(item => dateInsideBounds(item.date, bounds)).map(item => ({
    type: 'Reunião',
    date: item.date,
    time: item.time,
    title: item.theme,
    location: item.locationType === 'virtual' ? item.onlineUrl : item.location,
    status: item.status || 'Pendente',
    details: item.notes
  }));
  const items = [...events, ...meetings]
    .sort((first, second) => `${first.date} ${first.time || ''}`.localeCompare(`${second.date} ${second.time || ''}`));

  return {
    key: 'agenda',
    title: REPORT_TYPES.agenda.label,
    description: 'Eventos e reuniões programados no período selecionado.',
    columns: ['Tipo', 'Data', 'Horário', 'Título/Tema', 'Local', 'Status', 'Detalhes'],
    rows: items.map(item => [
      item.type,
      formatDate(item.date),
      item.time || '—',
      item.title || '—',
      item.location || '—',
      item.status || '—',
      item.details || '—'
    ]),
    summary: [
      { label: 'Compromissos', value: String(items.length) },
      { label: 'Eventos', value: String(events.length) },
      { label: 'Reuniões', value: String(meetings.length) }
    ]
  };
}

function buildNoticeReport(state, bounds) {
  const items = safeArray(state?.notices)
    .filter(item => dateRangeOverlaps(item.date, item.endDate, bounds))
    .sort((first, second) => String(first.date || '').localeCompare(String(second.date || '')));

  return {
    key: 'notices',
    title: REPORT_TYPES.notices.label,
    description: 'Avisos cuja vigência coincide com o período selecionado.',
    columns: ['Início', 'Término', 'Título', 'Prioridade', 'Conteúdo'],
    rows: items.map(item => [
      formatDate(item.date),
      item.endDate ? formatDate(item.endDate) : 'Sem data final',
      item.title || '—',
      item.priority || '—',
      item.text || '—'
    ]),
    summary: [
      { label: 'Avisos', value: String(items.length) },
      { label: 'Alta prioridade', value: String(items.filter(item => item.priority === 'Alta').length) },
      { label: 'Sem data final', value: String(items.filter(item => !item.endDate).length) }
    ]
  };
}

export function buildReport(type, state, {
  bounds = {},
  periodPreset = 'custom',
  periodText = '',
  now = new Date()
} = {}) {
  const builders = {
    movements: () => buildMovementReport(state, bounds),
    memberships: () => buildMembershipReport(state, bounds, now),
    mutuals: () => buildMutualReport(state, bounds, now),
    birthdays: () => buildBirthdayReport(state, bounds),
    agenda: () => buildAgendaReport(state, bounds),
    notices: () => buildNoticeReport(state, bounds)
  };
  if (!builders[type]) throw new Error('Selecione um tipo de relatório válido.');

  return {
    ...builders[type](),
    clubName: state?.settings?.clubName || 'Portal do Clube',
    periodText: periodText || periodLabel(periodPreset, validBounds(bounds)),
    generatedAt: generatedDate.format(now)
  };
}
