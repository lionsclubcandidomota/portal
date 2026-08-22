import { memberIsActive } from '../../core/portal-members.js?v=6.52.0';
import { dateFromInput } from '../admin-dashboard/domain.js';
import { inferLegacyMembershipFeeForMonth, membershipFeeForMonth } from '../membership-fees.js?v=6.52.0';
import { membershipAllocationForMonth, membershipExpectedSnapshotForMonth } from '../treasury/shared-domain.js?v=6.52.0';
import { REPORT_TYPES } from './catalog.js?v=6.52.0';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const EPSILON = 0.005;

const safeArray = value => Array.isArray(value) ? value : [];
const normalizeKey = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const summary = (label, value, tone = 'neutral') => ({ label, value, tone });
const insight = (label, value, detail = '', tone = 'neutral') => ({ label, value, detail, tone });

function monthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value || '—';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function familyForMember(state, memberId) {
  return safeArray(state?.familyGroups).find(group => safeArray(group.memberIds).includes(memberId)) || null;
}

function memberPlanLabel(state, memberId) {
  const group = familyForMember(state, memberId);
  if (!group) return 'Individual';
  return group.primaryMemberId === memberId ? `Titular · ${group.name || 'Família'}` : `Familiar · ${group.name || 'Família'}`;
}

function isMembershipEntry(item) {
  return Number(item?.entry || 0) > 0
    && !item?.mutualGroupId
    && (Boolean(item?.memberId) || normalizeKey(item?.category).includes('mensalidade'));
}

function isProgrammedEntry(item) {
  return ['programado', 'agendado', 'pendente', 'vencida', 'vencido'].includes(normalizeKey(item?.status));
}

function coveredMonths(item) {
  const months = safeArray(item?.coveredMonths).filter(value => /^\d{4}-\d{2}$/.test(value));
  if (months.length) return months;
  const reference = item?.referenceMonth || String(item?.date || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(reference) ? [reference] : [];
}

function itemMemberIds(item) {
  const ids = safeArray(item?.memberIds).filter(Boolean);
  return ids.length ? ids : item?.memberId ? [item.memberId] : [];
}

function paymentsFor(entries, memberId, month) {
  return entries.filter(item => itemMemberIds(item).includes(memberId) && coveredMonths(item).includes(month));
}

function feeField(state, memberId) {
  const group = familyForMember(state, memberId);
  if (!group) return 'membershipMonthlyFee';
  return group.primaryMemberId === memberId ? 'membershipFamilyPrimaryFee' : 'membershipFamilyAdditionalFee';
}

function expectedForMonth(state, entries, memberId, month, currentMonth) {
  const payments = [...paymentsFor(entries, memberId, month)]
    .sort((first, second) => String(first?.paymentDate || first?.date || '').localeCompare(String(second?.paymentDate || second?.date || '')));
  const historical = payments
    .map(item => membershipExpectedSnapshotForMonth(item, memberId, month, dateFromInput))
    .find(amount => Number.isFinite(Number(amount)) && Number(amount) > 0);
  if (historical !== undefined) return Math.max(0, Number(historical));
  const field = feeField(state, memberId);
  return inferLegacyMembershipFeeForMonth(state, field, month, currentMonth)
    ?? membershipFeeForMonth(state?.settings || {}, field, month);
}

function paidForMonth(entries, memberId, month) {
  return paymentsFor(entries, memberId, month)
    .reduce((sum, item) => sum + membershipAllocationForMonth(item, memberId, month, dateFromInput), 0);
}

function openingDebtForMember(state, memberId) {
  return Math.max(0, Number(safeArray(state?.birthdays).find(member => member.id === memberId)?.membershipOpeningDebt || 0));
}

function openingDebtPaidForMember(entries, memberId) {
  return entries.reduce((sum, item) => sum + Math.max(0, Number(
    safeArray(item?.membershipOpeningDebtAllocations).find(entry => entry.memberId === memberId)?.amount || 0
  )), 0);
}

export function buildMembershipReport(state, months, now) {
  const entries = safeArray(state?.treasury).filter(item => isMembershipEntry(item) && !isProgrammedEntry(item));
  const members = safeArray(state?.birthdays).filter(memberIsActive)
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR'));
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let paidUnits = 0, partialUnits = 0, openUnits = 0, totalExpected = 0, totalReceived = 0;
  let totalOutstanding = 0, totalCredit = 0, openingOutstandingTotal = 0, membersInGoodStanding = 0;

  const rows = members.map(member => {
    const details = months.map(month => {
      const expected = expectedForMonth(state, entries, member.id, month, currentMonth);
      const received = paidForMonth(entries, member.id, month);
      const outstanding = Math.max(0, expected - received);
      const paid = expected > EPSILON ? outstanding <= EPSILON : received > EPSILON;
      const partial = !paid && received > EPSILON;
      return { month, expected, received, outstanding, credit: Math.max(0, received - expected), paid, partial };
    });
    const paidMonths = details.filter(item => item.paid);
    const partialMonths = details.filter(item => item.partial);
    const openMonths = details.filter(item => !item.paid && !item.partial);
    const expected = details.reduce((sum, item) => sum + item.expected, 0);
    const received = details.reduce((sum, item) => sum + item.received, 0);
    const outstanding = details.reduce((sum, item) => sum + item.outstanding, 0);
    const credit = details.reduce((sum, item) => sum + item.credit, 0);
    const openingOutstanding = Math.max(0, openingDebtForMember(state, member.id) - openingDebtPaidForMember(entries, member.id));
    const pendingLabels = details.filter(item => item.outstanding > EPSILON).map(item => monthLabel(item.month));
    const status = paidMonths.length === details.length ? 'Em dia' : partialMonths.length ? 'Parcial' : 'Pendente';

    paidUnits += paidMonths.length; partialUnits += partialMonths.length; openUnits += openMonths.length;
    totalExpected += expected; totalReceived += received; totalOutstanding += outstanding; totalCredit += credit;
    openingOutstandingTotal += openingOutstanding;
    if (paidMonths.length === details.length) membersInGoodStanding += 1;

    return [member.name || '—', member.memberNumber || '—', memberPlanLabel(state, member.id),
      `${paidMonths.length} quitada(s) · ${partialMonths.length} parcial(is) · ${openMonths.length} em aberto`,
      pendingLabels.length ? pendingLabels.join(', ') : 'Nenhuma', money.format(expected), money.format(received),
      money.format(outstanding), money.format(openingOutstanding), status];
  });

  const collectionRate = totalExpected > EPSILON ? Math.min(1, totalReceived / totalExpected) : 0;
  const individualCount = members.filter(member => !familyForMember(state, member.id)).length;
  return {
    key: 'memberships', title: REPORT_TYPES.memberships.label,
    description: `Situação das mensalidades de ${months.length ? `${monthLabel(months[0])} a ${monthLabel(months.at(-1))}` : 'nenhuma competência'}, respeitando valores históricos e pagamentos parciais.`,
    tableTitle: 'Situação por associado', rowCountLabel: `${members.length} associado(s) ativo(s)`,
    note: 'O saldo anterior é apresentado separadamente e não compõe o valor pendente das competências do período.',
    columns: ['Associado', 'Número', 'Perfil', 'Competências', 'Meses com saldo', 'Previsto', 'Recebido', 'Em aberto', 'Saldo anterior', 'Situação'], rows,
    summary: [summary('Associados ativos', String(members.length), 'primary'), summary('Meses analisados', String(months.length)),
      summary('Mensalidades quitadas', String(paidUnits), 'positive'), summary('Parciais', String(partialUnits), partialUnits ? 'primary' : 'neutral'),
      summary('Pendências', String(partialUnits + openUnits), partialUnits + openUnits ? 'warning' : 'positive'), summary('Previsto', money.format(totalExpected), 'primary'),
      summary('Total recebido', money.format(totalReceived), 'positive'), summary('Valor pendente', money.format(totalOutstanding), totalOutstanding > EPSILON ? 'warning' : 'positive')],
    insights: [
      insight('Arrecadação do período', percent.format(collectionRate), `${money.format(totalReceived)} de ${money.format(totalExpected)}`, collectionRate >= 1 ? 'positive' : collectionRate >= .75 ? 'primary' : 'warning'),
      insight('Associados em dia', `${membersInGoodStanding}/${members.length}`, `${individualCount} individual(is) · ${members.length - individualCount} familiar(es)`, membersInGoodStanding === members.length ? 'positive' : 'primary'),
      insight('Saldo anterior em aberto', money.format(openingOutstandingTotal), 'Fora da previsão pendente do período', openingOutstandingTotal > EPSILON ? 'warning' : 'positive'),
      insight('Créditos no período', money.format(totalCredit), 'Valores recebidos acima da competência esperada', totalCredit > EPSILON ? 'positive' : 'neutral')
    ]
  };
}
