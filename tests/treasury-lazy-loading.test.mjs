import assert from 'node:assert/strict';
import test from 'node:test';
import { createLazyTreasuryController } from '../assets/js/modules/lazy-treasury-controller.js';
import { buildTreasuryDashboardSummary } from '../assets/js/modules/treasury/dashboard-summary.js';
import { normalize, parseLocalDate, sumTreasury } from '../assets/js/utils.js';
import { todayStart } from '../assets/js/modules/timeline.js';

function currentMonth() {
  const date = todayStart();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function fixtureState() {
  const month = currentMonth();
  return {
    settings: {
      membershipMonthlyFee: 100,
      membershipFamilyPrimaryFee: 100,
      membershipFamilyAdditionalFee: 50
    },
    birthdays: [
      { id: 'm1', name: 'Associado 1', status: 'Ativo', active: true },
      { id: 'm2', name: 'Associado 2', status: 'Ativo', active: true },
      { id: 'm3', name: 'Mutuário', status: 'Mútua', active: true }
    ],
    treasuryAccounts: [
      { id: 'a1', name: 'Principal', type: 'Conta corrente', initialBalance: 10, active: true },
      { id: 'a2', name: 'Antiga', type: 'Conta corrente', initialBalance: 0, active: false }
    ],
    treasuryCategories: ['Mensalidades', 'Mútuas'],
    familyGroups: [],
    mutualGroups: [{
      id: 'g1',
      name: 'Mútua 1',
      memberships: [
        { id: 'gm1', memberId: 'm1', joinedMonth: month, endedMonth: '' },
        { id: 'gm2', memberId: 'm2', joinedMonth: month, endedMonth: '' }
      ],
      events: [{
        id: 'e1',
        deceasedName: 'Associado do Distrito',
        occurrenceDate: `${month}-05`,
        amount: 30,
        participantIds: ['m1', 'm2'],
        createdAt: `${month}-05T10:00:00.000Z`
      }]
    }],
    treasury: [
      {
        id: 't-membership',
        accountId: 'a1',
        date: `${month}-10`,
        status: 'Realizado',
        category: 'Mensalidades',
        memberId: 'm1',
        memberIds: ['m1'],
        coveredMonths: [month],
        entry: 100,
        exit: 0
      },
      {
        id: 't-mutual',
        accountId: 'a1',
        date: `${month}-11`,
        status: 'Realizado',
        category: 'Mútuas',
        mutualGroupId: 'g1',
        mutualEventId: 'e1',
        mutualMemberId: 'm1',
        mutualChargeKey: 'g1::e1::m1',
        entry: 30,
        exit: 0
      },
      {
        id: 't-overdue',
        accountId: 'a1',
        date: '2000-01-01',
        status: 'Programado',
        category: 'Outros',
        entry: 0,
        exit: 25
      }
    ]
  };
}

test('resumo financeiro do Dashboard independe do controlador completo', () => {
  const summary = buildTreasuryDashboardSummary(fixtureState());

  assert.equal(summary.activeMembersCount, 2);
  assert.equal(summary.membershipPaidCount, 1);
  assert.equal(summary.membershipTotal, 100);
  assert.equal(summary.mutualEventCount, 1);
  assert.equal(summary.mutualChargeCount, 2);
  assert.equal(summary.mutualPaidCount, 1);
  assert.equal(summary.mutualExpectedTotal, 60);
  assert.equal(summary.mutualReceivedTotal, 30);
  assert.equal(summary.mutualActiveGroupCount, 1);
  assert.equal(summary.overdueMovementCount, 1);
  assert.equal(summary.activeAccountCount, 1);
});

test('controlador da Tesouraria é criado somente no primeiro acesso e preserva a seção escolhida', async () => {
  const state = fixtureState();
  const sections = [];
  const lazyTreasury = createLazyTreasuryController({
    getState: () => state,
    parseLocalDate,
    normalize,
    todayStart,
    sumTreasury,
    initialSection: 'movements',
    onSectionChange: section => sections.push(section)
  });

  assert.equal(lazyTreasury.peek(), null);
  assert.equal(lazyTreasury.setSection('memberships'), 'memberships');
  assert.equal(lazyTreasury.peek(), null);

  const controller = await lazyTreasury.load();
  assert.equal(controller.section, 'memberships');
  assert.equal(lazyTreasury.peek(), controller);

  lazyTreasury.setSection('mutuals');
  assert.equal(controller.section, 'mutuals');
  lazyTreasury.reset();
  assert.equal(controller.section, 'movements');
  assert.ok(sections.includes('memberships'));
  assert.ok(sections.includes('mutuals'));
});

test('Dashboard não considera mensalidade parcialmente paga como quitada', () => {
  const state = fixtureState();
  state.treasury.find(item => item.id === 't-membership').entry = 40;
  const summary = buildTreasuryDashboardSummary(state);

  assert.equal(summary.membershipPaidCount, 0);
  assert.equal(summary.membershipTotal, 40);
});
