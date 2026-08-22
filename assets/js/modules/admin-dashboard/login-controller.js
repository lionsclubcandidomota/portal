import { adminLoginHtml } from './view.js?v=6.52.3';
import {
  bindSecretVisibility,
  createLoginFormState,
  resetSecretField
} from './login-form-state.js?v=6.52.3';

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

export function bindAdminLogin({ root, loginAdmin, loginDirector, loginUser, onSuccess, toast }) {
  root.innerHTML = adminLoginHtml();
  const adminForm = root.querySelector('#adminLoginForm');
  const userForm = root.querySelector('#userLoginForm');
  const directorForm = root.querySelector('#directorLoginForm');
  const adminInput = root.querySelector('#adminCredential');
  const userInput = root.querySelector('#portalUsername');
  const userPassword = root.querySelector('#portalUserPassword');
  const directorInput = root.querySelector('#directorPassword');
  const adminToggle = root.querySelector('#toggleAdminCredential');
  const userToggle = root.querySelector('#togglePortalUserPassword');
  const directorToggle = root.querySelector('#toggleDirectorPassword');
  const tabs = [...root.querySelectorAll('[data-login-mode]')];
  const loginState = createLoginFormState({
    adminForm,
    userForm,
    directorForm,
    adminInput,
    userInput,
    userPassword,
    directorInput,
    adminToggle,
    userToggle,
    directorToggle,
    tabs
  });

  bindProfileTabs(tabs, loginState);
  bindSecretVisibility(adminInput, adminToggle, 'credencial');
  bindSecretVisibility(userPassword, userToggle, 'senha');
  bindSecretVisibility(directorInput, directorToggle, 'senha');

  adminForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const credential = String(new FormData(event.currentTarget).get('credential') || '').trim();
    setSubmitting(button, 'Conectando…');
    try {
      const session = await loginAdmin(credential);
      onSuccess();
      if (session?.authorization?.warning) toast(session.authorization.warning);
      else toast('Acesso administrativo liberado.');
    } catch (error) {
      resetSecretField(adminInput, adminToggle, 'credencial');
      toast(error.message || 'Não foi possível validar a credencial.');
      restoreSubmit(button, 'Entrar como Administrador');
      adminInput.focus();
    }
  });

  userForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const data = new FormData(event.currentTarget);
    const username = String(data.get('portalUsername') || '').trim();
    const password = String(data.get('portalUserPassword') || '');
    setSubmitting(button, 'Validando…');
    try {
      const session = await loginUser(username, password);
      userPassword.value = '';
      onSuccess();
      toast(`Bem-vindo, ${session?.actor?.name || 'usuário'}.`);
    } catch (error) {
      resetSecretField(userPassword, userToggle, 'senha');
      toast(error.message || 'Não foi possível validar o usuário.');
      restoreSubmit(button, 'Entrar com meu usuário');
      userPassword.focus();
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
