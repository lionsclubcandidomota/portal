import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMembershipViewModel } from '../assets/js/modules/treasury/memberships.js';
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
