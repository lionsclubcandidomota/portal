import { createDialogFocusManager } from './dialog-focus.js?v=6.46.5';

export function createModalController({
  modal,
  modalBody,
  modalTitle,
  onClose
}) {
  if (!modal) throw new TypeError('createModalController requer modal.');
  if (!modalBody) throw new TypeError('createModalController requer modalBody.');
  if (!modalTitle) throw new TypeError('createModalController requer modalTitle.');

  const focusManager = createDialogFocusManager({
    dialog: modal,
    initialFocusSelector: '[autofocus], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([data-close-modal]):not([disabled])'
  });

  const resetScrollPosition = () => {
    const modalCard = modal.querySelector('.modal-card');
    modal.scrollTop = 0;
    modalBody.scrollTop = 0;
    if (modalCard) modalCard.scrollTop = 0;
  };

  const scheduleScrollReset = () => {
    resetScrollPosition();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(resetScrollPosition);
    }
  };

  const open = (title, content) => {
    modalTitle.textContent = String(title || '');
    if (content !== undefined) modalBody.innerHTML = String(content ?? '');

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    scheduleScrollReset();
    focusManager.activate();
    scheduleScrollReset();
    return modalBody;
  };

  const setContent = content => {
    modalBody.innerHTML = String(content ?? '');
    scheduleScrollReset();
    return modalBody;
  };

  const close = ({ restoreFocus = true } = {}) => {
    const wasOpen = !modal.hidden;
    modal.hidden = true;
    document.body.style.overflow = '';
    onClose?.();

    if (wasOpen) focusManager.deactivate({ restoreFocus });
  };

  return {
    body: modalBody,
    close,
    element: modal,
    isOpen: () => !modal.hidden,
    open,
    setContent,
    title: modalTitle
  };
}
