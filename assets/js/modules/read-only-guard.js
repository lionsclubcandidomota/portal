const WRITE_CONTROL_SELECTOR = [
  '[data-new]',
  '[data-edit]',
  '[data-delete]',
  '[data-detail-edit]',
  '[data-add]',
  '#manageTreasuryAccounts',
  '#manageFamilyGroups',
  '#manageMutualGroups',
  '#registerMutualEvent',
  '#mutualPaymentButton',
  '.mutual-charge-checkbox',
  '[data-membership-member]',
  '#importBtn',
  '#openRecoveryCenterBtn',
  '#logoUpload',
  '#logoReset',
  '#publishCenterSend',
  '#publishCenterDiscard'
].join(',');

const WRITE_FORM_SELECTOR = [
  '#entityForm',
  '#treasuryEntryForm',
  '#membershipPaymentForm',
  '#mutualPaymentForm',
  '#mutualEventForm',
  '#settingsForm',
  '#directorAccessForm'
].join(',');

export function createReadOnlyGuard({
  documentRef = document,
  getAccessPolicy = () => ({ authenticated: false, readOnly: false }),
  toast = () => {}
}) {
  let bound = false;
  let lastNoticeAt = 0;

  const notify = () => {
    const now = Date.now();
    if (now - lastNoticeAt < 900) return;
    lastNoticeAt = now;
    toast('O perfil Diretoria possui acesso somente leitura.');
  };

  const blockEvent = event => {
    const access = getAccessPolicy?.();
    if (!access?.authenticated || !access.readOnly) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(WRITE_CONTROL_SELECTOR)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    notify();
  };

  const blockSubmit = event => {
    const access = getAccessPolicy?.();
    if (!access?.authenticated || !access.readOnly) return;
    const form = event.target instanceof Element ? event.target.closest(WRITE_FORM_SELECTOR) : null;
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    notify();
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    documentRef.addEventListener('click', blockEvent, true);
    documentRef.addEventListener('change', blockEvent, true);
    documentRef.addEventListener('submit', blockSubmit, true);
  };

  return { bind };
}
