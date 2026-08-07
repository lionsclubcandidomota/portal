import { adminLoginHtml } from './view.js?v=6.40.0';
import {
  bindSecretVisibility,
  createLoginFormState,
  resetSecretField
} from './login-form-state.js?v=6.40.0';

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

function renderAuthenticationStatus(node, status) {
  if (!node) return;
  if (!status?.available) {
    node.className = 'admin-security-note admin-auth-status is-error';
    node.innerHTML = '<span aria-hidden="true">!</span><div><strong>Worker não configurado</strong><small>Configure o Cloudflare Worker no Portal antes de usar usuário e senha.</small></div>';
    return;
  }
  if (!status.initialized) {
    node.className = 'admin-security-note admin-auth-status is-warning';
    node.innerHTML = '<span aria-hidden="true">!</span><div><strong>Migração de autenticação pendente</strong><small>Aplique a migração 0002_admin_auth.sql no banco D1.</small></div>';
    return;
  }
  if (status.bootstrapRequired) {
    node.className = 'admin-security-note admin-auth-status is-warning';
    node.innerHTML = '<span aria-hidden="true">1</span><div><strong>Primeiro Administrador ainda não criado</strong><small>Abra “Primeiro acesso” e conclua a configuração inicial.</small></div>';
    return;
  }
  node.className = 'admin-security-note admin-auth-status is-ready';
  node.innerHTML = `<span aria-hidden="true">✓</span><div><strong>Autenticação pelo D1 disponível</strong><small>${status.publicationAvailable ? 'Publicação pública configurada no Worker.' : 'Login disponível; configure GITHUB_TOKEN para publicar conteúdo público.'}</small></div>`;
}

export function bindAdminLogin({
  root,
  loginAdmin,
  loginDirector,
  bootstrapAdmin,
  getAuthenticationStatus,
  onSuccess,
  toast
}) {
  root.innerHTML = adminLoginHtml();
  const adminForm = root.querySelector('#adminLoginForm');
  const directorForm = root.querySelector('#directorLoginForm');
  const bootstrapForm = root.querySelector('#adminBootstrapForm');
  const adminUsername = root.querySelector('#adminUsername');
  const adminInput = root.querySelector('#adminPassword');
  const directorInput = root.querySelector('#directorPassword');
  const adminToggle = root.querySelector('#toggleAdminPassword');
  const directorToggle = root.querySelector('#toggleDirectorPassword');
  const bootstrapToggle = root.querySelector('#toggleAdminBootstrap');
  const setupKeyInput = root.querySelector('#adminSetupKey');
  const setupKeyToggle = root.querySelector('#toggleAdminSetupKey');
  const bootstrapPassword = root.querySelector('#adminBootstrapPassword');
  const bootstrapPasswordToggle = root.querySelector('#toggleAdminBootstrapPassword');
  const bootstrapConfirm = root.querySelector('#adminBootstrapConfirm');
  const authStatus = root.querySelector('#adminAuthStatus');
  const tabs = [...root.querySelectorAll('[data-login-mode]')];
  const loginState = createLoginFormState({
    adminForm,
    directorForm,
    adminInput,
    adminUsernameInput: adminUsername,
    directorInput,
    adminToggle,
    directorToggle,
    tabs
  });

  const setBootstrapVisible = visible => {
    bootstrapForm.hidden = !visible;
    bootstrapToggle.setAttribute('aria-expanded', String(visible));
    bootstrapToggle.textContent = visible
      ? 'Fechar configuração do primeiro acesso'
      : 'Primeiro acesso: criar Administrador';
    if (visible) requestAnimationFrame(() => setupKeyInput?.focus({ preventScroll: true }));
  };

  bindProfileTabs(tabs, loginState);
  bindSecretVisibility(adminInput, adminToggle, 'senha');
  bindSecretVisibility(directorInput, directorToggle, 'senha');
  bindSecretVisibility(setupKeyInput, setupKeyToggle, 'código de ativação');
  bindSecretVisibility(bootstrapPassword, bootstrapPasswordToggle, 'senha');
  bootstrapToggle?.addEventListener('click', () => setBootstrapVisible(bootstrapForm.hidden));

  Promise.resolve(getAuthenticationStatus?.())
    .then(status => {
      renderAuthenticationStatus(authStatus, status);
      if (status?.bootstrapRequired) setBootstrapVisible(true);
    })
    .catch(error => {
      renderAuthenticationStatus(authStatus, { available: false });
      console.warn('Não foi possível consultar a autenticação:', error);
    });

  adminForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const data = new FormData(event.currentTarget);
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');
    setSubmitting(button, 'Validando…');
    try {
      const session = await loginAdmin({ username, password });
      adminInput.value = '';
      onSuccess();
      if (session?.authorization?.warning) toast(session.authorization.warning);
      else toast(`Acesso administrativo liberado para ${session?.actor?.name || username}.`);
    } catch (error) {
      resetSecretField(adminInput, adminToggle, 'senha');
      toast(error.message || 'Não foi possível validar o usuário e a senha.');
      restoreSubmit(button, 'Entrar como Administrador');
      adminInput.focus();
    }
  });

  bootstrapForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') || '');
    const confirmation = String(data.get('passwordConfirmation') || '');
    bootstrapConfirm?.setCustomValidity('');
    if (password !== confirmation) {
      bootstrapConfirm?.setCustomValidity('As senhas não conferem.');
      bootstrapConfirm?.reportValidity();
      bootstrapConfirm?.focus();
      return;
    }
    setSubmitting(button, 'Criando…');
    try {
      const result = await bootstrapAdmin({
        setupKey: String(data.get('setupKey') || ''),
        displayName: String(data.get('displayName') || ''),
        username: String(data.get('username') || ''),
        password
      });
      event.currentTarget.reset();
      resetSecretField(setupKeyInput, setupKeyToggle, 'código de ativação');
      resetSecretField(bootstrapPassword, bootstrapPasswordToggle, 'senha');
      adminUsername.value = result?.username || '';
      setBootstrapVisible(false);
      renderAuthenticationStatus(authStatus, {
        available: true,
        initialized: true,
        bootstrapRequired: false,
        publicationAvailable: false
      });
      toast('Primeiro Administrador criado. Entre com o usuário e a senha definidos.');
      adminUsername.focus();
    } catch (error) {
      toast(error.message || 'Não foi possível criar o primeiro Administrador.');
      restoreSubmit(button, 'Criar primeiro Administrador');
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
