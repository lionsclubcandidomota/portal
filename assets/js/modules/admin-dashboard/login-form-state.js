export const LOGIN_MODES = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
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
  userForm = null,
  directorForm,
  adminInput,
  userInput = null,
  userPassword = null,
  directorInput,
  adminToggle,
  userToggle = null,
  directorToggle,
  tabs,
  scheduleFocus = callback => requestAnimationFrame(callback)
}) {
  let activeMode = LOGIN_MODES.ADMIN;
  const forms = {
    [LOGIN_MODES.ADMIN]: adminForm,
    [LOGIN_MODES.USER]: userForm,
    [LOGIN_MODES.DIRECTOR]: directorForm
  };
  const primaryInputs = {
    [LOGIN_MODES.ADMIN]: adminInput,
    [LOGIN_MODES.USER]: userInput,
    [LOGIN_MODES.DIRECTOR]: directorInput
  };
  const secretInputs = {
    [LOGIN_MODES.ADMIN]: adminInput,
    [LOGIN_MODES.USER]: userPassword,
    [LOGIN_MODES.DIRECTOR]: directorInput
  };
  const toggles = {
    [LOGIN_MODES.ADMIN]: adminToggle,
    [LOGIN_MODES.USER]: userToggle,
    [LOGIN_MODES.DIRECTOR]: directorToggle
  };

  const activate = requestedMode => {
    const supported = Object.values(LOGIN_MODES).includes(requestedMode) && forms[requestedMode];
    activeMode = supported ? requestedMode : LOGIN_MODES.ADMIN;

    Object.entries(forms).forEach(([mode, form]) => {
      if (!form) return;
      const active = mode === activeMode;
      form.hidden = !active;
      [...form.querySelectorAll?.('input, button, select, textarea') || []].forEach(control => {
        if (control.dataset?.loginTabControl === 'true') return;
        control.disabled = !active;
      });
    });

    // Mantém compatibilidade com os elementos simples usados pelos testes.
    if (adminInput) adminInput.disabled = activeMode !== LOGIN_MODES.ADMIN;
    if (adminToggle) adminToggle.disabled = activeMode !== LOGIN_MODES.ADMIN;
    if (directorInput) directorInput.disabled = activeMode !== LOGIN_MODES.DIRECTOR;
    if (directorToggle) directorToggle.disabled = activeMode !== LOGIN_MODES.DIRECTOR;
    if (userInput) userInput.disabled = activeMode !== LOGIN_MODES.USER;
    if (userPassword) userPassword.disabled = activeMode !== LOGIN_MODES.USER;
    if (userToggle) userToggle.disabled = activeMode !== LOGIN_MODES.USER;

    if (activeMode === LOGIN_MODES.DIRECTOR) resetSecretField(directorInput, directorToggle, 'senha');
    if (activeMode === LOGIN_MODES.USER) resetSecretField(userPassword, userToggle, 'senha');

    tabs.forEach(tab => {
      const active = tab.dataset.loginMode === activeMode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    scheduleFocus(() => {
      const input = primaryInputs[activeMode] || secretInputs[activeMode];
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
