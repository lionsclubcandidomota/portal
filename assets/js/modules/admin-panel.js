import { ADMIN_PERIOD_STORAGE, createAdminDashboardModel } from './admin-dashboard/domain.js?v=6.36.1';
import { adminDashboardHtml } from './admin-dashboard/view.js?v=6.36.1';
import { bindAdminLogin } from './admin-dashboard/login-controller.js?v=6.36.1';
export function createAdminPanelController({
  root,
  getState,
  isAdminUnlocked,
  getAccessRole = () => 'visitor',
  canWrite = () => false,
  loginAdmin,
  loginDirector,
  logout,
  openForm,
  setView,
  exportState,
  requestImport,
  refreshSyncStatus,
  financePrivacy,
  auditLog,
  recoveryCenter,
  reports,
  toast
}) {
  if (!root) throw new TypeError('createAdminPanelController requer root.');
  if (typeof getState !== 'function') {
    throw new TypeError('createAdminPanelController requer getState().');
  }
  if (typeof isAdminUnlocked !== 'function') {
    throw new TypeError('createAdminPanelController requer isAdminUnlocked().');
  }
  let periodPreset = sessionStorage.getItem(ADMIN_PERIOD_STORAGE.preset) || 'current-month';
  let customStart = sessionStorage.getItem(ADMIN_PERIOD_STORAGE.start) || '';
  let customEnd = sessionStorage.getItem(ADMIN_PERIOD_STORAGE.end) || '';
  const storePeriod = () => {
    sessionStorage.setItem(ADMIN_PERIOD_STORAGE.preset, periodPreset);
    sessionStorage.setItem(ADMIN_PERIOD_STORAGE.start, customStart);
    sessionStorage.setItem(ADMIN_PERIOD_STORAGE.end, customEnd);
  };
  const renderLogin = () => bindAdminLogin({
    root,
    loginAdmin,
    loginDirector,
    onSuccess: () => render(),
    toast
  });
  const renderPanel = () => {
    const state = getState();
    const model = createAdminDashboardModel(state, {
      periodPreset,
      customStart,
      customEnd
    });
    const writeAllowed = canWrite();
    const accessRole = getAccessRole();
    root.innerHTML = adminDashboardHtml(model, {
      financePrivacyButton: financePrivacy.buttonHtml({ compact: true }),
      canWrite: writeAllowed,
      accessRole,
      auditSummary: auditLog?.getSummary?.(),
      recoverySummary: recoveryCenter?.getSummary?.()
    });
    refreshSyncStatus();
    financePrivacy.bind(root);
    root.querySelector('#logoutInlineBtn')?.addEventListener('click', logout);
    const periodSelect = root.querySelector('#adminPeriodPreset');
    periodSelect?.addEventListener('change', () => {
      periodPreset = periodSelect.value;
      storePeriod();
      renderPanel();
    });
    const periodStartInput = root.querySelector('#adminPeriodStart');
    const periodEndInput = root.querySelector('#adminPeriodEnd');
    const periodApplyButton = root.querySelector('#adminPeriodApply');
    const clearCustomPeriodValidity = () => {
      periodStartInput?.setCustomValidity('');
      periodEndInput?.setCustomValidity('');
    };
    const applyCustomPeriod = () => {
      const nextCustomStart = periodStartInput?.value || '';
      const nextCustomEnd = periodEndInput?.value || '';
      clearCustomPeriodValidity();
      if (nextCustomStart && nextCustomEnd && nextCustomEnd < nextCustomStart) {
        const message = 'A data final deve ser igual ou posterior à data inicial.';
        periodEndInput?.setCustomValidity(message);
        periodEndInput?.reportValidity();
        periodEndInput?.focus();
        toast(message);
        return;
      }
      customStart = nextCustomStart;
      customEnd = nextCustomEnd;
      storePeriod();
      renderPanel();
    };
    periodStartInput?.addEventListener('input', clearCustomPeriodValidity);
    periodEndInput?.addEventListener('input', clearCustomPeriodValidity);
    periodApplyButton?.addEventListener('click', applyCustomPeriod);
    [periodStartInput, periodEndInput].forEach(input => {
      input?.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        applyCustomPeriod();
      });
    });
    if (writeAllowed) {
      root.querySelectorAll('[data-add]').forEach(button => {
        button.addEventListener('click', () => openForm(button.dataset.add));
      });
    }
    root.querySelectorAll('[data-manage]').forEach(button => {
      button.addEventListener('click', () => setView(button.dataset.manage));
    });
    root.querySelector('#exportBtn')?.addEventListener('click', () => exportState(state));
    if (writeAllowed) root.querySelector('#importBtn')?.addEventListener('click', requestImport);
    root.querySelector('#openAuditLogBtn')?.addEventListener('click', () => auditLog?.open?.());
    if (writeAllowed) root.querySelector('#openRecoveryCenterBtn')?.addEventListener('click', () => recoveryCenter?.open?.());
    reports?.bindDashboard?.(root, {
      bounds: model.bounds,
      periodPreset: model.periodPreset,
      periodText: model.selectedPeriodLabel
    });
  };
  const render = () => {
    if (!isAdminUnlocked()) renderLogin();
    else renderPanel();
  };
  return { render };
}
