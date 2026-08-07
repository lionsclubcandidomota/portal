export const LOGIN_MODES = Object.freeze({
  ADMIN: 'admin',
  DIRECTOR: 'director'
});

export function resetSecretField(input, toggle, label) {
  if (!input || !toggle) return;
  input.value = '';
  input.type = 'password';
  toggle.textContent = 'Mostrar';
  toggle.setAttribute('aria-label', `Mostrar ${label}`);
  toggle.setAttribute('aria-pressed', 'false');
}

export function bindSecretVisibility(input, button, credentialLabel) {
  button?.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.textContent = showing ? 'Mostrar' : 'Ocultar';
    button.setAttribute('aria-label', `${showing ? 'Mostrar' : 'Ocultar'} ${credentialLabel}`);
    button.setAttribute('aria-pressed', String(!showing));
    input.focus();
  });
}

export function createLoginFormState({
  adminForm,
  directorForm,
  adminInput,
  directorInput,
  adminToggle,
  directorToggle,
  tabs,
  scheduleFocus = callback => requestAnimationFrame(callback)
}) {
  let activeMode = LOGIN_MODES.ADMIN;

  const activate = requestedMode => {
    activeMode = requestedMode === LOGIN_MODES.DIRECTOR
      ? LOGIN_MODES.DIRECTOR
      : LOGIN_MODES.ADMIN;
    const directorMode = activeMode === LOGIN_MODES.DIRECTOR;

    adminForm.hidden = directorMode;
    directorForm.hidden = !directorMode;
    adminInput.disabled = directorMode;
    adminToggle.disabled = directorMode;
    directorInput.disabled = !directorMode;
    directorToggle.disabled = !directorMode;

    if (directorMode) resetSecretField(directorInput, directorToggle, 'senha');

    tabs.forEach(tab => {
      const active = tab.dataset.loginMode === activeMode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    scheduleFocus(() => {
      const input = directorMode ? directorInput : adminInput;
      if (input?.isConnected) input.focus({ preventScroll: true });
    });
  };

  return {
    activate,
    get activeMode() {
      return activeMode;
    }
  };
}
