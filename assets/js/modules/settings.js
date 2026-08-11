import { escapeHtml } from '../utils.js';
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_CLUB_NAME,
  DEFAULT_LOGO,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_FONT_FAMILY,
  PORTAL_FONT_OPTIONS,
  applyPortalAppearance,
  portalFontStack,
  resolveDisplayLogo,
  normalizePortalFont,
  settingsFrom
} from './settings-appearance.js?v=6.46.7';
import { directorProfileFromState, hasLegacyDirectorTokenProfile } from './portal-runtime/access-profile.js?v=6.46.7';

function currencyField(name, label, value, help, currencyInputValue, disabled = false) {
  return `<div class="form-field settings-money-field"><label for="${escapeHtml(name)}">${escapeHtml(label)}</label><div class="currency-input"><span>R$</span><input id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="text" inputmode="decimal" value="${escapeHtml(currencyInputValue(value))}" autocomplete="off" ${disabled ? 'disabled' : ''}></div><small>${escapeHtml(help)}</small></div>`;
}

function formatConfiguredAt(value) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function settingsSectionHeading(icon, eyebrow, title, description) {
  return `<div class="settings-section-heading"><span class="settings-section-icon" aria-hidden="true">${icon}</span><div><span class="section-eyebrow">${escapeHtml(eyebrow)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div></div>`;
}

function directorProfileCard(profile, canWrite, legacyProfile = false) {
  const configured = Boolean(profile);
  const badgeLabel = configured ? 'Senha configurada' : legacyProfile ? 'Atualização necessária' : 'Não configurado';
  const badgeClass = configured ? 'badge-success' : legacyProfile ? 'badge-warning' : 'badge-muted';
  return `<section class="card settings-section settings-access-section" aria-labelledby="directorProfileTitle">
    <div class="settings-section-topline">${settingsSectionHeading('👁️', 'Acesso', 'Diretoria', 'Libere consulta completa sem permitir alterações.')}<span class="badge ${badgeClass}">${badgeLabel}</span></div>
    ${configured ? `<div class="settings-status-grid"><div><small>Forma de acesso</small><strong>Senha da Diretoria</strong><span>Somente leitura</span></div><div><small>Configurada em</small><strong>${escapeHtml(formatConfiguredAt(profile.configuredAt))}</strong><span>por ${escapeHtml(profile.configuredBy || 'Administrador')}</span></div><div><small>Proteção</small><strong>Senha protegida</strong><span>A credencial original não é armazenada.</span></div></div>` : legacyProfile ? '<div class="notice medium is-warning"><strong>Atualização de acesso necessária</strong><p>Defina uma senha para substituir a configuração antiga e publique a alteração.</p></div>' : '<div class="settings-empty-access"><span aria-hidden="true">🔐</span><div><strong>Acesso ainda não configurado</strong><p>Crie uma senha exclusiva para permitir a consulta da Diretoria.</p></div></div>'}
    ${canWrite ? `<form id="directorAccessForm" class="settings-access-form" autocomplete="off">
      <div class="form-grid">
        <div class="form-field"><label for="directorPasswordSetting">${configured ? 'Nova senha' : 'Senha da Diretoria'} <span class="required-mark">*</span></label><div class="admin-token-field"><input id="directorPasswordSetting" name="directorPassword" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" minlength="10" maxlength="128" placeholder="Mínimo de 10 caracteres" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleDirectorPasswordSetting" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div><small>Use pelo menos 10 caracteres, com letra e número.</small></div>
        <div class="form-field"><label for="directorPasswordConfirm">Confirmar senha <span class="required-mark">*</span></label><div class="admin-token-field"><input id="directorPasswordConfirm" name="directorPasswordConfirm" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" minlength="10" maxlength="128" placeholder="Digite novamente" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleDirectorPasswordConfirm" aria-label="Mostrar confirmação da senha" aria-pressed="false">Mostrar</button></div><small>Digite exatamente a mesma senha.</small></div>
      </div>
      <div class="settings-security-note"><span aria-hidden="true">🛡️</span><p>A senha é protegida antes da publicação. Prefira uma credencial longa e exclusiva.</p></div>
      <div class="form-actions"><button class="btn btn-primary" type="submit">${configured || legacyProfile ? 'Trocar senha' : 'Configurar acesso'}</button>${configured || legacyProfile ? '<button class="btn btn-danger-soft" id="removeDirectorProfile" type="button">Remover acesso</button>' : ''}</div>
    </form>` : '<div class="notice medium"><strong>Somente o Administrador pode alterar</strong><p>O perfil Diretoria pode apenas consultar esta configuração.</p></div>'}
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
  captureInterfaceContext = () => null,
  restoreInterfaceContext = () => {},
  defaultLogo = DEFAULT_LOGO
}) {
  if (!root) throw new TypeError('createSettingsController requer root.');
  if (typeof getState !== 'function') throw new TypeError('createSettingsController requer getState().');
  if (typeof isAdminUnlocked !== 'function') throw new TypeError('createSettingsController requer isAdminUnlocked().');
  if (typeof parseCurrencyInput !== 'function') throw new TypeError('createSettingsController requer parseCurrencyInput().');
  if (typeof currencyInputValue !== 'function') throw new TypeError('createSettingsController requer currencyInputValue().');
  if (typeof persist !== 'function') throw new TypeError('createSettingsController requer persist().');

  const state = () => getState();

  const apply = () => applyPortalAppearance({
    state: state(),
    updateAccessUI,
    defaultLogo
  });

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

  const rerender = ({ restoreFocus = false } = {}) => {
    const snapshot = captureInterfaceContext?.();
    render();
    restoreInterfaceContext?.(snapshot, { restoreFocus });
  };

  const render = () => {
    if (!isAdminUnlocked()) {
      root.innerHTML = `<div class="card">${empty('🔒', 'Entre no painel para consultar os ajustes.')}</div>`;
      return;
    }

    const settings = settingsFrom(state());
    const writeAllowed = canWrite();
    const directorMode = getAccessRole() === 'director';
    const clubName = settings.clubName || DEFAULT_CLUB_NAME;
    const primaryColor = settings.primaryColor || DEFAULT_PRIMARY_COLOR;
    const accentColor = settings.accentColor || DEFAULT_ACCENT_COLOR;
    const fontFamily = normalizePortalFont(settings.fontFamily || DEFAULT_FONT_FAMILY);
    const fontOptions = PORTAL_FONT_OPTIONS.map(option => `<option value="${escapeHtml(option.value)}" ${option.value === fontFamily ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
    const profile = directorProfileFromState(state());
    const legacyDirectorProfile = hasLegacyDirectorTokenProfile(state());
    const displayLogo = resolveDisplayLogo(settings.logo, defaultLogo);

    root.innerHTML = `<div class="settings-page">
      <header class="settings-hero card">
        <div class="settings-hero-copy"><span class="section-eyebrow">Ajustes do portal</span><h2>Personalize sem complicação</h2><p>Organize a identidade do clube, os valores padrão e o acesso da Diretoria.</p></div>
        <nav class="settings-jump-links" aria-label="Atalhos dos ajustes"><a href="#settingsIdentity">Identidade</a><a href="#settingsAppearance">Visual</a><a href="#settingsFees">Mensalidades</a><a href="#directorProfileTitle">Acesso</a></nav>
      </header>
      ${directorMode ? '<div class="notice medium" role="status"><strong>👁️ Consulta somente leitura</strong><p>Você pode visualizar os ajustes, mas apenas o Administrador pode alterá-los.</p></div>' : ''}
      <form id="settingsForm" class="settings-workspace ${writeAllowed ? '' : 'is-readonly'}">
        <section class="card settings-section" id="settingsIdentity">
          ${settingsSectionHeading('🦁', 'Identidade', 'Informações do clube', 'Nome e logotipo exibidos em todo o portal.')}
          <div class="settings-identity-grid">
            <div class="form-field"><label for="settingsClubName">Nome do clube</label><input id="settingsClubName" name="clubName" value="${escapeHtml(clubName)}" required ${writeAllowed ? '' : 'disabled'}><small>Use o nome oficial que será mostrado no menu e no título.</small></div>
            <div class="settings-logo-panel"><img id="settingsLogoPreview" src="${escapeHtml(displayLogo)}" alt="Prévia do logotipo do clube" width="88" height="88" loading="lazy" decoding="async"><div><strong>Logotipo do portal</strong><p>A imagem é ajustada automaticamente sem distorção.</p>${writeAllowed ? '<div class="toolbar-group"><button type="button" class="btn btn-ghost btn-sm" id="logoUpload">Escolher imagem</button><button type="button" class="btn btn-ghost btn-sm" id="logoReset">Usar logo padrão</button></div>' : '<span class="badge badge-muted">Somente visualização</span>'}</div></div>
          </div>
        </section>

        <section class="card settings-section" id="settingsAppearance">
          ${settingsSectionHeading('🎨', 'Visual', 'Cores e leitura', 'Escolha um conjunto confortável e consistente para todas as telas.')}
          <div class="settings-appearance-grid">
            <div class="settings-control-stack">
              <div class="form-field"><label for="primaryColorPicker">Cor principal</label><div class="settings-color-control"><input id="primaryColorPicker" name="primaryColor" type="color" value="${escapeHtml(primaryColor)}" ${writeAllowed ? '' : 'disabled'}><input name="primaryText" value="${escapeHtml(primaryColor)}" aria-label="Código da cor principal" ${writeAllowed ? '' : 'disabled'}></div><small>Usada no menu, botões e destaques.</small></div>
              <div class="form-field"><label for="accentColorPicker">Cor de apoio</label><div class="settings-color-control"><input id="accentColorPicker" name="accentColor" type="color" value="${escapeHtml(accentColor)}" ${writeAllowed ? '' : 'disabled'}><input name="accentText" value="${escapeHtml(accentColor)}" aria-label="Código da cor de apoio" ${writeAllowed ? '' : 'disabled'}></div><small>Usada em detalhes e pontos de atenção.</small></div>
              <div class="form-field portal-font-setting"><label for="portalFontFamily">Fonte do portal</label><select id="portalFontFamily" name="fontFamily" ${writeAllowed ? '' : 'disabled'}>${fontOptions}</select><small>Altera o estilo de leitura em todas as páginas.</small></div>
            </div>
            <div class="settings-live-preview" id="settingsLivePreview" style="--preview-primary:${escapeHtml(primaryColor)};--preview-accent:${escapeHtml(accentColor)};--preview-font:${escapeHtml(portalFontStack(fontFamily))}">
              <span>Prévia</span><div class="settings-preview-card"><i aria-hidden="true"></i><div><strong>${escapeHtml(clubName)}</strong><small>Interface limpa e fácil de ler</small></div></div><button type="button" tabindex="-1">Ação principal</button>
            </div>
          </div>
        </section>

        <section class="card settings-section" id="settingsFees">
          ${settingsSectionHeading('💳', 'Mensalidades', 'Valores padrão', 'Defina os valores sugeridos ao registrar novos pagamentos.')}
          <div class="settings-fee-grid">
            ${currencyField('membershipMonthlyFee', 'Individual', settings.membershipMonthlyFee, 'Valor de um associado individual.', currencyInputValue, !writeAllowed)}
            ${currencyField('membershipFamilyPrimaryFee', 'Família — titular', settings.membershipFamilyPrimaryFee, 'Valor do responsável pelo grupo familiar.', currencyInputValue, !writeAllowed)}
            ${currencyField('membershipFamilyAdditionalFee', 'Família — adicional', settings.membershipFamilyAdditionalFee, 'Valor de cada integrante adicional.', currencyInputValue, !writeAllowed)}
          </div>
        </section>
        ${writeAllowed ? '<div class="settings-savebar"><div><strong>Revise antes de salvar</strong><small>As mudanças ficam pendentes até serem publicadas.</small></div><button class="btn btn-primary" type="submit">Salvar ajustes</button></div>' : ''}
      </form>
      ${directorProfileCard(profile, writeAllowed, legacyDirectorProfile)}
    </div>`;

    const form = document.getElementById('settingsForm');
    if (form && writeAllowed) {
      const preview = document.getElementById('settingsLivePreview');
      const previewTitle = preview?.querySelector('strong');
      const synchronizeColorFields = (pickerName, textName, variable) => {
        const picker = form.elements[pickerName];
        const text = form.elements[textName];
        picker.oninput = event => {
          text.value = event.target.value;
          preview?.style.setProperty(variable, event.target.value);
        };
        text.oninput = event => {
          picker.value = event.target.value;
          preview?.style.setProperty(variable, event.target.value);
        };
      };
      synchronizeColorFields('primaryColor', 'primaryText', '--preview-primary');
      synchronizeColorFields('accentColor', 'accentText', '--preview-accent');
      form.elements.clubName?.addEventListener('input', event => {
        if (previewTitle) previewTitle.textContent = String(event.target.value || DEFAULT_CLUB_NAME);
      });
      form.elements.fontFamily?.addEventListener('change', event => {
        preview?.style.setProperty('--preview-font', portalFontStack(event.target.value));
      });
      form.querySelectorAll('.currency-input input').forEach(input => {
        input.addEventListener('blur', () => {
          input.value = currencyInputValue(parseCurrencyInput(input.value));
        });
      });
      document.getElementById('logoUpload')?.addEventListener('click', () => requestLogoUpload?.());
      document.getElementById('logoReset')?.addEventListener('click', () => {
        state().settings.logo = defaultLogo;
        persist('Logo padrão restaurado.');
        rerender();
      });
      form.onsubmit = event => {
        event.preventDefault();
        const data = new FormData(form);
        const currentSettings = state().settings;
        currentSettings.clubName = String(data.get('clubName') || '').trim();
        currentSettings.primaryColor = String(data.get('primaryText') || DEFAULT_PRIMARY_COLOR).trim();
        currentSettings.accentColor = String(data.get('accentText') || DEFAULT_ACCENT_COLOR).trim();
        currentSettings.fontFamily = normalizePortalFont(data.get('fontFamily'));
        currentSettings.membershipMonthlyFee = parseCurrencyInput(data.get('membershipMonthlyFee'));
        currentSettings.membershipFamilyPrimaryFee = parseCurrencyInput(data.get('membershipFamilyPrimaryFee'));
        currentSettings.membershipFamilyAdditionalFee = parseCurrencyInput(data.get('membershipFamilyAdditionalFee'));
        persist('Ajustes atualizados.');
        rerender();
        toast('Ajustes salvos neste navegador. Publique quando terminar.');
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
        button.textContent = 'Protegendo…';
        try {
          await configureDirectorProfile(password);
          toast('Acesso da Diretoria configurado. Publique a alteração para disponibilizá-lo.');
          rerender();
        } catch (error) {
          passwordInput.value = '';
          confirmInput.value = '';
          passwordInput.type = 'password';
          confirmInput.type = 'password';
          toast(error?.message || 'Não foi possível configurar a senha da Diretoria.');
          button.disabled = false;
          button.textContent = profile || legacyDirectorProfile ? 'Trocar senha' : 'Configurar acesso';
          passwordInput.focus();
        }
      });
      document.getElementById('removeDirectorProfile')?.addEventListener('click', async () => {
        const approved = await confirmation?.askConfirmation?.({
          title: 'Remover o acesso da Diretoria?',
          message: 'A senha configurada deixará de liberar a consulta após a publicação.',
          icon: '👁️',
          confirmText: 'Remover acesso',
          tone: 'danger'
        });
        if (!approved) return;
        await removeDirectorProfile();
        toast('Acesso da Diretoria removido. Publique a alteração para concluir.');
        rerender();
      });
    }
  };

  const applyLogo = dataUrl => {
    if (!dataUrl || !canWrite()) return false;
    state().settings.logo = dataUrl;
    persist('Logo atualizado.');
    rerender();
    return true;
  };

  return { apply, applyLogo, render };
}
