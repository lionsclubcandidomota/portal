import { memberIsActive, memberStatusLabel } from '../../core/portal-members.js?v=6.52.3';
import { dateFromInput, periodLabel } from '../admin-dashboard/domain.js';
import {
  isMutualEntry,
  mutualEventMemberIds,
  normalizeMutualGroup
} from '../treasury/shared-domain.js';
import { REPORT_TYPES } from './catalog.js?v=6.52.3';
import { buildMembershipReport } from './membership-report.js?v=6.52.3';

export { REPORT_TYPES } from './catalog.js?v=6.52.3';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const birthdayDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' });
const generatedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const EPSILON = 0.005;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
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
    .filter(item => normalizeKey(item?.category).includes('mensal'))
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

function birthdayInsideBounds(value, bounds = {}) {
  const birth = dateFromInput(value);
  if (!birth) return false;
  const safeBounds = validBounds(bounds);
  if (!safeBounds.start && !safeBounds.end) return true;

  const referenceStart = dateFromInput(safeBounds.start || safeBounds.end);
  const referenceEnd = dateFromInput(safeBounds.end || safeBounds.start);
  if (!referenceStart || !referenceEnd) return true;
  const start = safeBounds.start ? referenceStart : new Date(referenceEnd.getFullYear(), 0, 1);
  const end = safeBounds.end ? referenceEnd : new Date(referenceStart.getFullYear(), 11, 31);
  const month = String(birth.getMonth() + 1).padStart(2, '0');
  const day = String(birth.getDate()).padStart(2, '0');

  for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
    const occurrence = `${year}-${month}-${day}`;
    if (occurrence >= (safeBounds.start || occurrence) && occurrence <= (safeBounds.end || occurrence)) return true;
  }
  return false;
}

function largestBy(items, valueFor) {
  return [...items].sort((first, second) => Number(valueFor(second) || 0) - Number(valueFor(first) || 0))[0] || null;
}

function topAggregate(items, keyFor, valueFor) {
  const totals = new Map();
  items.forEach(item => {
    const key = normalizeText(keyFor(item)) || 'Não informado';
    totals.set(key, (totals.get(key) || 0) + Number(valueFor(item) || 0));
  });
  return [...totals.entries()].sort((first, second) => second[1] - first[1])[0] || null;
}

function insight(label, value, detail = '', tone = 'neutral') {
  return { label, value, detail, tone };
}

function summary(label, value, tone = 'neutral') {
  return { label, value, tone };
}

function buildMovementReport(state, bounds) {
  const items = safeArray(state?.treasury)
    .filter(item => dateInsideBounds(item.date, bounds))
    .sort((first, second) => String(first.date).localeCompare(String(second.date)));
  const entryTotal = items.reduce((sum, item) => sum + Number(item.entry || 0), 0);
  const exitTotal = items.reduce((sum, item) => sum + Number(item.exit || 0), 0);
  const balance = entryTotal - exitTotal;
  const entries = items.filter(item => Number(item.entry || 0) > 0);
  const exits = items.filter(item => Number(item.exit || 0) > 0);
  const biggestEntry = largestBy(entries, item => item.entry);
  const biggestExit = largestBy(exits, item => item.exit);
  const topExitCategory = topAggregate(exits, item => item.category, item => item.exit);

  return {
    key: 'movements',
    title: REPORT_TYPES.movements.label,
    description: 'Visão financeira do período com resultado, principais movimentos e detalhamento dos lançamentos.',
    tableTitle: 'Detalhamento das movimentações',
    rowCountLabel: `${items.length} lançamento(s)`,
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
      summary('Lançamentos', String(items.length), 'primary'),
      summary('Entradas', money.format(entryTotal), 'positive'),
      summary('Saídas', money.format(exitTotal), 'negative'),
      summary('Resultado', money.format(balance), balance < 0 ? 'negative' : balance > 0 ? 'positive' : 'neutral')
    ],
    insights: [
      insight(
        'Resultado do período',
        balance > EPSILON ? `+ ${money.format(balance)}` : balance < -EPSILON ? `− ${money.format(Math.abs(balance))}` : money.format(0),
        balance > EPSILON ? 'Entradas superaram as saídas.' : balance < -EPSILON ? 'Saídas superaram as entradas.' : 'Entradas e saídas ficaram equilibradas.',
        balance < 0 ? 'negative' : balance > 0 ? 'positive' : 'neutral'
      ),
      insight('Maior entrada', biggestEntry ? money.format(Number(biggestEntry.entry || 0)) : '—', biggestEntry?.description || 'Nenhuma entrada no período', 'positive'),
      insight('Maior saída', biggestExit ? money.format(Number(biggestExit.exit || 0)) : '—', biggestExit?.description || 'Nenhuma saída no período', biggestExit ? 'negative' : 'neutral'),
      insight('Principal categoria de saída', topExitCategory?.[0] || '—', topExitCategory ? money.format(topExitCategory[1]) : 'Nenhuma saída categorizada', 'warning')
    ]
  };
}

function latestMutualPayment(items = []) {
  return [...items].sort((first, second) => String(second?.paymentDate || second?.date || '')
    .localeCompare(String(first?.paymentDate || first?.date || '')))[0] || null;
}

function buildMutualReport(state, bounds) {
  const safeBounds = validBounds(bounds);
  const members = new Map(safeArray(state?.birthdays).map(member => [String(member.id), member]));
  const payments = safeArray(state?.treasury).filter(item => isMutualEntry(item));
  const groups = safeArray(state?.mutualGroups)
    .map(group => normalizeMutualGroup(group))
    .filter(group => group.id)
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR'));

  const occurrences = groups.flatMap(group => safeArray(group.events)
    .filter(event => dateInsideBounds(event.occurrenceDate, safeBounds))
    .map(event => ({ group, event })));

  const charges = occurrences.flatMap(({ group, event }) => mutualEventMemberIds(group, event).map(memberId => {
    const member = members.get(String(memberId)) || { id: memberId, name: 'Participante não encontrado', memberNumber: '' };
    const matchingPayments = payments.filter(item => (
      String(item.mutualGroupId || '') === String(group.id)
      && String(item.mutualEventId || '') === String(event.id)
      && String(item.mutualMemberId || item.memberId || '') === String(memberId)
    ));
    const payment = latestMutualPayment(matchingPayments);
    return { group, event, member, payment, expected: Math.max(0, Number(event.amount || 0)) };
  }));

  const paid = charges.filter(item => item.payment);
  const expectedTotal = charges.reduce((sum, item) => sum + Number(item.expected || 0), 0);
  const receivedTotal = paid.reduce((sum, item) => sum + Number(item.payment?.entry || item.expected || 0), 0);
  const outstandingTotal = Math.max(0, expectedTotal - receivedTotal);
  const coverageRate = charges.length ? paid.length / charges.length : 0;
  const busiestGroup = topAggregate(charges, item => item.group.name, () => 1);

  return {
    key: 'mutuals',
    title: REPORT_TYPES.mutuals.label,
    description: 'Cobranças geradas por ocorrências de falecimento, com visão de cobertura e valores recebidos.',
    tableTitle: 'Cobranças por participante',
    rowCountLabel: `${charges.length} cobrança(s)`,
    columns: ['Grupo', 'Falecimento', 'Data do falecimento', 'Participante', 'Número', 'Valor previsto', 'Situação', 'Data da baixa', 'Conta', 'Valor recebido'],
    rows: charges.map(item => [
      item.group.name || '—',
      item.event.deceasedName || '—',
      formatDate(item.event.occurrenceDate),
      item.member.name || '—',
      item.member.memberNumber || '—',
      money.format(Number(item.expected || 0)),
      item.payment ? 'Paga' : 'Em aberto',
      item.payment ? formatDate(item.payment.paymentDate || item.payment.date) : '—',
      item.payment ? accountName(state, item.payment.accountId) : '—',
      item.payment ? money.format(Number(item.payment.entry || item.expected || 0)) : '—'
    ]),
    summary: [
      summary('Falecimentos', String(occurrences.length), 'primary'),
      summary('Cobranças', String(charges.length), 'primary'),
      summary('Pagas', String(paid.length), 'positive'),
      summary('Em aberto', String(Math.max(0, charges.length - paid.length)), charges.length - paid.length ? 'warning' : 'positive'),
      summary('Total previsto', money.format(expectedTotal), 'neutral'),
      summary('Total recebido', money.format(receivedTotal), 'positive'),
      summary('Pendente', money.format(outstandingTotal), outstandingTotal > EPSILON ? 'warning' : 'positive')
    ],
    insights: [
      insight('Cobertura das cobranças', percent.format(coverageRate), `${paid.length} de ${charges.length} cobrança(s) quitada(s)`, coverageRate >= 1 ? 'positive' : coverageRate >= 0.75 ? 'primary' : 'warning'),
      insight('Valor ainda em aberto', money.format(outstandingTotal), 'Previsto menos recebido no período', outstandingTotal > EPSILON ? 'warning' : 'positive'),
      insight('Grupo com mais cobranças', busiestGroup?.[0] || '—', busiestGroup ? `${busiestGroup[1]} cobrança(s)` : 'Nenhuma ocorrência no período', 'primary'),
      insight('Grupos cadastrados', String(groups.length), `${occurrences.length} ocorrência(s) no período`, 'neutral')
    ]
  };
}

function buildBirthdayReport(state, bounds) {
  const items = safeArray(state?.birthdays)
    .filter(member => birthdayInsideBounds(member.birthDate, bounds))
    .sort((first, second) => String(first.birthDate || '').slice(5).localeCompare(String(second.birthDate || '').slice(5)));
  const active = items.filter(memberIsActive).length;
  const mutual = items.filter(member => memberStatusLabel(member) === 'Mútua').length;
  const inactive = items.filter(member => memberStatusLabel(member) === 'Inativo').length;
  const monthCounts = topAggregate(items, member => {
    const value = String(member.birthDate || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? monthLabel(value.slice(0, 7)).replace(/ de \d{4}$/i, '') : 'Sem mês';
  }, () => 1);

  return {
    key: 'birthdays',
    title: REPORT_TYPES.birthdays.label,
    description: 'Pessoas com aniversário dentro do período, organizadas por data e situação no clube.',
    tableTitle: 'Calendário de aniversariantes',
    rowCountLabel: `${items.length} aniversariante(s)`,
    columns: ['Pessoa', 'Número', 'Aniversário', 'Situação'],
    rows: items.map(member => [member.name || '—', member.memberNumber || '—', formatBirthday(member.birthDate), memberStatusLabel(member)]),
    summary: [
      summary('Aniversariantes', String(items.length), 'primary'),
      summary('Associados ativos', String(active), 'positive'),
      summary('Mutuários', String(mutual), 'primary'),
      summary('Inativos', String(inactive), inactive ? 'neutral' : 'positive')
    ],
    insights: [
      insight('Maior concentração', monthCounts?.[0] || '—', monthCounts ? `${monthCounts[1]} aniversário(s)` : 'Nenhuma data no período', 'primary'),
      insight('Associados ativos', items.length ? percent.format(active / items.length) : '0%', `${active} de ${items.length} aniversariante(s)`, 'positive'),
      insight('Primeira data do período', items[0] ? formatBirthday(items[0].birthDate) : '—', items[0]?.name || 'Nenhum aniversariante', 'neutral')
    ]
  };
}

function agendaStatusKey(value) {
  const status = normalizeKey(value);
  if (status.includes('cancel')) return 'cancelled';
  if (status.includes('realiz') || status.includes('conclu') || status.includes('encerr')) return 'completed';
  if (status.includes('andamento')) return 'progress';
  return 'scheduled';
}

function buildAgendaReport(state, bounds, now) {
  const events = safeArray(state?.events).filter(item => dateInsideBounds(item.date, bounds)).map(item => ({
    type: 'Evento', date: item.date, time: item.time, title: item.name,
    location: item.locationType === 'virtual' ? (item.onlineUrl || 'Online · link será disponibilizado') : item.location,
    online: item.locationType === 'virtual', status: item.status || 'Confirmado', details: item.description
  }));
  const meetings = safeArray(state?.meetings).filter(item => dateInsideBounds(item.date, bounds)).map(item => ({
    type: 'Reunião', date: item.date, time: item.time, title: item.theme,
    location: item.locationType === 'virtual' ? (item.onlineUrl || 'Online · link será disponibilizado') : item.location,
    online: item.locationType === 'virtual', status: item.status || 'Pendente', details: item.notes
  }));
  const items = [...events, ...meetings]
    .sort((first, second) => `${first.date} ${first.time || ''}`.localeCompare(`${second.date} ${second.time || ''}`));
  const completed = items.filter(item => agendaStatusKey(item.status) === 'completed').length;
  const inProgress = items.filter(item => agendaStatusKey(item.status) === 'progress').length;
  const cancelled = items.filter(item => agendaStatusKey(item.status) === 'cancelled').length;
  const online = items.filter(item => item.online).length;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nextItem = items.find(item => item.date >= today && agendaStatusKey(item.status) !== 'cancelled') || null;

  return {
    key: 'agenda',
    title: REPORT_TYPES.agenda.label,
    description: 'Eventos e reuniões do período em ordem cronológica, com situação e formato de participação.',
    tableTitle: 'Compromissos do período',
    rowCountLabel: `${items.length} compromisso(s)`,
    columns: ['Tipo', 'Data', 'Horário', 'Título/Tema', 'Local', 'Status', 'Detalhes'],
    rows: items.map(item => [item.type, formatDate(item.date), item.time || '—', item.title || '—', item.location || '—', item.status || '—', item.details || '—']),
    summary: [
      summary('Compromissos', String(items.length), 'primary'),
      summary('Eventos', String(events.length), 'primary'),
      summary('Reuniões', String(meetings.length), 'primary'),
      summary('Realizados', String(completed), 'positive'),
      summary('Em andamento', String(inProgress), inProgress ? 'warning' : 'neutral'),
      summary('Cancelados', String(cancelled), cancelled ? 'negative' : 'neutral')
    ],
    insights: [
      insight('Formato', `${items.length - online} presencial(is)`, `${online} online`, 'primary'),
      insight('Próximo compromisso', nextItem ? formatDate(nextItem.date) : '—', nextItem?.title || 'Nenhum compromisso futuro neste período', 'neutral'),
      insight('Taxa de realização', items.length ? percent.format(completed / items.length) : '0%', `${completed} realizado(s) de ${items.length}`, completed === items.length && items.length ? 'positive' : 'primary')
    ]
  };
}

function buildNoticeReport(state, bounds) {
  const items = safeArray(state?.notices)
    .filter(item => dateRangeOverlaps(item.date, item.endDate, bounds))
    .sort((first, second) => String(first.date || '').localeCompare(String(second.date || '')));
  const high = items.filter(item => normalizeKey(item.priority) === 'alta').length;
  const medium = items.filter(item => normalizeKey(item.priority) === 'media').length;
  const low = items.filter(item => normalizeKey(item.priority) === 'baixa').length;
  const indefinite = items.filter(item => !item.endDate).length;

  return {
    key: 'notices',
    title: REPORT_TYPES.notices.label,
    description: 'Comunicados cuja vigência coincide com o período selecionado, com leitura rápida por prioridade.',
    tableTitle: 'Comunicados do período',
    rowCountLabel: `${items.length} aviso(s)`,
    columns: ['Início', 'Término', 'Título', 'Prioridade', 'Conteúdo'],
    rows: items.map(item => [formatDate(item.date), item.endDate ? formatDate(item.endDate) : 'Sem data final', item.title || '—', item.priority || '—', item.text || '—']),
    summary: [
      summary('Avisos', String(items.length), 'primary'),
      summary('Alta prioridade', String(high), high ? 'negative' : 'neutral'),
      summary('Média prioridade', String(medium), medium ? 'warning' : 'neutral'),
      summary('Baixa prioridade', String(low), 'neutral'),
      summary('Sem data final', String(indefinite), indefinite ? 'primary' : 'neutral')
    ],
    insights: [
      insight('Prioridade predominante', high >= medium && high >= low && high ? 'Alta' : medium >= low && medium ? 'Média' : low ? 'Baixa' : '—', `${items.length} aviso(s) no período`, high ? 'negative' : medium ? 'warning' : 'neutral'),
      insight('Vigência aberta', String(indefinite), indefinite === 1 ? '1 aviso sem data final' : `${indefinite} avisos sem data final`, indefinite ? 'primary' : 'neutral')
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
    memberships: () => buildMembershipReport(state, reportMonths(state, bounds, now), now),
    mutuals: () => buildMutualReport(state, bounds),
    birthdays: () => buildBirthdayReport(state, bounds),
    agenda: () => buildAgendaReport(state, bounds, now),
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
