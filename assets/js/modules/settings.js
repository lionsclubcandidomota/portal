import { escapeHtml } from '../utils.js';
import { directorProfileFromState, directorProfileRequiresWorkerMigration, hasLegacyDirectorTokenProfile } from './portal-runtime/access-profile.js?v=6.35.1';
import {
  collectSecureTreasuryObjectKeys,
  normalizeSecureStorageWorkerUrl,
  secureStorageProfileFromState,
  testSecureStorageConnection
} from './secure-storage/client.js?v=6.35.1';

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

function directorProfileCard(profile, canWrite, legacyProfile = false, workerMigrationRequired = false) {
  const configured = Boolean(profile);
  const badgeLabel = workerMigrationRequired ? 'Atualização necessária' : configured ? 'Senha configurada' : legacyProfile ? 'Atualização necessária' : 'Não configurado';
  const badgeClass = workerMigrationRequired || legacyProfile ? 'badge-warning' : configured ? 'badge-success' : 'badge-muted';
  return `<section class="card" aria-labelledby="directorProfileTitle">
    <div class="card-header"><div><span class="section-eyebrow">Perfil de acesso</span><h3 id="directorProfileTitle">Diretoria</h3><div class="card-subtitle">Visualização completa do portal, sem permissão para cadastrar, editar, excluir, importar, restaurar ou publicar.</div></div><span class="badge ${badgeClass}">${badgeLabel}</span></div>
    ${workerMigrationRequired ? '<div class="notice medium is-warning"><strong>Atualize a senha para liberar os anexos privados</strong><p>A senha atual foi criada com um padrão anterior que o Cloudflare Worker não consegue validar. Defina novamente a senha abaixo e publique a alteração. Depois disso, a Diretoria poderá visualizar e baixar os documentos das movimentações.</p></div>' : ''}
    ${configured ? `<div class="admin-grid"><div class="admin-tile"><small>Método de acesso</small><strong>Senha da Diretoria</strong><small>Sem token do GitHub para este perfil</small></div><div class="admin-tile"><small>Configurada em</small><strong>${escapeHtml(formatConfiguredAt(profile.configuredAt))}</strong><small>por ${escapeHtml(profile.configuredBy || 'Administrador')}</small></div><div class="admin-tile"><small>Segurança</small><strong>Hash derivado com PBKDF2</strong><small>A senha original nunca é armazenada ou publicada.</small></div></div>` : legacyProfile ? '<div class="notice medium is-warning"><strong>Token antigo da Diretoria detectado</strong><p>Esta versão não aceita mais token para a Diretoria. Defina uma senha abaixo e publique a alteração para liberar o novo acesso.</p></div>' : '<div class="notice medium"><strong>Nenhuma senha da Diretoria cadastrada</strong><p>Defina uma senha exclusiva para liberar o acesso completo em modo somente leitura.</p></div>'}
    ${canWrite ? `<form id="directorAccessForm" class="form-grid" autocomplete="off">
      <div class="form-field"><label for="directorPasswordSetting">${configured ? 'Nova senha da Diretoria' : 'Senha da Diretoria'} <span class="required-mark">*</span></label><div class="admin-token-field"><input id="directorPasswordSetting" name="directorPassword" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" minlength="10" maxlength="128" placeholder="Mínimo de 10 caracteres" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleDirectorPasswordSetting" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div><small>Utilize pelo menos 10 caracteres, incluindo uma letra e um número.</small></div>
      <div class="form-field"><label for="directorPasswordConfirm">Confirmar senha <span class="required-mark">*</span></label><div class="admin-token-field"><input id="directorPasswordConfirm" name="directorPasswordConfirm" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" minlength="10" maxlength="128" placeholder="Digite novamente" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleDirectorPasswordConfirm" aria-label="Mostrar confirmação da senha" aria-pressed="false">Mostrar</button></div><small>A confirmação deve ser exatamente igual à senha informada.</small></div>
      <div class="admin-security-note full-row"><span aria-hidden="true">🛡️</span><div><strong>Proteção da credencial</strong><p>O portal publica apenas um hash derivado com salt individual. Para maior segurança em um portal estático, utilize uma senha longa e exclusiva.</p></div></div>
      <div class="form-actions full-row"><button class="btn btn-primary" type="submit">${workerMigrationRequired ? 'Atualizar senha da Diretoria' : configured || legacyProfile ? 'Definir nova senha' : 'Configurar senha da Diretoria'}</button>${configured || legacyProfile ? '<button class="btn btn-danger" id="removeDirectorProfile" type="button">Remover acesso</button>' : ''}</div>
    </form>` : '<div class="notice medium"><strong>Configuração exclusiva do Administrador</strong><p>O perfil Diretoria pode consultar o status desta configuração, mas não pode alterá-la.</p></div>'}
  </section>`;
}


function secureStorageCard(state, canWrite) {
  const profile = secureStorageProfileFromState(state);
  const secureCount = collectSecureTreasuryObjectKeys(state).size;
  const legacyCount = (Array.isArray(state?.treasury) ? state.treasury : []).reduce((total, movement) => (
    total + (Array.isArray(movement?.attachments) ? movement.attachments.filter(item => item?.url || item?.dataUrl).length : 0)
  ), 0);
  const badge = profile.enabled
    ? '<span class="badge badge-success">R2 privado ativo</span>'
    : '<span class="badge badge-warning">Configuração pendente</span>';
  return `<section class="card" aria-labelledby="secureStorageTitle">
    <div class="card-header"><div><span class="section-eyebrow">Documentos financeiros</span><h3 id="secureStorageTitle">Armazenamento privado de anexos</h3><div class="card-subtitle">Comprovantes ficam no Cloudflare R2 e deixam de ser publicados como arquivos acessíveis por URL direta.</div></div>${badge}</div>
    <div class="admin-grid"><div class="admin-tile"><small>Anexos privados</small><strong>${secureCount}</strong><small>arquivo(s) referenciado(s) no R2</small></div><div class="admin-tile"><small>Aguardando migração</small><strong>${legacyCount}</strong><small>migram automaticamente na próxima publicação</small></div><div class="admin-tile"><small>Bucket</small><strong>Privado</strong><small>acesso temporário via Worker</small></div></div>
    ${profile.enabled ? `<div class="notice medium is-success"><strong>Worker conectado ao Portal</strong><p>${escapeHtml(profile.workerUrl)}</p></div>` : '<div class="notice medium is-warning"><strong>Conclua a configuração do Worker</strong><p>Publique o Worker do pacote, mantenha o bucket privado e informe abaixo a URL gerada pela Cloudflare.</p></div>'}
    ${canWrite ? `<form id="secureStorageForm" class="form-grid" autocomplete="off">
      <div class="form-field full-row"><label for="secureStorageWorkerUrl">URL do Cloudflare Worker <span class="required-mark">*</span></label><input id="secureStorageWorkerUrl" name="workerUrl" type="url" inputmode="url" value="${escapeHtml(profile.workerUrl)}" placeholder="https://lions-portal-anexos.sua-conta.workers.dev" required><small>Não informe chave do R2, Access Key ou segredo. O Portal precisa somente da URL pública do Worker.</small></div>
      <div class="admin-security-note full-row"><span aria-hidden="true">🔐</span><div><strong>Migração segura na publicação</strong><p>Anexos existentes serão enviados ao R2 e removidos de <code>public/treasury/</code> no mesmo commit. Se a publicação falhar, os arquivos novos são revertidos.</p></div></div>
      <div class="form-actions full-row"><button class="btn btn-ghost" id="testSecureStorage" type="button">Testar conexão</button><button class="btn btn-primary" type="submit">Salvar armazenamento privado</button></div>
    </form>` : ''}
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
    const directorWorkerMigrationRequired = directorProfileRequiresWorkerMigration(state());

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
      ${directorProfileCard(profile, writeAllowed, legacyDirectorProfile, directorWorkerMigrationRequired)}
      ${secureStorageCard(state(), writeAllowed)}
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

      const secureStorageForm = document.getElementById('secureStorageForm');
      const workerUrlInput = document.getElementById('secureStorageWorkerUrl');
      document.getElementById('testSecureStorage')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Testando…';
        try {
          const workerUrl = normalizeSecureStorageWorkerUrl(workerUrlInput?.value);
          await testSecureStorageConnection(workerUrl);
          toast({ type: 'success', title: 'Conexão validada', message: 'O Worker respondeu corretamente e está pronto para acessar o R2.' });
        } catch (error) {
          toast({ type: 'error', title: 'Falha na conexão', message: error?.message || 'Não foi possível validar o Worker.' });
        } finally {
          button.disabled = false;
          button.textContent = original;
        }
      });
      secureStorageForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const button = secureStorageForm.querySelector('button[type="submit"]');
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Validando…';
        try {
          const workerUrl = normalizeSecureStorageWorkerUrl(workerUrlInput?.value);
          await testSecureStorageConnection(workerUrl);
          state().settings.secureStorage = {
            version: 1,
            enabled: true,
            provider: 'cloudflare-r2',
            workerUrl
          };
          persist('Armazenamento privado de anexos configurado.');
          toast({ type: 'success', title: 'R2 configurado', message: 'Publique as alterações para migrar os anexos e remover as cópias públicas.' });
          render();
        } catch (error) {
          toast({ type: 'error', title: 'Configuração não salva', message: error?.message || 'Não foi possível validar o Worker.' });
          button.disabled = false;
          button.textContent = original;
          workerUrlInput?.focus();
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
