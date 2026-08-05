import { adminLoginHtml } from './view.js?v=6.35.0';
import {
  bindSecretVisibility,
  createLoginFormState,
  resetSecretField
} from './login-form-state.js?v=6.35.0';

function bindProfileTabs(tabs, loginState) {
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => loginState.activate(tab.dataset.loginMode));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      loginState.activate(next.dataset.loginMode);
      next.focus();
    });
  });
}

function setSubmitting(button, label) {
  button.disabled = true;
  button.textContent = label;
}

function restoreSubmit(button, label) {
  button.disabled = false;
  button.textContent = label;
}

export function bindAdminLogin({ root, loginAdmin, loginDirector, onSuccess, toast }) {
  root.innerHTML = adminLoginHtml();
  const adminForm = root.querySelector('#adminLoginForm');
  const directorForm = root.querySelector('#directorLoginForm');
  const adminInput = root.querySelector('#adminGithubToken');
  const directorInput = root.querySelector('#directorPassword');
  const adminToggle = root.querySelector('#toggleAdminToken');
  const directorToggle = root.querySelector('#toggleDirectorPassword');
  const tabs = [...root.querySelectorAll('[data-login-mode]')];
  const loginState = createLoginFormState({
    adminForm,
    directorForm,
    adminInput,
    directorInput,
    adminToggle,
    directorToggle,
    tabs
  });

  bindProfileTabs(tabs, loginState);
  bindSecretVisibility(adminInput, adminToggle, 'token');
  bindSecretVisibility(directorInput, directorToggle, 'senha');

  adminForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const token = String(new FormData(event.currentTarget).get('token') || '').trim();
    setSubmitting(button, 'Conectando…');
    try {
      const session = await loginAdmin(token);
      onSuccess();
      if (session?.authorization?.warning) toast(session.authorization.warning);
      else toast('Acesso administrativo liberado e dados carregados do GitHub.');
    } catch (error) {
      resetSecretField(adminInput, adminToggle, 'token');
      toast(error.message || 'Não foi possível conectar ao GitHub.');
      restoreSubmit(button, 'Conectar como Administrador');
      adminInput.focus();
    }
  });

  directorForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const password = String(new FormData(event.currentTarget).get('directorAccessPassword') || '');
    setSubmitting(button, 'Validando…');
    try {
      await loginDirector(password);
      directorInput.value = '';
      onSuccess();
      toast('Acesso Diretoria liberado em modo somente leitura.');
    } catch (error) {
      resetSecretField(directorInput, directorToggle, 'senha');
      toast(error.message || 'Não foi possível validar a senha da Diretoria.');
      restoreSubmit(button, 'Entrar como Diretoria');
      directorInput.focus();
    }
  });

  loginState.activate('admin');
}
