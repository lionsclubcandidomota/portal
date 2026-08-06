import { createDialogFocusManager } from './dialog-focus.js?v=6.36.1';

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

  const open = (title, content) => {
    modalTitle.textContent = String(title || '');
    if (content !== undefined) modalBody.innerHTML = String(content ?? '');

    const scrollContainer = modal.querySelector('.modal-card');
    if (scrollContainer) scrollContainer.scrollTop = 0;
    modalBody.scrollTop = 0;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      if (scrollContainer) scrollContainer.scrollTop = 0;
      modalBody.scrollTop = 0;
    });
    focusManager.activate();
    return modalBody;
  };

  const setContent = content => {
    modalBody.innerHTML = String(content ?? '');
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
