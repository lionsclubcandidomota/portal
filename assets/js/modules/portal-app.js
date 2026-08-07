import { loadState, parseImportFile } from '../storage.js';
import {
  fullDateFormat,
  parseLocalDate,
  formatDate,
  nextBirthdayDate,
  daysUntil,
  escapeHtml,
  normalize,
  fileToDataUrl,
  sumTreasury,
  toInputDate
} from '../utils.js';
import { createFinancePrivacyController } from './finance-privacy.js';
import { createModalController } from './modal.js';
import { createFileInputsController } from './file-inputs.js';
import { createAuditLogController } from './audit-log.js?v=6.37.0';
import { createRecoveryCenterController } from './recovery-center.js?v=6.37.0';
import { markdownToHtml } from './markdown.js';
import { createConfirmationController } from './confirmation.js';
import { todayStart, timelineHeading } from './timeline.js';
import {
  birthdayDisplayDate,
  birthdayStatus,
  birthdayMatchesPeriod,
  birthdayRows,
  birthdayCards
} from './birthdays.js';
import { avatar, empty, kpi, priorityBadge, statusBadge } from './visual-helpers.js';
import { createAgendaController } from './agenda.js';
import {
  appointmentLocationText,
  appointmentTypeBadge,
  compareAppointments,
  downloadAppointmentCalendar,
  getAppointments,
  locationInfo,
  renderLocation
} from './appointments.js?v=6.37.0';
import { createPortalRuntimeController } from './portal-runtime.js?v=6.37.0';
import { getPortalElements } from './portal-elements.js?v=6.37.0';
import { createPortalViewRenderer } from './portal-view-renderer.js?v=6.37.0';
import { createTreasuryFeature } from './portal-composition/treasury-feature.js?v=6.37.0';
import { createAdministrationFeature } from './portal-composition/administration-feature.js?v=6.37.0';
import { createPublicationFeature } from './portal-composition/publication-feature.js?v=6.37.0';
import { createNavigationFeature } from './portal-composition/navigation-feature.js?v=6.37.0';
import { createPortalViewRendererOptions } from './portal-composition/view-dependencies.js?v=6.37.0';

export function bootstrapPortal() {
  let state = loadState();
  let runtime = null;
  let fileInputs = null;
  let administration = null;
  let publicationFeature = null;
  let navigationFeature = null;
  let viewRenderer = null;

  const elements = getPortalElements();
  const confirmation = createConfirmationController({
    confirmModal: elements.confirmModal,
    confirmTitle: elements.confirmTitle,
    confirmMessage: elements.confirmMessage,
    confirmIcon: elements.confirmIcon,
    confirmAccept: elements.confirmAccept,
    confirmSecondary: elements.confirmSecondary,
    confirmCancel: elements.confirmCancel
  });
  const modalController = createModalController({
    modal: elements.modal,
    modalBody: elements.modalBody,
    modalTitle: elements.modalTitle,
    onClose: () => fileInputs?.clearImageTarget()
  });
  const financePrivacy = createFinancePrivacyController();
  const treasuryFeature = createTreasuryFeature({
    getState: () => state,
    parseLocalDate,
    normalize,
    todayStart,
    sumTreasury
  });
  const auditLog = createAuditLogController({
    storage: localStorage,
    modalController,
    toast
  });
  const recoveryCenter = createRecoveryCenterController({
    getState: () => state,
    modalController,
    confirmation,
    toast,
    onRestore: (nextState, details) => runtime.restoreState(nextState, details),
    remoteRecovery: {
      isAvailable: () => Boolean(runtime?.hasActiveSecureStorageSession?.(state)),
      canWrite: () => Boolean(runtime?.isWriteAllowed?.()),
      status: () => runtime.getPrivateStorageStatus(state),
      listBackups: () => runtime.listPrivateStateBackups(state),
      createBackup: label => runtime.createPrivateStateBackup(state, label),
      diagnose: () => runtime.diagnosePrivateStorageIntegrity(state),
      restoreBackup: key => runtime.restorePrivateStateBackup(state, key),
      migrateToD1: () => runtime.migratePrivateStorageToD1(state),
      rollbackToR2: () => runtime.rollbackPrivateStorageToR2(state),
      applyRestoredState: (payload, details) => runtime.applyRemotePrivateState(payload, details)
    },
    onSummaryChange: () => {
      if (navigationFeature?.navigation.currentView === 'admin' && runtime?.adminUnlocked) renderAdmin();
    }
  });

  runtime = createPortalRuntimeController({
    getState: () => state,
    setState: nextState => { state = nextState; },
    confirmation,
    applySettings: () => administration?.applySettings(),
    renderCurrentView: () => render(),
    updateClock: () => navigationFeature?.uiShell.updateClock(),
    bindControllers: () => {
      navigationFeature.bind();
      fileInputs.bind();
      publicationFeature.publishCenter.bind();
      publicationFeature.portalRefresh.bind();
    },
    syncFinancePrivacy: () => financePrivacy.sync(),
    openPublishCenter: options => publicationFeature.publishCenter.open(options),
    closePublishCenter: options => publicationFeature.publishCenter.close(options),
    refreshPublishCenter: () => publicationFeature.publishCenter.refresh(),
    setPublishStatus: (status, message) => publicationFeature.publishCenter.setStatus(status, message),
    resetInterfaceState,
    getCurrentView: () => navigationFeature.navigation.currentView,
    renderAdmin,
    updateAccessUI,
    setView,
    toast,
    auditLog,
    recoveryCenter
  });

  publicationFeature = createPublicationFeature({
    elements: elements.publishCenter,
    modalController,
    confirmation,
    runtime,
    refreshButton: elements.portalRefreshButton,
    toast
  });

  const treasuryAdministration = treasuryFeature.createAdministration({
    modalController,
    confirmation,
    persist: runtime.persist,
    renderTreasuryView,
    renderCurrentView: render,
    closeModal,
    toast,
    avatar,
    empty
  });

  administration = createAdministrationFeature({
    getState: () => state,
    root: elements.root,
    runtime,
    treasury: treasuryFeature.treasury,
    treasuryAdministration,
    modalController,
    confirmation,
    financePrivacy,
    auditLog,
    recoveryCenter,
    avatar,
    empty,
    toast,
    setView,
    renderCurrentView: render,
    closeModal,
    updateAccessUI,
    getFileInputs: () => fileInputs,
    getPublishCenter: () => publicationFeature.publishCenter
  });

  fileInputs = createFileInputsController({
    importInput: elements.importInput,
    imageInput: elements.imageInput,
    confirmation,
    parseImportFile,
    fileToDataUrl,
    onImport: (importedState, file) => runtime.importState(importedState, file),
    onImage: (target, dataUrl) => {
      if (target === 'logo') return administration.applySettingsLogo(dataUrl);
      if (target === 'birthday') return administration.entityForms.applyBirthdayPhoto(dataUrl);
      throw new Error(`Destino de imagem não reconhecido: ${target}`);
    },
    toast
  });

  navigationFeature = createNavigationFeature({
    elements,
    runtime,
    renderView: render,
    destroyViewResources: treasuryFeature.destroyCharts,
    refreshGlobalControls: () => publicationFeature.publishCenter.refresh(),
    ensureAdmin: administration.entityForms.ensureAdmin,
    openForm: administration.entityForms.openForm,
    setTreasurySection,
    fullDateFormat,
    confirmation,
    closeModal,
    shareBirthday: administration.birthdayArtwork.share
  });

  const agenda = createAgendaController();
  viewRenderer = createPortalViewRenderer(createPortalViewRendererOptions({
    getState: () => state,
    getRuntime: () => runtime,
    getNavigation: () => navigationFeature.navigation,
    root: elements.root,
    treasuryFeature,
    treasuryAdministration,
    administration,
    agenda,
    renderAdmin,
    renderSettings: () => administration.renderSettings(),
    financePrivacy,
    helpers: {
      avatar,
      empty,
      kpi,
      priorityBadge,
      statusBadge,
      birthdayDisplayDate,
      birthdayStatus,
      birthdayMatchesPeriod,
      birthdayRows,
      birthdayCards
    },
    utilities: {
      normalize,
      parseLocalDate,
      nextBirthdayDate,
      daysUntil,
      escapeHtml,
      todayStart,
      toInputDate,
      timelineHeading,
      formatDate
    },
    appointments: {
      build: getAppointments,
      locationInfo,
      compare: compareAppointments,
      typeBadge: appointmentTypeBadge,
      renderLocation,
      locationText: appointmentLocationText,
      downloadCalendar: downloadAppointmentCalendar
    },
    markdownToHtml,
    modalController,
    closeModal,
    setTreasurySection,
    setView,
    toast
  }));

  recoveryCenter.initialize()
    .catch(error => console.error('Falha ao iniciar a recuperação local:', error));
  return runtime.bootstrap();

  function setView(view) {
    navigationFeature.navigation.setView(view);
  }

  function updateAccessUI() {
    navigationFeature?.navigation.updateAccessUI();
  }

  function closeModal() {
    modalController.close();
  }

  function toast(message) {
    navigationFeature?.toast(message);
  }

  function render(view) {
    return viewRenderer?.render(view);
  }

  function renderTreasuryView() {
    return viewRenderer?.renderTreasury();
  }

  function renderAdmin() {
    administration?.renderAdmin();
  }

  function setTreasurySection(section) {
    treasuryFeature.treasury.section = section;
    document.querySelectorAll('[data-treasury-section]').forEach(item => {
      const active = item.dataset.treasurySection === section;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    if (navigationFeature.navigation.currentView !== 'treasury') setView('treasury');
    else renderTreasuryView();
  }

  function resetInterfaceState() {
    modalController.close({ restoreFocus: false });
    confirmation.closeConfirmModal(false);
    navigationFeature.navigation.closeSidebar();
    publicationFeature.publishCenter.close({ focus: false });
    treasuryFeature.destroyCharts();
    treasuryFeature.treasury.reset();
    administration.birthdays.reset();
    agenda.reset();
    navigationFeature.navigation.setView('dashboard');

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.getElementById('mainContent')?.focus({ preventScroll: true });
    });
  }
}
