export function createTreasuryAdminContext({
  getState,
  treasury,
  modalController,
  confirmation,
  persist,
  renderTreasuryView,
  renderCurrentView,
  closeModal,
  toast,
  captureInterfaceContext = () => null,
  restoreInterfaceContext = () => {},
  avatar,
  empty
}) {
  if (typeof getState !== 'function') {
    throw new TypeError('createTreasuryAdminController requer getState().');
  }

  if (!modalController?.body || typeof modalController.open !== 'function') {
    throw new TypeError('createTreasuryAdminController requer modalController.');
  }

  if (!treasury || typeof treasury !== 'object') {
    throw new TypeError('createTreasuryAdminController requer treasury.');
  }

  return {
    state: () => getState(),
    treasury,
    modalBody: modalController.body,
    showModal: title => modalController.open(title),
    confirmation,
    persist,
    renderTreasuryView,
    renderCurrentView,
    closeModal,
    toast,
    captureInterfaceContext,
    restoreInterfaceContext,
    avatar,
    empty
  };
}
