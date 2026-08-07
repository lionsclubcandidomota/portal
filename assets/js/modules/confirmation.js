import { createDialogFocusManager } from './dialog-focus.js?v=6.46.0';

function buttonClass(tone, fallback = 'btn-danger') {
  if (tone === 'primary') return 'btn-primary';
  if (tone === 'warning') return 'btn-warning';
  if (tone === 'danger-soft') return 'btn-danger-soft';
  if (tone === 'ghost') return 'btn-ghost';
  return fallback;
}

export function createConfirmationController({
  confirmModal,
  confirmTitle,
  confirmMessage,
  confirmIcon,
  confirmAccept,
  confirmSecondary,
  confirmCancel
}) {
  let confirmResolver = null;
  const focusManager = confirmModal
    ? createDialogFocusManager({
        dialog: confirmModal,
        initialFocusSelector: '#confirmAccept'
      })
    : null;

  function normalizeResult(result) {
    if (result === true) return 'primary';
    if (result === false || result == null) return 'cancel';
    return String(result);
  }

  function closeConfirmModal(result = 'cancel') {
    if (!confirmModal || confirmModal.hidden) return;

    confirmModal.hidden = true;
    document.body.classList.remove('confirmation-open');
    focusManager?.deactivate();

    const resolver = confirmResolver;
    confirmResolver = null;
    resolver?.(normalizeResult(result));
  }

  function openChoice({
    title = 'Confirmar ação',
    message = '',
    icon = '⚠️',
    primaryText = 'Confirmar',
    primaryTone = 'danger',
    secondaryText = '',
    secondaryTone = 'danger-soft',
    cancelText = 'Cancelar',
    tone = primaryTone
  } = {}) {
    if (!confirmModal) return Promise.resolve('cancel');
    if (confirmResolver) closeConfirmModal('cancel');

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmIcon.textContent = icon;
    confirmAccept.textContent = primaryText;
    confirmAccept.className = `btn ${buttonClass(primaryTone)}`;

    if (confirmSecondary) {
      confirmSecondary.hidden = !secondaryText;
      confirmSecondary.textContent = secondaryText || 'Opção secundária';
      confirmSecondary.className = `btn ${buttonClass(secondaryTone, 'btn-danger-soft')}`;
    }
    if (confirmCancel) confirmCancel.textContent = cancelText;

    confirmModal.dataset.tone = tone;
    confirmModal.classList.toggle('has-secondary-action', Boolean(secondaryText));
    confirmModal.hidden = false;
    document.body.classList.add('confirmation-open');
    focusManager?.activate(confirmAccept);

    return new Promise(resolve => {
      confirmResolver = resolve;
    });
  }

  async function askConfirmation({
    title = 'Confirmar ação',
    message = '',
    icon = '⚠️',
    confirmText = 'Confirmar',
    tone = 'danger'
  } = {}) {
    const result = await openChoice({
      title,
      message,
      icon,
      primaryText: confirmText,
      primaryTone: tone,
      tone
    });
    return result === 'primary';
  }

  const askChoice = options => openChoice(options);

  return {
    askChoice,
    askConfirmation,
    closeConfirmModal
  };
}
