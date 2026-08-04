import { createNavigationController } from '../navigation.js?v=6.34.1';
import { createUiShellController } from '../ui-shell.js';
import { createReadOnlyGuard } from '../read-only-guard.js?v=6.34.1';

export function createNavigationFeature({
  elements,
  runtime,
  renderView,
  destroyViewResources,
  refreshGlobalControls,
  ensureAdmin,
  openForm,
  setTreasurySection,
  fullDateFormat,
  confirmation,
  closeModal,
  shareBirthday
}) {
  let navigation = null;

  const uiShell = createUiShellController({
    toastRegion: elements.toastRegion,
    clock: elements.clock,
    currentDate: elements.currentDate,
    fullDateFormat,
    confirmAccept: elements.confirmAccept,
    confirmSecondary: elements.confirmSecondary,
    confirmModal: elements.confirmModal,
    confirmation,
    closeModal,
    closeSidebar: () => navigation?.closeSidebar(),
    shareBirthday
  });

  navigation = createNavigationController({
    pageTitle: elements.pageTitle,
    pageDescription: elements.pageDescription,
    modeChip: elements.modeChip,
    sidebar: elements.sidebar,
    overlay: elements.overlay,
    isAdminUnlocked: runtime.isAdminUnlocked,
    getAccessRole: () => runtime.accessRole,
    getAccessPolicy: runtime.getAccessPolicy,
    renderView,
    destroyViewResources,
    refreshGlobalControls,
    ensureAdmin,
    openForm,
    setTreasurySection,
    logoutAdmin: runtime.logoutAdmin
  });

  const readOnlyGuard = createReadOnlyGuard({
    getAccessPolicy: runtime.getAccessPolicy,
    toast: message => uiShell.toast(message)
  });

  return {
    navigation,
    uiShell,
    readOnlyGuard,
    toast: message => uiShell.toast(message),
    bind() {
      navigation.bind();
      uiShell.bind();
      readOnlyGuard.bind();
    }
  };
}
