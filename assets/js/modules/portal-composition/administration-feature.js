import { exportState } from '../../storage.js';
import { createEntityFormsController } from '../entity-forms.js?v=6.36.0';
import { createAdminPanelController } from '../admin-panel.js?v=6.36.0';
import { createReportsController } from '../reports/controller.js?v=6.36.0';
import { createSettingsController } from '../settings.js';
import { createBirthdaysController, createBirthdayActions } from '../birthdays.js';
import { createBirthdayArtworkController } from '../birthday-artwork.js';

export function createAdministrationFeature({
  getState,
  root,
  runtime,
  treasury,
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
  renderCurrentView,
  closeModal,
  updateAccessUI,
  getFileInputs,
  getPublishCenter
}) {
  const entityForms = createEntityFormsController({
    getState,
    treasury,
    root,
    modalController,
    confirmation,
    persist: runtime.persist,
    renderCurrentView,
    closeModal,
    toast,
    isAdminUnlocked: runtime.isWriteAllowed,
    setView,
    openTreasuryEntryForm: treasuryAdministration.openTreasuryEntryForm,
    selectImage: target => getFileInputs()?.requestImage(target)
  });

  const reports = createReportsController({ getState, toast });
  const adminPanel = createAdminPanelController({
    root,
    getState,
    isAdminUnlocked: runtime.isAdminUnlocked,
    getAccessRole: () => runtime.accessRole,
    canWrite: runtime.isWriteAllowed,
    loginAdmin: runtime.connectAdminSession,
    loginDirector: runtime.connectDirectorSession,
    logout: runtime.logoutAdmin,
    openForm: entityForms.openForm,
    setView,
    exportState,
    requestImport: () => getFileInputs()?.requestImport(),
    refreshSyncStatus: () => getPublishCenter()?.refresh(),
    financePrivacy,
    auditLog,
    recoveryCenter,
    reports,
    toast
  });

  const birthdays = createBirthdaysController();
  const birthdayActions = createBirthdayActions(entityForms.rowActions);
  const birthdayArtwork = createBirthdayArtworkController({
    getBirthdays: () => getState().birthdays,
    toast
  });

  const settingsPanel = createSettingsController({
    root,
    getState,
    isAdminUnlocked: runtime.isAdminUnlocked,
    canWrite: runtime.isWriteAllowed,
    getAccessRole: () => runtime.accessRole,
    empty,
    parseCurrencyInput: treasury.parseCurrencyInput,
    currencyInputValue: treasury.currencyInputValue,
    persist: runtime.persist,
    requestLogoUpload: () => getFileInputs()?.requestImage('logo'),
    updateAccessUI,
    configureDirectorProfile: runtime.configureDirectorProfile,
    removeDirectorProfile: runtime.removeDirectorProfile,
    confirmation,
    toast
  });

  return {
    entityForms,
    adminPanel,
    birthdays,
    birthdayActions,
    birthdayArtwork,
    applySettings: settingsPanel.apply,
    applySettingsLogo: settingsPanel.applyLogo,
    renderSettings: settingsPanel.render,
    renderAdmin: () => adminPanel.render()
  };
}
