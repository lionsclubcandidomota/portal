import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMembershipStatement } from '../assets/js/modules/treasury-admin/membership-statement.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

function monthRange(start, end) {
  const result = [];
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return result;
}

test('extrato individual consolida mensalidades, parcial, crédito e saldo anterior', () => {
  const member = { id: 'm1', name: 'Ana', membershipOpeningDebt: 30 };
  const entries = [
    { id: 't1', entry: 50, memberId: 'm1', coveredMonths: ['2026-01'], membershipOpeningDebtAllocations: [{ memberId: 'm1', amount: 10 }], accountId: 'a1', date: '2026-01-10' },
    { id: 't2', entry: 20, memberId: 'm1', coveredMonths: ['2026-02'], accountId: 'a1', date: '2026-02-10' },
    { id: 't3', entry: 50, memberId: 'm1', coveredMonths: ['2026-03'], accountId: 'a1', date: '2026-03-10' }
  ];
  const paidByMonth = { '2026-01': 40, '2026-02': 20, '2026-03': 50, '2026-04': 0 };
  const treasury = {
    currentMonth: () => '2026-04',
    monthRange,
    isMembershipEntry: item => item.entry > 0,
    isProgrammed: () => false,
    memberIds: item => [item.memberId],
    coveredMonths: item => item.coveredMonths || [],
    membershipExpectedAmountForMember: () => 40,
    membershipPaidAmountForMonth: (_id, month) => paidByMonth[month] || 0,
    membershipOpeningDebtForMember: () => 30,
    membershipOpeningDebtPaidAmount: () => 10,
    membershipOpeningDebtOutstanding: () => 20,
    paymentsFor: (_id, month) => entries.filter(item => item.coveredMonths?.includes(month)),
    membershipAllocationForMonth: (item, _id, month) => item.id === 't1' && month === '2026-01' ? 40 : item.entry,
    accountFor: () => ({ name: 'Conta principal' })
  };

  const statement = buildMembershipStatement({ treasury: entries }, treasury, member);
  assert.equal(statement.rows.length, 4);
  assert.equal(statement.rows[0].status.label, 'Quitada');
  assert.equal(statement.rows[1].status.label, 'Parcial');
  assert.equal(statement.rows[2].status.label, 'Crédito');
  assert.equal(statement.rows[2].credit, 10);
  assert.equal(statement.rows[3].status.label, 'Em aberto');
  assert.equal(statement.openingOutstanding, 20);
  assert.equal(statement.outstanding, 60);
  assert.equal(statement.credit, 10);
  assert.equal(statement.totalOutstanding, 80);
  assert.equal(statement.net, 70);
});


test('saldo devedor líquido soma saldo anterior em aberto e desconta crédito do período', () => {
  const member = { id: 'm1', name: 'Ana', membershipOpeningDebt: 630 };
  const treasury = {
    currentMonth: () => '2026-06',
    monthRange,
    membershipExpectedAmountForMember: () => 40,
    membershipExpectedAmountForMemberMonth: () => 40,
    membershipPaidAmountForMonth: (_id, month) => month === '2026-01' ? 80 : 0,
    membershipOpeningDebtForMember: () => 630,
    membershipOpeningDebtPaidAmount: () => 0,
    membershipOpeningDebtOutstanding: () => 630,
    paymentsFor: () => [],
    isMembershipEntry: () => false,
    isProgrammed: () => false,
    membershipAllocationForMonth: () => 0,
    accountFor: () => null
  };

  const statement = buildMembershipStatement(
    { treasury: [] },
    treasury,
    member,
    { start: '2026-01', end: '2026-06' }
  );

  assert.equal(statement.outstanding, 200);
  assert.equal(statement.openingOutstanding, 630);
  assert.equal(statement.totalOutstanding, 830);
  assert.equal(statement.credit, 40);
  assert.equal(statement.net, 790);
});

test('extrato respeita exatamente o período selecionado em Mensalidades', () => {
  const member = { id: 'm1', name: 'Ana', membershipOpeningDebt: 30 };
  const entries = [
    { id: 'jan', entry: 40, memberId: 'm1', coveredMonths: ['2026-01'], accountId: 'a1', date: '2026-01-10' },
    { id: 'mar', entry: 20, memberId: 'm1', coveredMonths: ['2026-03'], accountId: 'a1', date: '2026-03-10' },
    { id: 'jul', entry: 40, memberId: 'm1', coveredMonths: ['2026-07'], accountId: 'a1', date: '2026-07-10' },
    { id: 'ago', entry: 55, memberId: 'm1', coveredMonths: ['2026-08'], accountId: 'a1', date: '2026-08-10' },
    { id: 'saldo', entry: 10, memberId: 'm1', coveredMonths: [], membershipOpeningDebtAllocations: [{ memberId: 'm1', amount: 10 }], accountId: 'a1', date: '2025-12-20' }
  ];
  const paidByMonth = {
    '2026-01': 40,
    '2026-02': 0,
    '2026-03': 20,
    '2026-04': 0,
    '2026-05': 0,
    '2026-06': 0,
    '2026-07': 40,
    '2026-08': 55
  };
  const treasury = {
    currentMonth: () => '2026-08',
    monthRange,
    isMembershipEntry: item => item.entry > 0,
    isProgrammed: () => false,
    memberIds: item => [item.memberId],
    coveredMonths: item => item.coveredMonths || [],
    membershipExpectedAmountForMember: () => 40,
    membershipPaidAmountForMonth: (_id, month) => paidByMonth[month] || 0,
    membershipOpeningDebtForMember: () => 30,
    membershipOpeningDebtPaidAmount: () => 10,
    membershipOpeningDebtOutstanding: () => 20,
    paymentsFor: (_id, month) => entries.filter(item => item.coveredMonths?.includes(month)),
    membershipAllocationForMonth: item => item.entry,
    accountFor: () => ({ name: 'Conta principal' })
  };

  const statement = buildMembershipStatement(
    { treasury: entries },
    treasury,
    member,
    { start: '2026-01', end: '2026-06' }
  );
  assert.deepEqual(statement.months, monthRange('2026-01', '2026-06'));
  assert.equal(statement.rows.some(row => row.month === '2026-07' || row.month === '2026-08'), false);
  assert.equal(statement.totalReceived, 60);
  assert.equal(statement.outstanding, 180);
  assert.equal(statement.credit, 0);
  assert.equal(statement.totalOutstanding, 200);
  assert.equal(statement.net, 200);
  assert.equal(statement.openingPaid, 10);
  assert.equal(statement.openingOutstanding, 20);
  assert.equal(statement.openingPayments.length, 1);
});

test('menu e carregamento lazy expõem o extrato de mensalidades', async () => {
  const [memberships, view, lazy] = await Promise.all([
    source('assets/js/modules/treasury/memberships.js'),
    source('assets/js/modules/treasury/view-memberships.js'),
    source('assets/js/modules/lazy-entity-actions.js')
  ]);
  assert.match(memberships, /Extrato de mensalidades/);
  assert.match(memberships, /data-membership-statement/);
  assert.match(view, /openMembershipStatement/);
  assert.match(view, /openMembershipStatement\(button\.dataset\.membershipStatement, \{[\s\S]*start: membershipStart,[\s\S]*end: membershipEnd/);
  assert.match(lazy, /openMembershipStatement/);
});


test('CSS do extrato mantém competências em cards estáveis e responsivos', async () => {
  const [css, statementModule] = await Promise.all([
    source('assets/css/pages/membership-statement.css'),
    source('assets/js/modules/treasury-admin/membership-statement.js')
  ]);
  assert.match(css, /\.membership-statement-list\{display:flex;min-height:0;flex:1 1 auto;flex-direction:column/);
  assert.match(css, /\.membership-statement-row\{display:flex;min-width:0;flex:0 0 auto;flex-direction:column/);
  assert.match(css, /\.membership-statement-row-main\{[^}]*min-height:78px/);
  assert.match(css, /\.membership-statement-values>span\{[^}]*min-height:54px/);
  assert.match(css, /@media\(max-width:520px\)\{[^}]*membership-statement/s);
  assert.match(css, /\.membership-statement-row\.is-partial\{[^}]*#2b79d8/);
  assert.match(css, /\.membership-statement-row\.is-pending\{[^}]*#d99a17/);
  assert.match(statementModule, /const paymentDetailsHtml = row\.payments\.length/);
});
