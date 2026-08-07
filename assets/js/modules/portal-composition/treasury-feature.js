import { createTreasuryController, destroyTreasuryCharts } from '../treasury.js?v=6.44.0';
import { createTreasuryAdminController } from '../treasury-admin.js?v=6.44.0';
import {
  loadD1OperationalMemberships,
  loadD1OperationalMutuals,
  loadD1OperationalTreasury
} from '../secure-storage/client.js?v=6.44.0';

export function createTreasuryFeature({
  getState,
  parseLocalDate,
  normalize,
  todayStart,
  sumTreasury,
  storage = sessionStorage
}) {
  const treasury = createTreasuryController({
    getState,
    parseLocalDate,
    normalize,
    todayStart,
    sumTreasury,
    initialSection: storage.getItem('lions.treasury.section') || 'movements',
    onSectionChange: section => storage.setItem('lions.treasury.section', section)
  });

  function createAdministration({
    modalController,
    confirmation,
    persist,
    renderTreasuryView,
    renderCurrentView,
    closeModal,
    toast,
    avatar,
    empty
  }) {
    return createTreasuryAdminController({
      getState,
      treasury,
      modalController,
      confirmation,
      persist: (...args) => {
        treasury.invalidateOperationalReads();
        return persist(...args);
      },
      renderTreasuryView,
      renderCurrentView,
      closeModal,
      toast,
      avatar,
      empty
    });
  }

  return {
    treasury,
    destroyCharts: destroyTreasuryCharts,
    createAdministration,
    parseCurrencyInput: treasury.parseCurrencyInput,
    currencyInputValue: treasury.currencyInputValue,
    memberIsActive: treasury.memberIsActive,
    loadOperationalMovements: options => loadD1OperationalTreasury(getState(), options),
    loadOperationalMemberships: options => loadD1OperationalMemberships(getState(), options),
    loadOperationalMutuals: options => loadD1OperationalMutuals(getState(), options),
    accountSummaries: treasury.accountSummaries,
    accountTypeIcon: treasury.accountTypeIcon
  };
}
