import test from 'node:test';
import assert from 'node:assert/strict';
import { createTreasuryAdminController } from '../assets/js/modules/treasury-admin.js';

function createDependencies() {
  const state = {
    birthdays: [],
    treasury: [],
    settings: {},
    familyGroups: [],
    mutualGroups: [],
    treasuryAccounts: [],
    treasuryCategories: []
  };

  return {
    getState: () => state,
    treasury: {
      familyGroupForMember: () => null
    },
    modalController: {
      body: {},
      open() {}
    },
    confirmation: { askConfirmation: async () => true },
    persist() {},
    renderTreasuryView() {},
    renderCurrentView() {},
    closeModal() {},
    toast() {},
    avatar: () => '',
    empty: () => ''
  };
}


test('fachada administrativa preserva o contrato público', () => {
  const controller = createTreasuryAdminController(createDependencies());
  const expected = [
    'memberSelectorCard',
    'openFamilyGroupsManager',
    'openMembershipPayment',
    'openMutualGroupsManager',
    'openMutualPayment',
    'openTreasuryAccountsManager',
    'shareMembershipCharge',
    'treasuryEntryFormHtml',
    'openTreasuryEntryForm'
  ];

  assert.deepEqual(Object.keys(controller), expected);
  expected.forEach(name => assert.equal(typeof controller[name], 'function'));
});


test('controlador exige estado e modal válidos', () => {
  const dependencies = createDependencies();
  assert.throws(
    () => createTreasuryAdminController({ ...dependencies, getState: null }),
    /requer getState/
  );
  assert.throws(
    () => createTreasuryAdminController({ ...dependencies, modalController: null }),
    /requer modalController/
  );
});
