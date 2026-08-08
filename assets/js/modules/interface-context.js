function cssEscape(value, windowRef) {
  const text = String(value || '');
  const escape = windowRef?.CSS?.escape;
  if (typeof escape === 'function') return escape(text);
  return text.replace(/(["'\\.#:[\]()=+~*>\s])/g, '\\$1');
}

function focusSelectorFor(element, windowRef) {
  if (!element || element === element.ownerDocument?.body) return '';
  if (element.id) return `#${cssEscape(element.id, windowRef)}`;
  const name = element.getAttribute?.('name');
  if (name) return `[name="${cssEscape(name, windowRef)}"]`;
  const action = element.getAttribute?.('data-action');
  if (action) return `[data-action="${cssEscape(action, windowRef)}"]`;
  return '';
}

function clampScroll(value, maximum) {
  return Math.max(0, Math.min(Number(value || 0), Math.max(0, Number(maximum || 0))));
}

export function createInterfaceContextController({
  getCurrentView = () => 'dashboard',
  getTreasurySection = () => '',
  windowRef = window,
  documentRef = document
} = {}) {
  let restoreToken = 0;

  const capture = () => {
    const activeElement = documentRef.activeElement;
    const selection = activeElement && typeof activeElement.selectionStart === 'number'
      ? { start: activeElement.selectionStart, end: activeElement.selectionEnd }
      : null;

    return Object.freeze({
      view: String(getCurrentView?.() || 'dashboard'),
      treasurySection: String(getTreasurySection?.() || ''),
      scrollX: Number(windowRef.scrollX || 0),
      scrollY: Number(windowRef.scrollY || 0),
      focusSelector: focusSelectorFor(activeElement, windowRef),
      selection
    });
  };

  const restore = (snapshot, { restoreFocus = false } = {}) => {
    if (!snapshot) return;
    const token = ++restoreToken;
    const schedule = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));

    schedule(() => schedule(() => {
      if (token !== restoreToken) return;
      const maximumX = Math.max(0, (documentRef.documentElement?.scrollWidth || 0) - (windowRef.innerWidth || 0));
      const maximumY = Math.max(0, (documentRef.documentElement?.scrollHeight || 0) - (windowRef.innerHeight || 0));
      const previousBehavior = documentRef.documentElement?.style?.scrollBehavior;
      if (documentRef.documentElement?.style) documentRef.documentElement.style.scrollBehavior = 'auto';
      windowRef.scrollTo?.({
        left: clampScroll(snapshot.scrollX, maximumX),
        top: clampScroll(snapshot.scrollY, maximumY),
        behavior: 'auto'
      });
      if (documentRef.documentElement?.style) documentRef.documentElement.style.scrollBehavior = previousBehavior || '';

      if (!restoreFocus || !snapshot.focusSelector) return;
      const target = documentRef.querySelector?.(snapshot.focusSelector);
      if (!target || target.disabled || target.hidden) return;
      target.focus?.({ preventScroll: true });
      if (snapshot.selection && typeof target.setSelectionRange === 'function') {
        target.setSelectionRange(snapshot.selection.start, snapshot.selection.end);
      }
    }));
  };

  const renderPreserving = (render, options = {}) => {
    if (typeof render !== 'function') return undefined;
    const snapshot = capture();
    const result = render();
    if (result && typeof result.then === 'function') {
      return result.finally(() => restore(snapshot, options));
    }
    restore(snapshot, options);
    return result;
  };

  return Object.freeze({ capture, restore, renderPreserving });
}
