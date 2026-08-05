import { createTreasuryController, destroyTreasuryCharts } from '../treasury.js?v=6.35.1';
import { createTreasuryAdminController } from '../treasury-admin.js?v=6.35.1';

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
      persist,
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
    accountSummaries: treasury.accountSummaries,
    accountTypeIcon: treasury.accountTypeIcon
  };
}
