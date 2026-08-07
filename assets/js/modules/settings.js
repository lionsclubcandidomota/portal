import { escapeHtml } from '../utils.js';
import { directorProfileFromState, hasLegacyDirectorTokenProfile } from './portal-runtime/access-profile.js?v=6.26.0';

const DEFAULT_LOGO = './public/logo.png';
const DEFAULT_PRIMARY_COLOR = '#00529B';
const DEFAULT_ACCENT_COLOR = '#F2C100';
const DEFAULT_CLUB_NAME = 'Lions Clube de Cândido Mota';

function settingsFrom(state) {
  return state?.settings || {};
}

function currencyField(name, label, value, help, currencyInputValue, disabled = false) {
  return `<div class="form-field"><label>${escapeHtml(label)}</label><div class="currency-input"><span>R$</span><input name="${escapeHtml(name)}" type="text" inputmode="decimal" value="${escapeHtml(currencyInputValue(value))}" autocomplete="off" ${disabled ? 'disabled' : ''}></div><small>${escapeHtml(help)}</small></div>`;
}

function formatConfiguredAt(value) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function directorProfileCard(profile, canWrite, legacyProfile = false) {
  const configured = Boolean(profile);
  const badgeLabel = configured ? 'Senha configurada' : legacyProfile ? 'Atualização necessária' : 'Não configurado';
  const badgeClass = configured ? 'badge-success' : legacyProfile ? 'badge-warning' : 'badge-muted';
  return `<section class="card" aria-labelledby="directorProfileTitle">
    <div class="card-header"><div><span class="section-eyebrow">Perfil de acesso</span><h3 id="directorProfileTitle">Diretoria</h3><div class="card-subtitle">Visualização completa do portal, sem permissão para cadastrar, editar, excluir, importar, restaurar ou publicar.</div></div><span class="badge ${badgeClass}">${badgeLabel}</span></div>
    ${configured ? `<div class="admin-grid"><div class="admin-tile"><small>Método de acesso</small><strong>Senha da Diretoria</strong><small>Sem token do GitHub para este perfil</small></div><div class="admin-tile"><small>Configurada em</small><strong>${escapeHtml(formatConfiguredAt(profile.configuredAt))}</strong><small>por ${escapeHtml(profile.configuredBy || 'Administrador')}</small></div><div class="admin-tile"><small>Segurança</small><strong>Hash derivado com PBKDF2</strong><small>A senha original nunca é armazenada ou publicada.</small></div></div>` : legacyProfile ? '<div class="notice medium is-warning"><strong>Token antigo da Diretoria detectado</strong><p>Esta versão não aceita mais token para a Diretoria. Defina uma senha abaixo e publique a alteração para liberar o novo acesso.</p></div>' : '<div class="notice medium"><strong>Nenhuma senha da Diretoria cadastrada</strong><p>Defina uma senha exclusiva para liberar o acesso completo em modo somente leitura.</p></div>'}
    ${canWrite ? `<form id="directorAccessForm" class="form-grid" autocomplete="off">
      <div class="form-field"><label for="directorPasswordSetting">${configured ? 'Nova senha da Diretoria' : 'Senha da Diretoria'} <span class="required-mark">*</span></label><div class="admin-token-field"><input id="directorPasswordSetting" name="directorPassword" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" minlength="10" maxlength="128" placeholder="Mínimo de 10 caracteres" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleDirectorPasswordSetting" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div><small>Utilize pelo menos 10 caracteres, incluindo uma letra e um número.</small></div>
      <div class="form-field"><label for="directorPasswordConfirm">Confirmar senha <span class="required-mark">*</span></label><div class="admin-token-field"><input id="directorPasswordConfirm" name="directorPasswordConfirm" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" minlength="10" maxlength="128" placeholder="Digite novamente" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleDirectorPasswordConfirm" aria-label="Mostrar confirmação da senha" aria-pressed="false">Mostrar</button></div><small>A confirmação deve ser exatamente igual à senha informada.</small></div>
      <div class="admin-security-note full-row"><span aria-hidden="true">🛡️</span><div><strong>Proteção da credencial</strong><p>O portal publica apenas um hash derivado com salt individual. Para maior segurança em um portal estático, utilize uma senha longa e exclusiva.</p></div></div>
      <div class="form-actions full-row"><button class="btn btn-primary" type="submit">${configured || legacyProfile ? 'Definir nova senha' : 'Configurar senha da Diretoria'}</button>${configured || legacyProfile ? '<button class="btn btn-danger" id="removeDirectorProfile" type="button">Remover acesso</button>' : ''}</div>
    </form>` : '<div class="notice medium"><strong>Configuração exclusiva do Administrador</strong><p>O perfil Diretoria pode consultar o status desta configuração, mas não pode alterá-la.</p></div>'}
  </section>`;
}

export function createSettingsController({
  root,
  getState,
  isAdminUnlocked,
  canWrite = () => false,
  getAccessRole = () => 'visitor',
  empty,
  parseCurrencyInput,
  currencyInputValue,
  persist,
  requestLogoUpload,
  updateAccessUI,
  configureDirectorProfile,
  removeDirectorProfile,
  confirmation,
  toast = () => {},
  defaultLogo = DEFAULT_LOGO
}) {
  if (!root) throw new TypeError('createSettingsController requer root.');
  if (typeof getState !== 'function') throw new TypeError('createSettingsController requer getState().');
  if (typeof isAdminUnlocked !== 'function') throw new TypeError('createSettingsController requer isAdminUnlocked().');
  if (typeof parseCurrencyInput !== 'function') throw new TypeError('createSettingsController requer parseCurrencyInput().');
  if (typeof currencyInputValue !== 'function') throw new TypeError('createSettingsController requer currencyInputValue().');
  if (typeof persist !== 'function') throw new TypeError('createSettingsController requer persist().');

  const state = () => getState();

  const apply = () => {
    const settings = settingsFrom(state());
    const clubName = String(settings.clubName || DEFAULT_CLUB_NAME).trim() || DEFAULT_CLUB_NAME;
    const primaryColor = settings.primaryColor || DEFAULT_PRIMARY_COLOR;
    const accentColor = settings.accentColor || DEFAULT_ACCENT_COLOR;

    document.documentElement.style.setProperty('--primary', primaryColor);
    document.documentElement.style.setProperty('--accent', accentColor);

    const clubNameNode = document.getElementById('sidebarClubName');
    if (clubNameNode) clubNameNode.textContent = clubName;

    const logo = document.getElementById('sidebarLogo');
    const fallbackLogo = document.getElementById('fallbackLogo');
    if (logo) {
      logo.src = settings.logo || defaultLogo;
      logo.alt = `Logo do ${clubName}`;
      logo.style.display = '';
    }
    if (fallbackLogo) fallbackLogo.style.display = 'none';

    document.title = clubName;
    updateAccessUI?.();
  };

  const bindCredentialVisibility = (input, button, label = 'senha') => {
    button?.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.textContent = showing ? 'Mostrar' : 'Ocultar';
      button.setAttribute('aria-label', `${showing ? 'Mostrar' : 'Ocultar'} ${label}`);
      button.setAttribute('aria-pressed', String(!showing));
      input.focus();
    });
  };

  const render = () => {
    if (!isAdminUnlocked()) {
      root.innerHTML = `<div class="card">${empty('🔒', 'Entre no painel para consultar as configurações.')}</div>`;
      return;
    }

    const settings = settingsFrom(state());
    const writeAllowed = canWrite();
    const directorMode = getAccessRole() === 'director';
    const clubName = settings.clubName || DEFAULT_CLUB_NAME;
    const primaryColor = settings.primaryColor || DEFAULT_PRIMARY_COLOR;
    const accentColor = settings.accentColor || DEFAULT_ACCENT_COLOR;
    const profile = directorProfileFromState(state());
    const legacyDirectorProfile = hasLegacyDirectorTokenProfile(state());

    root.innerHTML = `<div class="grid">
      ${directorMode ? '<div class="notice medium" role="status"><strong>👁️ Configurações em modo somente leitura</strong><p>Você pode consultar todos os parâmetros, mas somente um Administrador pode alterá-los.</p></div>' : ''}
      <div class="card"><div class="card-header"><div><h3>Configurações do sistema</h3><div class="card-subtitle">Personalização visual, regras financeiras e perfis de acesso do painel.</div></div></div>
      <form id="settingsForm" class="form-grid ${writeAllowed ? '' : 'is-readonly'}">
        <div class="form-field full-row"><label>Nome do clube</label><input name="clubName" value="${escapeHtml(clubName)}" required ${writeAllowed ? '' : 'disabled'}></div>
        <div class="form-field"><label>Cor principal</label><div class="toolbar-group"><input name="primaryColor" type="color" value="${escapeHtml(primaryColor)}" style="width:70px;padding:4px" ${writeAllowed ? '' : 'disabled'}><input name="primaryText" value="${escapeHtml(primaryColor)}" ${writeAllowed ? '' : 'disabled'}></div></div>
        <div class="form-field"><label>Cor de destaque</label><div class="toolbar-group"><input name="accentColor" type="color" value="${escapeHtml(accentColor)}" style="width:70px;padding:4px" ${writeAllowed ? '' : 'disabled'}><input name="accentText" value="${escapeHtml(accentColor)}" ${writeAllowed ? '' : 'disabled'}></div></div>
        ${currencyField('membershipMonthlyFee', 'Mensalidade individual', settings.membershipMonthlyFee, 'Valor mensal utilizado para associados sem grupo familiar.', currencyInputValue, !writeAllowed)}
        ${currencyField('membershipFamilyPrimaryFee', 'Mensalidade familiar — titular', settings.membershipFamilyPrimaryFee, 'Valor utilizado para o titular do grupo familiar.', currencyInputValue, !writeAllowed)}
        ${currencyField('membershipFamilyAdditionalFee', 'Mensalidade familiar — adicional', settings.membershipFamilyAdditionalFee, 'Valor utilizado para cada integrante adicional.', currencyInputValue, !writeAllowed)}
        <div class="form-field full-row"><label>Logo do clube</label>${writeAllowed ? '<div class="toolbar-group"><button type="button" class="btn btn-ghost" id="logoUpload">Selecionar imagem</button><button type="button" class="btn btn-ghost" id="logoReset">Usar logo padrão</button></div>' : `<div class="list-item"><img class="avatar" src="${escapeHtml(settings.logo || defaultLogo)}" alt="Logo atual do clube"><div class="list-item-main"><strong>Logo atualmente publicada</strong><small>Visualização somente leitura</small></div></div>`}<small>${writeAllowed ? 'Imagens grandes serão compactadas e armazenadas no navegador.' : 'A alteração da identidade visual é exclusiva do Administrador.'}</small></div>
        ${writeAllowed ? '<div class="form-actions full-row"><button class="btn btn-primary" type="submit">Salvar configurações</button></div>' : ''}
      </form></div>
      ${directorProfileCard(profile, writeAllowed, legacyDirectorProfile)}
    </div>`;

    const form = document.getElementById('settingsForm');
    if (form && writeAllowed) {
      const synchronizeColorFields = (pickerName, textName) => {
        form.elements[pickerName].oninput = event => { form.elements[textName].value = event.target.value; };
        form.elements[textName].oninput = event => { form.elements[pickerName].value = event.target.value; };
      };
      synchronizeColorFields('primaryColor', 'primaryText');
      synchronizeColorFields('accentColor', 'accentText');
      form.querySelectorAll('.currency-input input').forEach(input => {
        input.addEventListener('blur', () => {
          input.value = currencyInputValue(parseCurrencyInput(input.value));
        });
      });
      document.getElementById('logoUpload')?.addEventListener('click', () => requestLogoUpload?.());
      document.getElementById('logoReset')?.addEventListener('click', () => {
        state().settings.logo = defaultLogo;
        persist('Logo padrão restaurado.');
      });
      form.onsubmit = event => {
        event.preventDefault();
        const data = new FormData(form);
        const currentSettings = state().settings;
        currentSettings.clubName = String(data.get('clubName') || '').trim();
        currentSettings.primaryColor = String(data.get('primaryText') || DEFAULT_PRIMARY_COLOR).trim();
        currentSettings.accentColor = String(data.get('accentText') || DEFAULT_ACCENT_COLOR).trim();
        currentSettings.membershipMonthlyFee = parseCurrencyInput(data.get('membershipMonthlyFee'));
        currentSettings.membershipFamilyPrimaryFee = parseCurrencyInput(data.get('membershipFamilyPrimaryFee'));
        currentSettings.membershipFamilyAdditionalFee = parseCurrencyInput(data.get('membershipFamilyAdditionalFee'));
        persist('Configurações atualizadas.');
        render();
      };
    }

    if (writeAllowed) {
      const directorForm = document.getElementById('directorAccessForm');
      const passwordInput = document.getElementById('directorPasswordSetting');
      const confirmInput = document.getElementById('directorPasswordConfirm');
      bindCredentialVisibility(passwordInput, document.getElementById('toggleDirectorPasswordSetting'), 'senha');
      bindCredentialVisibility(confirmInput, document.getElementById('toggleDirectorPasswordConfirm'), 'confirmação da senha');
      directorForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const button = directorForm.querySelector('button[type="submit"]');
        const data = new FormData(directorForm);
        const password = String(data.get('directorPassword') || '');
        const confirmationValue = String(data.get('directorPasswordConfirm') || '');
        confirmInput.setCustomValidity('');
        if (password !== confirmationValue) {
          confirmInput.setCustomValidity('A confirmação deve ser igual à senha informada.');
          confirmInput.reportValidity();
          confirmInput.focus();
          return;
        }
        button.disabled = true;
        button.textContent = 'Protegendo senha…';
        try {
          await configureDirectorProfile(password);
          passwordInput.value = '';
          confirmInput.value = '';
          toast('Senha da Diretoria configurada. Publique as alterações para disponibilizar o acesso.');
          render();
        } catch (error) {
          passwordInput.value = '';
          confirmInput.value = '';
          passwordInput.type = 'password';
          confirmInput.type = 'password';
          toast(error?.message || 'Não foi possível configurar a senha da Diretoria.');
          button.disabled = false;
          button.textContent = profile || legacyDirectorProfile ? 'Definir nova senha' : 'Configurar senha da Diretoria';
          passwordInput.focus();
        }
      });
      document.getElementById('removeDirectorProfile')?.addEventListener('click', async () => {
        const approved = await confirmation?.askConfirmation?.({
          title: 'Remover o acesso da Diretoria?',
          message: 'A senha configurada deixará de liberar o acesso somente leitura após a publicação desta alteração.',
          icon: '👁️',
          confirmText: 'Remover acesso',
          tone: 'danger'
        });
        if (!approved) return;
        await removeDirectorProfile();
        toast('Acesso Diretoria removido. Publique as alterações para concluir.');
        render();
      });
    }
  };

  const applyLogo = dataUrl => {
    if (!dataUrl || !canWrite()) return false;
    state().settings.logo = dataUrl;
    persist('Logo atualizado.');
    render();
    return true;
  };

  return { apply, applyLogo, render };
}
