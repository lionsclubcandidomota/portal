import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferLegacyMembershipFeeForMonth,
  membershipFeeForMonth,
  nextMembershipFeeMonth,
  registerMembershipFeeChange
} from '../assets/js/modules/membership-fees.js';

test('reajuste salvo em agosto passa a valer somente a partir de setembro', () => {
  const settings = {
    membershipMonthlyFee: 40,
    membershipFamilyPrimaryFee: 40,
    membershipFamilyAdditionalFee: 25
  };
  const changedAt = new Date(2026, 7, 21, 10, 30, 0);

  assert.equal(nextMembershipFeeMonth(changedAt), '2026-09');
  const result = registerMembershipFeeChange(settings, {
    membershipMonthlyFee: 50,
    membershipFamilyPrimaryFee: 48,
    membershipFamilyAdditionalFee: 30
  }, changedAt);

  assert.equal(result.changed, true);
  assert.equal(result.effectiveFrom, '2026-09');
  assert.equal(settings.membershipFeeHistory.length, 1);
  assert.equal(membershipFeeForMonth(settings, 'membershipMonthlyFee', '2026-07'), 40);
  assert.equal(membershipFeeForMonth(settings, 'membershipMonthlyFee', '2026-08'), 40);
  assert.equal(membershipFeeForMonth(settings, 'membershipMonthlyFee', '2026-09'), 50);
  assert.equal(membershipFeeForMonth(settings, 'membershipFamilyPrimaryFee', '2026-08'), 40);
  assert.equal(membershipFeeForMonth(settings, 'membershipFamilyPrimaryFee', '2026-09'), 48);
  assert.equal(membershipFeeForMonth(settings, 'membershipFamilyAdditionalFee', '2026-08'), 25);
  assert.equal(membershipFeeForMonth(settings, 'membershipFamilyAdditionalFee', '2026-09'), 30);
});

test('histórico suporta reajustes sucessivos sem alterar competências anteriores', () => {
  const settings = {
    membershipMonthlyFee: 40,
    membershipFamilyPrimaryFee: 40,
    membershipFamilyAdditionalFee: 25
  };

  registerMembershipFeeChange(settings, { membershipMonthlyFee: 50 }, new Date(2026, 7, 10));
  registerMembershipFeeChange(settings, { membershipMonthlyFee: 60 }, new Date(2026, 9, 5));

  assert.equal(membershipFeeForMonth(settings, 'membershipMonthlyFee', '2026-08'), 40);
  assert.equal(membershipFeeForMonth(settings, 'membershipMonthlyFee', '2026-09'), 50);
  assert.equal(membershipFeeForMonth(settings, 'membershipMonthlyFee', '2026-10'), 50);
  assert.equal(membershipFeeForMonth(settings, 'membershipMonthlyFee', '2026-11'), 60);
});


test('estado legado infere o valor anterior a partir dos pagamentos já registrados', () => {
  const state = {
    settings: {
      membershipMonthlyFee: 50,
      membershipFamilyPrimaryFee: 48,
      membershipFamilyAdditionalFee: 30
    },
    treasury: [{
      id: 'payment-aug',
      memberAllocations: [
        { role: 'Individual', monthlyAmount: 40, months: ['2026-08'], monthAllocations: [{ month: '2026-08', expectedAmount: 40, amount: 40 }] },
        { role: 'Titular', monthlyAmount: 40, months: ['2026-08'], monthAllocations: [{ month: '2026-08', expectedAmount: 40, amount: 40 }] },
        { role: 'Familiar', monthlyAmount: 25, months: ['2026-08'], monthAllocations: [{ month: '2026-08', expectedAmount: 25, amount: 25 }] }
      ]
    }]
  };

  assert.equal(inferLegacyMembershipFeeForMonth(state, 'membershipMonthlyFee', '2026-06', '2026-08'), 40);
  assert.equal(inferLegacyMembershipFeeForMonth(state, 'membershipMonthlyFee', '2026-08', '2026-08'), 40);
  assert.equal(inferLegacyMembershipFeeForMonth(state, 'membershipMonthlyFee', '2026-09', '2026-08'), null);
  assert.equal(inferLegacyMembershipFeeForMonth(state, 'membershipFamilyPrimaryFee', '2026-07', '2026-08'), 40);
  assert.equal(inferLegacyMembershipFeeForMonth(state, 'membershipFamilyAdditionalFee', '2026-07', '2026-08'), 25);
});
