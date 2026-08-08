import { loadState, exportState, parseImportFile } from '../storage.js';
import { fullDateFormat, parseLocalDate, formatDate, nextBirthdayDate, daysUntil, escapeHtml, normalize, fileToDataUrl, sumTreasury, toInputDate } from '../utils.js';
import { createFinancePrivacyController } from './finance-privacy.js';
import { createLazyTreasuryController } from './lazy-treasury-controller.js?v=6.46.4';
import { currencyInputValue, parseCurrencyInput } from './treasury/domain.js?v=6.46.4';
import { memberIsActive } from '../core/portal-members.js?v=6.46.4';
import { createLazySettingsController } from './lazy-settings.js?v=6.46.4';
import { createNavigationController } from './navigation.js?v=6.46.4';
import { createUiShellController } from './ui-shell.js';
import { createModalController } from './modal.js';
import { createFileInputsController } from './file-inputs.js';
import { createPublishCenterController } from './publish-center.js?v=6.46.4';
import { createPortalRefreshController } from './portal-refresh.js?v=6.46.4';
import { createAuditLogController } from './audit-log.js?v=6.46.4';
import { createRecoveryCenterController } from './recovery-center.js?v=6.46.4';
import { createPublicationReviewController } from './publication-review-controller.js?v=6.46.4';
import { markdownToHtml } from './markdown.js';
import { createConfirmationController } from './confirmation.js';
import { todayStart, timelineHeading } from './timeline.js';
import {
  createBirthdaysController,
  createBirthdayActions,
  birthdayDisplayDate,
  birthdayStatus,
  birthdayMatchesPeriod,
  birthdayRows,
  birthdayCards
} from './birthdays.js';
import { avatar, empty, kpi, priorityBadge, statusBadge } from './visual-helpers.js';
import { createLazyBirthdayArtworkShare } from './lazy-birthday-artwork.js?v=6.46.4';
import {
  appointmentLocationText,
  appointmentTypeBadge,
  compareAppointments,
  downloadAppointmentCalendar,
  getAppointments as buildAppointments,
  locationInfo,
  renderLocation
} from './appointments.js?v=6.46.4';
import { createPortalRuntimeController } from './portal-runtime.js?v=6.46.4';
import { getPortalElements } from './portal-elements.js?v=6.46.4';
import { createReadOnlyGuard } from './read-only-guard.js?v=6.46.4';
import { createPortalViewRenderer } from './portal-view-renderer.js?v=6.46.4';
import { createAgendaController } from './agenda-state.js?v=6.46.4';
import { createLazyEntityActions } from './lazy-entity-actions.js?v=6.46.4';
import { createLazyAdminPanelController } from './lazy-admin-panel.js?v=6.46.4';
import { createInterfaceContextController } from './interface-context.js?v=6.46.4';
import { createLazyAccessManagementController } from './lazy-access-management.js?v=6.46.4';
import { ACCESS_CAPABILITIES } from './portal-runtime/authorization.js?v=6.46.4';

export function bootstrapPortal() {
  let state = loadState();
  const treasuryFeature = createLazyTreasuryController({
    getState: () => state,
    parseLocalDate,
    normalize,
    todayStart,
    sumTreasury,
    initialSection: sessionStorage.getItem('lions.treasury.section') || 'movements',
    onSectionChange: section => sessionStorage.setItem('lions.treasury.section', section)
  });
  const financePrivacy = createFinancePrivacyController();
  const {
    root,
    pageTitle,
    pageDescription,
    modeChip,
    sidebar,
    overlay,
    modal,
    modalBody,
    modalTitle,
    confirmModal,
    confirmTitle,
    confirmMessage,
    confirmIcon,
    confirmAccept,
    confirmSecondary,
    confirmCancel,
    importInput,
    imageInput,
    toastRegion,
    clock,
    currentDate,
    portalRefreshButton,
    publishCenter: publishCenterElements
  } = getPortalElements();
  const confirmation = createConfirmationController({
    confirmModal,
    confirmTitle,
    confirmMessage,
    confirmIcon,
    confirmAccept,
    confirmSecondary,
    confirmCancel
  });
  let fileInputs = null;
  const modalController = createModalController({
    modal,
    modalBody,
    modalTitle,
    onClose: () => fileInputs?.clearImageTarget()
  });
  const auditLog = createAuditLogController({
    storage: localStorage,
    modalController,
    toast: message => toast(message)
  });
  let runtime = null;
  let readOnlyGuard = null;
  let viewRenderer = null;
  let navigation = null;
  const interfaceContext = createInterfaceContextController({
    getCurrentView: () => navigation?.currentView || 'dashboard',
    getTreasurySection: () => treasuryFeature.section
  });
  const renderPreservingContext = () => interfaceContext.renderPreserving(() => render());
  const recoveryCenter = createRecoveryCenterController({
    getState: () => state,
    modalController,
    confirmation,
    toast: message => toast(message),
    onRestore: (nextState, details) => runtime.restoreState(nextState, details),
    onSummaryChange: () => {
      if (navigation?.currentView === 'admin' && runtime?.adminUnlocked) renderAdmin();
    }
  });
  runtime = createPortalRuntimeController({
    getState: () => state,
    setState: nextState => { state = nextState; },
    confirmation,
    applySettings: () => applySettings(),
    renderCurrentView: () => renderPreservingContext(),
    updateClock: () => uiShell.updateClock(),
    bindControllers: () => {
      navigation.bind();
      uiShell.bind();
      fileInputs.bind();
      publishCenter.bind();
      portalRefresh.bind();
      readOnlyGuard?.bind();
    },
    syncFinancePrivacy: () => financePrivacy.sync(),
    openPublishCenter: options => publishCenter.open(options),
    closePublishCenter: options => publishCenter.close(options),
    refreshPublishCenter: () => publishCenter.refresh(),
    setPublishStatus: (status, message) => publishCenter.setStatus(status, message),
    resetInterfaceState: () => resetInterfaceState(),
    getCurrentView: () => navigation.currentView,
    renderAdmin: () => renderAdmin(),
    updateAccessUI: () => updateAccessUI(),
    setView: view => setView(view),
    toast: message => toast(message),
    auditLog,
    recoveryCenter
  });
  const accessManagement = createLazyAccessManagementController({
    getState: () => state,
    modalController,
    confirmation,
    persist: runtime.persist,
    toast: message => toast(message),
    canManageUsers: () => runtime.can(ACCESS_CAPABILITIES.MANAGE_USERS)
  });
  const publicationReview = createPublicationReviewController({ modalController, runtime });
  const publishCenter = createPublishCenterController({
    ...publishCenterElements,
    getAdminUnlocked: runtime.isWriteAllowed,
    getPendingChanges: () => runtime.pendingChanges,
    getGithubToken: () => runtime.githubToken,
    getLastSyncInfo: () => runtime.lastSyncInfo,
    getPendingReview: () => runtime.getPendingPublicationReview(),
    onReview: publicationReview.open,
    onPublish: runtime.commitPendingChanges,
    onDiscard: runtime.discardPendingChanges
  });
  const entityActions = createLazyEntityActions({
    getState: () => state,
    loadTreasuryController: treasuryFeature.load,
    root,
    modalController,
    confirmation,
    persist: runtime.persist,
    renderTreasuryView,
    renderCurrentView: renderPreservingContext,
    closeModal,
    toast,
    isAdminUnlocked: runtime.isWriteAllowed,
    canManage: capability => runtime.can(capability),
    setView,
    selectImage: target => fileInputs?.requestImage(target),
    captureInterfaceContext: interfaceContext.capture,
    restoreInterfaceContext: interfaceContext.restore,
    avatar,
    empty
  });
  const {
    applyBirthdayPhoto,
    bindRowActions,
    bindToolbar,
    ensureAdmin,
    openForm,
    pageToolbar,
    rowActions,
    openFamilyGroupsManager,
    openMembershipPayment,
    openMutualGroupsManager,
    openMutualEventManager,
    openMutualPayment,
    openTreasuryAccountsManager,
    shareMembershipCharge
  } = entityActions;
  const adminPanel = createLazyAdminPanelController({
    root,
    toast,
    createOptions: () => ({
      root,
      getState: () => state,
      isAdminUnlocked: runtime.isAdminUnlocked,
      getAccessRole: () => runtime.accessRole,
      getAccessPolicy: runtime.getAccessPolicy,
      canWrite: runtime.isWriteAllowed,
      can: capability => runtime.can(capability),
      loginAdmin: runtime.connectAdminSession,
      loginDirector: runtime.connectDirectorSession,
      loginUser: runtime.connectUserSession,
      logout: runtime.logoutAdmin,
      openForm,
      setView,
      exportState,
      requestImport: () => fileInputs?.requestImport(),
      refreshSyncStatus: () => publishCenter.refresh(),
      financePrivacy,
      auditLog,
      recoveryCenter,
      accessManagement,
      toast
    })
  });
  const birthdays = createBirthdaysController();
  const birthdayActions = createBirthdayActions(rowActions);
  const shareBirthdayArtwork = createLazyBirthdayArtworkShare({
    getBirthdays: () => state.birthdays,
    toast,
    modalController
  });
  const settingsPanel = createLazySettingsController({
    root,
    getState: () => state,
    isAdminUnlocked: runtime.isAdminUnlocked,
    canWrite: () => runtime.can(ACCESS_CAPABILITIES.MANAGE_SETTINGS),
    getAccessRole: () => runtime.accessRole,
    empty,
    parseCurrencyInput,
    currencyInputValue,
    persist: runtime.persist,
    requestLogoUpload: () => fileInputs?.requestImage('logo'),
    updateAccessUI,
    configureDirectorProfile: runtime.configureDirectorProfile,
    removeDirectorProfile: runtime.removeDirectorProfile,
    confirmation,
    toast,
    captureInterfaceContext: interfaceContext.capture,
    restoreInterfaceContext: interfaceContext.restore,
    isCurrentView: () => navigation?.currentView === 'settings'
  });
  const {
    apply: applySettings,
    applyLogo: applySettingsLogo,
    render: renderSettings
  } = settingsPanel;
  fileInputs = createFileInputsController({
    importInput,
    imageInput,
    confirmation,
    parseImportFile,
    fileToDataUrl,
    onImport: (importedState, file) => runtime.importState(importedState, file),
    onImage: (target, dataUrl) => {
      if (target === 'logo') return applySettingsLogo(dataUrl);
      if (target === 'birthday') return applyBirthdayPhoto(dataUrl);
      throw new Error(`Destino de imagem não reconhecido: ${target}`);
    },
    toast
  });
  navigation = createNavigationController({
    pageTitle,
    pageDescription,
    modeChip,
    sidebar,
    overlay,
    isAdminUnlocked: runtime.isAdminUnlocked,
    getAccessRole: () => runtime.accessRole,
    getAccessPolicy: runtime.getAccessPolicy,
    renderView: render,
    destroyViewResources: () => treasuryFeature.clearCharts(),
    preloadView: view => {
      if (view === 'admin') return adminPanel.load();
      if (view === 'settings') return settingsPanel.load();
      return viewRenderer?.preload(view);
    },
    refreshGlobalControls: () => publishCenter.refresh(),
    ensureAdmin,
    openForm,
    setTreasurySection,
    logoutAdmin: runtime.logoutAdmin,
    captureInterfaceContext: interfaceContext.capture,
    restoreInterfaceContext: interfaceContext.restore
  });
  const uiShell = createUiShellController({
    toastRegion,
    clock,
    currentDate,
    fullDateFormat,
    confirmAccept,
    confirmSecondary,
    confirmModal,
    confirmation,
    closeModal,
    closeSidebar,
    shareBirthday: shareBirthdayArtwork
  });
  readOnlyGuard = createReadOnlyGuard({
    getAccessPolicy: runtime.getAccessPolicy,
    toast
  });

  const portalRefresh = createPortalRefreshController({
    button: portalRefreshButton,
    getPendingChanges: () => runtime.pendingChanges,
    refreshPortal: runtime.refreshPortalInterface,
    requestPendingDecision: ({ count, message }) => confirmation.askChoice({
      title: count === 1 ? 'Existe uma alteração pendente' : `Existem ${count} alterações pendentes`,
      message,
      icon: '☁️',
      primaryText: 'Publicar alterações',
      primaryTone: 'primary',
      secondaryText: 'Descartar alterações',
      secondaryTone: 'danger-soft',
      cancelText: 'Cancelar atualização',
      tone: 'warning'
    }),
    publishPendingChanges: runtime.commitPendingChanges,
    discardPendingChanges: runtime.discardPendingChanges,
    toast
  });

  function setView(view) { navigation.setView(view); }
  function updateAccessUI() { navigation.updateAccessUI(); }
  function closeSidebar() { navigation.closeSidebar(); }
  function toast(message) { uiShell.toast(message); }

  function resetInterfaceState() {
    modalController.close({ restoreFocus: false });
    confirmation.closeConfirmModal(false);
    navigation.closeSidebar();
    publishCenter.close({ focus: false });
    treasuryFeature.clearCharts();
    treasuryFeature.reset();
    birthdays.reset();
    agenda.reset();
    navigation.setView('dashboard');

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.getElementById('mainContent')?.focus({ preventScroll: true });
    });
  }

  function setTreasurySection(section){
    const activeSection = treasuryFeature.setSection(section);
    document.querySelectorAll('[data-treasury-section]').forEach(item => {
      const active = item.dataset.treasurySection === activeSection;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    if(navigation.currentView!=='treasury')setView('treasury'); else renderTreasuryView();
  }

  function render(view) {
    return viewRenderer?.render(view);
  }

  function renderTreasuryView() {
    return viewRenderer?.renderTreasury();
  }
  const agenda = createAgendaController();
  function getAppointments() {
    return buildAppointments(state);
  }

  function renderAdmin() {
    return adminPanel.render();
  }

  function closeModal() { modalController.close(); }

  viewRenderer = createPortalViewRenderer({
    getState: () => state,
    getRuntime: () => runtime,
    getNavigation: () => navigation,
    root,
    loadTreasuryController: treasuryFeature.load,
    birthdays,
    agenda,
    renderAdmin,
    renderSettings,
    dashboardDependencies: {
      kpi,
      avatar,
      empty,
      financePrivacy,
      setTreasurySection,
      setView
    },
    birthdayDependencies: {
      normalize,
      memberIsActive,
      parseLocalDate,
      nextBirthdayDate,
      daysUntil,
      birthdayMatchesPeriod,
      birthdayRows,
      birthdayCards,
      birthdayStatus,
      birthdayDisplayDate,
      avatar,
      escapeHtml,
      birthdayActions,
      empty,
      bindRowActions,
      ensureAdmin,
      openForm
    },
    agendaDependencies: {
      getAppointments,
      todayStart,
      toInputDate,
      parseLocalDate,
      locationInfo,
      pageToolbar,
      bindToolbar,
      timelineHeading,
      compareAppointments,
      appointmentTypeBadge,
      escapeHtml,
      formatDate,
      statusBadge,
      renderLocation,
      markdownToHtml,
      rowActions,
      empty,
      bindRowActions,
      normalize,
      modalController,
      appointmentLocationText,
      downloadAppointmentCalendar,
      closeModal,
      openForm
    },
    noticeDependencies: {
      pageToolbar,
      bindToolbar,
      priorityBadge,
      rowActions,
      empty,
      bindRowActions
    },
    leaderDependencies: {
      empty
    },
    treasuryDependencies: {
      financePrivacy,
      kpi,
      avatar,
      empty,
      pageToolbar,
      bindToolbar,
      rowActions,
      bindRowActions,
      ensureAdmin,
      openForm,
      toast,
      openTreasuryAccountsManager,
      openFamilyGroupsManager,
      openMembershipPayment,
      openMutualGroupsManager,
      openMutualEventManager,
      openMutualPayment,
      shareMembershipCharge
    }
  });
  recoveryCenter.initialize()
    .catch(error => console.error('Falha ao iniciar a recuperação local:', error));
  return runtime.bootstrap();
}
