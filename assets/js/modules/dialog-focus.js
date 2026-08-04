const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function isFocusable(element) {
  if (!element || typeof element.focus !== 'function') return false;
  if (element.hidden || element.getAttribute?.('aria-hidden') === 'true') return false;
  if (element.getAttribute?.('tabindex') === '-1') return false;
  if (element.disabled) return false;
  return true;
}

export function getFocusableElements(container) {
  if (!container?.querySelectorAll) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isFocusable);
}

export function createDialogFocusManager({
  dialog,
  initialFocusSelector = '[autofocus]'
}) {
  if (!dialog) throw new TypeError('createDialogFocusManager requer dialog.');

  let active = false;
  let previousFocus = null;

  const focusInitialElement = preferredElement => {
    const focusable = getFocusableElements(dialog);
    const preferred = preferredElement
      || dialog.querySelector?.(initialFocusSelector)
      || focusable[0]
      || dialog;

    if (isFocusable(preferred) || preferred === dialog) preferred.focus?.();
  };

  const handleKeydown = event => {
    if (!active || event.key !== 'Tab') return;

    const focusable = getFocusableElements(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus?.();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = dialog.ownerDocument?.activeElement || globalThis.document?.activeElement;

    if (event.shiftKey && (current === first || !dialog.contains?.(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !dialog.contains?.(current))) {
      event.preventDefault();
      first.focus();
    }
  };

  const activate = preferredElement => {
    const documentRef = dialog.ownerDocument || globalThis.document;
    const activeElement = documentRef?.activeElement;
    if (!dialog.contains?.(activeElement)) previousFocus = activeElement || null;
    active = true;
    focusInitialElement(preferredElement);
  };

  const deactivate = ({ restoreFocus = true } = {}) => {
    const focusTarget = previousFocus;
    active = false;
    previousFocus = null;

    if (restoreFocus && focusTarget?.isConnected !== false) {
      focusTarget?.focus?.();
    }
  };

  dialog.addEventListener?.('keydown', handleKeydown);

  return {
    activate,
    deactivate,
    destroy() {
      active = false;
      previousFocus = null;
      dialog.removeEventListener?.('keydown', handleKeydown);
    },
    handleKeydown,
    isActive: () => active
  };
}
