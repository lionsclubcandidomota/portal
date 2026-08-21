import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMembershipViewModel } from '../assets/js/modules/treasury/memberships.js';
import { allocateMembershipPayment } from '../assets/js/modules/treasury-admin/domain.js';
import { createTreasuryController } from '../assets/js/modules/treasury/controller.js';
import { normalize, parseLocalDate, sumTreasury } from '../assets/js/utils.js';

function setup() {
  const state = {
    settings: {
      membershipMonthlyFee: 50,
      membershipFamilyPrimaryFee: 45,
      membershipFamilyAdditionalFee: 30
    },
    birthdays: [
      { id: 'm1', name: 'Ana', memberNumber: '1', active: true },
      { id: 'm2', name: 'Bruno', memberNumber: '2', active: true }
    ],
    familyGroups: [],
    treasury: [
      {
        id: 'p1',
        entry: 50,
        exit: 0,
        category: 'Mensalidades',
        memberId: 'm1',
        memberIds: ['m1'],
        coveredMonths: ['2026-07'],
        status: 'Recebido',
        date: '2026-07-10'
      }
    ]
  };
  const treasury = createTreasuryController({
    getState: () => state,
    parseLocalDate,
    normalize,
    todayStart: () => new Date(2026, 6, 30),
    sumTreasury
  });
  treasury.membershipStart = '2026-07';
  treasury.membershipEnd = '2026-08';
  return { state, treasury };
}

test('modelo de mensalidades calcula unidades quitadas e pendentes', () => {
  const { state, treasury } = setup();
  const model = buildMembershipViewModel(state, treasury, new Date(2026, 6, 30));

  assert.deepEqual(model.membershipMonths, ['2026-07', '2026-08']);
  assert.equal(model.membershipExpectedUnits, 4);
  assert.equal(model.membershipPaidUnits, 1);
  assert.equal(model.membershipTotal, 50);
  assert.deepEqual(model.membershipProgress.get('m1').pendingMonths, ['2026-08']);
  assert.deepEqual(model.membershipProgress.get('m2').pendingMonths, ['2026-07', '2026-08']);
});

test('modelo respeita busca e filtro de situação armazenados no controlador', () => {
  const { state, treasury } = setup();
  treasury.membershipSearch = 'Bruno';
  treasury.membershipStatus = 'pending';
  const model = buildMembershipViewModel(state, treasury, new Date(2026, 6, 30));

  assert.deepEqual(model.membershipVisibleMembers.map(member => member.id), ['m2']);
});



test('rateio aplica valor recebido das competências mais antigas para as mais recentes', () => {
  const result = allocateMembershipPayment({
    memberIds: ['m1'],
    members: [{ id: 'm1', name: 'Ana' }],
    coveredMonths: ['2026-08', '2026-07'],
    amount: 70,
    expectedAmountForMember: () => 50,
    paidAmountForMemberMonth: () => 0
  });

  assert.equal(result.allocatedTotal, 70);
  assert.equal(result.unallocatedAmount, 0);
  assert.deepEqual(result.allocations.map(item => [item.month, item.amount, item.remainingAfter]), [
    ['2026-07', 50, 0],
    ['2026-08', 20, 30]
  ]);
  assert.deepEqual(result.memberAllocations[0].months, ['2026-07', '2026-08']);
});

test('pagamento parcial mantém competência em aberto até atingir o valor esperado', () => {
  const { state, treasury } = setup();
  state.treasury[0].entry = 30;

  assert.equal(treasury.membershipPaidAmountForMonth('m1', '2026-07'), 30);
  assert.equal(treasury.membershipOutstandingForMonth('m1', '2026-07'), 20);
  assert.equal(treasury.monthIsPartial('m1', '2026-07'), true);
  assert.equal(treasury.monthIsPaid('m1', '2026-07'), false);

  state.treasury.push({
    id: 'p2',
    entry: 20,
    exit: 0,
    category: 'Mensalidades',
    memberId: 'm1',
    memberIds: ['m1'],
    coveredMonths: ['2026-07'],
    status: 'Recebido',
    date: '2026-07-20',
    memberAllocations: [{
      memberId: 'm1',
      amount: 20,
      months: ['2026-07'],
      monthAllocations: [{ month: '2026-07', amount: 20, expectedAmount: 50, previouslyPaid: 30, outstandingBefore: 20, remainingAfter: 0 }]
    }]
  });

  assert.equal(treasury.membershipPaidAmountForMonth('m1', '2026-07'), 50);
  assert.equal(treasury.membershipOutstandingForMonth('m1', '2026-07'), 0);
  assert.equal(treasury.monthIsPartial('m1', '2026-07'), false);
  assert.equal(treasury.monthIsPaid('m1', '2026-07'), true);
});

test('saldo anterior é controlado separadamente das competências e aceita abatimento parcial', () => {
  const { state, treasury } = setup();
  const member = state.birthdays.find(item => item.id === 'm1');
  member.membershipOpeningDebt = 120;

  state.treasury.push({
    id: 'opening-1',
    entry: 50,
    exit: 0,
    category: 'Mensalidades',
    memberId: 'm1',
    memberIds: ['m1'],
    coveredMonths: [],
    status: 'Recebido',
    date: '2026-07-15',
    membershipOpeningDebtAllocations: [{
      memberId: 'm1',
      outstandingBefore: 120,
      amount: 50,
      remainingAfter: 70
    }]
  });

  assert.equal(treasury.membershipOpeningDebtForMember('m1'), 120);
  assert.equal(treasury.membershipOpeningDebtPaidAmount('m1'), 50);
  assert.equal(treasury.membershipOpeningDebtOutstanding('m1'), 70);
  assert.equal(treasury.membershipOpeningDebtIsPartial('m1'), true);
});

test('saldo anterior em aberto impede associado de ficar em dia mesmo com competências quitadas', () => {
  const { state, treasury } = setup();
  const member = state.birthdays.find(item => item.id === 'm1');
  member.membershipOpeningDebt = 80;
  treasury.membershipStart = '2026-07';
  treasury.membershipEnd = '2026-07';

  const model = buildMembershipViewModel(state, treasury, new Date(2026, 6, 30));
  const progress = model.membershipProgress.get('m1');

  assert.deepEqual(progress.pendingMonths, []);
  assert.equal(progress.openingDebtOutstanding, 80);
  assert.equal(progress.outstandingTotal, 80);
  assert.equal(model.membershipPaidIds.has('m1'), false);
  assert.equal(model.membershipOpeningDebtOutstandingTotal, 80);
});
