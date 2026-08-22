import { escapeHtml } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.49.1';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

export function statusDistribution(groups, total, label) {
  if (!total) {
    return '<div class="admin-insight-empty"><span aria-hidden="true">◌</span><small>Nenhum registro no período</small></div>';
  }

  return `<div class="admin-status-chart" role="img" aria-label="${escapeHtml(label)}">${groups.map(group => {
    const percentage = (group.count / total) * 100;
    return `<span class="admin-status-segment is-${group.key}" style="width:${percentage.toFixed(2)}%" title="${escapeHtml(group.label)}: ${group.count}"></span>`;
  }).join('')}</div>`;
}

export function statusRows(groups) {
  if (!groups.length) return '';

  return `<div class="admin-status-list">${groups.map(group => `<div class="admin-status-row"><span class="admin-status-name"><i class="admin-status-dot is-${group.key}" aria-hidden="true"></i>${escapeHtml(group.label)}</span><strong>${group.count}</strong></div>`).join('')}</div>`;
}

export function moneyBar(label, count, value, type, maxValue) {
  const width = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 0;
  return `<div class="admin-money-row is-${type}"><div class="admin-money-row-heading"><span><i aria-hidden="true"></i>${escapeHtml(label)}</span><strong class="sensitive-money">${currency.format(value)}</strong></div><div class="admin-money-track" aria-hidden="true"><span style="width:${width.toFixed(2)}%"></span></div><small>${count} movimentaç${count === 1 ? 'ão' : 'ões'}</small></div>`;
}

export function adminLoginHtml() {
  return `<div class="card admin-login-card admin-login-refined">
    <div class="admin-login-hero"><span class="admin-login-icon" aria-hidden="true">${uiIcon('lock')}</span><div class="admin-login-heading"><span class="admin-eyebrow">Área restrita</span><h2>Acesso ao painel</h2><p>Escolha como deseja entrar e informe seus dados.</p></div></div>
    <div class="admin-access-switch has-three-options" role="tablist" aria-label="Perfil de acesso">
      <button class="btn btn-ghost admin-access-option is-active" id="adminAccessTab" type="button" role="tab" aria-selected="true" aria-controls="adminLoginForm" data-login-mode="admin"><span aria-hidden="true">${uiIcon('tools')}</span><strong>Administrador</strong></button>
      <button class="btn btn-ghost admin-access-option" id="userAccessTab" type="button" role="tab" aria-selected="false" aria-controls="userLoginForm" data-login-mode="user"><span aria-hidden="true">${uiIcon('users')}</span><strong>Usuário</strong></button>
      <button class="btn btn-ghost admin-access-option" id="directorAccessTab" type="button" role="tab" aria-selected="false" aria-controls="directorLoginForm" data-login-mode="director"><span aria-hidden="true">${uiIcon('eye')}</span><strong>Diretoria</strong></button>
    </div>
    <form id="adminLoginForm" class="admin-login-form" autocomplete="off" role="tabpanel" aria-labelledby="adminAccessTab">
      <div class="form-field"><label for="adminCredential">Credencial de acesso <span class="required-mark">*</span></label><div class="admin-token-field"><input id="adminCredential" name="credential" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" placeholder="Informe sua credencial de Administrador" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleAdminCredential" aria-label="Mostrar credencial" aria-pressed="false">Mostrar</button></div><small>Use a credencial fornecida para o Portal.</small></div>
      <div class="admin-login-actions"><button class="btn btn-primary admin-login-submit" type="submit">Entrar como Administrador</button></div>
    </form>
    <form id="userLoginForm" class="admin-login-form" autocomplete="off" role="tabpanel" aria-labelledby="userAccessTab" hidden>
      <div class="form-grid"><div class="form-field"><label for="portalUsername">Usuário <span class="required-mark">*</span></label><input id="portalUsername" name="portalUsername" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Seu nome de usuário" required disabled></div><div class="form-field"><label for="portalUserPassword">Senha <span class="required-mark">*</span></label><div class="admin-token-field"><input id="portalUserPassword" name="portalUserPassword" type="password" autocomplete="current-password" placeholder="Informe sua senha" required disabled><button type="button" class="btn btn-ghost admin-token-toggle" id="togglePortalUserPassword" aria-label="Mostrar senha" aria-pressed="false" disabled>Mostrar</button></div></div></div>
      <div class="admin-login-actions"><button class="btn btn-primary admin-login-submit" type="submit">Entrar com meu usuário</button></div>
    </form>
    <form id="directorLoginForm" class="admin-login-form" autocomplete="off" role="tabpanel" aria-labelledby="directorAccessTab" hidden>
      <div class="form-field"><label for="directorPassword">Senha da Diretoria <span class="required-mark">*</span></label><div class="admin-token-field"><input id="directorPassword" name="directorAccessPassword" type="password" value="" autocomplete="new-password" autocapitalize="none" spellcheck="false" placeholder="Informe a senha da Diretoria" data-lpignore="true" data-1p-ignore="true" data-form-type="other" required disabled><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleDirectorPassword" aria-label="Mostrar senha" aria-pressed="false" disabled>Mostrar</button></div></div>
      <div class="admin-login-actions"><button class="btn btn-primary admin-login-submit" type="submit">Entrar como Diretoria</button></div>
    </form>
  </div>`;
}

export function adminDashboardHtml(model, { financePrivacyButton = '', auditSummary = null, recoverySummary = null, canWrite = true, accessRole = 'admin', accessPolicy = null } = {}) {
  const treasury = model.treasury;
  const directorMode = accessRole === 'director';
  const userMode = accessRole === 'user';
  const userName = accessPolicy?.user?.name || '';
  const roleName = accessPolicy?.user?.roleName || accessPolicy?.label || 'Usuário';
  const dashboardTitle = directorMode ? 'Área da Diretoria' : userMode ? 'Meu painel' : 'Área administrativa';
  const sessionLabel = directorMode ? 'Diretoria · leitura' : userMode ? `${userName || 'Usuário'} · ${roleName}` : 'Administrador conectado';
  const customHidden = model.customPeriodVisible ? '' : 'hidden';
  const directorNotice = directorMode
    ? `<div class="notice medium"><strong>${uiIcon('eye')} Somente leitura</strong><p>Você pode consultar e exportar, mas não alterar dados.</p></div>`
    : userMode && accessPolicy?.readOnly
      ? `<div class="notice medium"><strong>${uiIcon('eye')} Acesso de consulta</strong><p>Seu cargo permite consultar informações, sem realizar alterações.</p></div>`
      : userMode && canWrite
        ? `<div class="notice medium"><strong>${uiIcon('users')} Acesso individual</strong><p>As alterações ficam pendentes até serem publicadas pelo Administrador.</p></div>`
        : '';
  const canManagePeople = accessPolicy?.canManagePeople ?? canWrite;
  const canManageAgenda = accessPolicy?.canManageAgenda ?? canWrite;
  const canManageNotices = accessPolicy?.canManageNotices ?? canWrite;
  const canManageTreasury = accessPolicy?.canManageTreasury ?? canWrite;
  const canExportReports = accessPolicy?.canExportReports ?? true;
  const canManageUsers = accessPolicy?.canManageUsers ?? accessRole === 'admin';
  const canImport = accessPolicy?.canImport ?? accessRole === 'admin';
  const canManageBackups = accessRole === 'admin';
  const addMovementButton = canManageTreasury
    ? `<button class="btn btn-primary btn-sm" data-add="treasury" type="button">${uiIcon('plus')} Adicionar</button>`
    : '';
  const addEventButton = canManageAgenda
    ? `<button class="btn btn-primary btn-sm" data-add="event" type="button">${uiIcon('plus')} Adicionar evento</button>`
    : '';
  const addMeetingButton = canManageAgenda
    ? `<button class="btn btn-primary btn-sm" data-add="meeting" type="button">${uiIcon('plus')} Adicionar reunião</button>`
    : '';
  const addBirthdayButton = canManagePeople
    ? `<button class="btn btn-primary btn-sm" data-add="birthday" type="button">${uiIcon('plus')} Adicionar</button>`
    : '';
  const addNoticeButton = canManageNotices
    ? `<button class="btn btn-primary btn-sm" data-add="notice" type="button">${uiIcon('plus')} Adicionar aviso</button>`
    : '';
  const recoveryButton = canImport
    ? '<button class="btn btn-primary btn-sm" id="openRecoveryCenterBtn" type="button">Ver backups</button>'
    : '<span class="badge badge-muted">Somente Administrador</span>';
  const importButton = canImport
    ? `<button class="admin-backup-action" id="importBtn" type="button"><span>${uiIcon('upload')}</span><div><strong>Restaurar backup</strong><small>Usar uma cópia salva</small></div></button>`
    : '';

  return `
    <section class="admin-command-header admin-dashboard-header">
      <div><span class="admin-eyebrow">Administração</span><h2>${dashboardTitle}</h2><p>Veja os números principais e acesse os cadastros.</p>${directorNotice}</div>
      <div class="admin-session-box"><span class="admin-session-dot"></span><div><strong>${sessionLabel}</strong><small>${userMode ? escapeHtml(roleName) : 'lionsclubcandidomota.github.io/portal'}</small></div><button class="btn btn-ghost btn-sm" id="logoutInlineBtn" type="button">Sair</button></div>
    </section>

    <section class="admin-period-panel" aria-label="Filtro de período do dashboard">
      <div class="admin-period-copy"><span class="admin-period-icon" aria-hidden="true">${uiIcon('calendar')}</span><div><small>Período</small><strong>${escapeHtml(model.selectedPeriodLabel)}</strong></div></div>
      <div class="admin-period-controls">
        <label class="admin-period-select"><span>Mostrar</span><select id="adminPeriodPreset">
          <option value="current-month" ${model.periodPreset === 'current-month' ? 'selected' : ''}>Este mês</option>
          <option value="previous-month" ${model.periodPreset === 'previous-month' ? 'selected' : ''}>Mês anterior</option>
          <option value="current-quarter" ${model.periodPreset === 'current-quarter' ? 'selected' : ''}>Trimestre atual</option>
          <option value="current-year" ${model.periodPreset === 'current-year' ? 'selected' : ''}>Ano atual</option>
          <option value="all" ${model.periodPreset === 'all' ? 'selected' : ''}>Todo o período</option>
          <option value="custom" ${model.periodPreset === 'custom' ? 'selected' : ''}>Personalizado</option>
        </select></label>
        <div class="admin-custom-period" ${customHidden}>
          <label><span>De</span><input id="adminPeriodStart" type="date" value="${escapeHtml(model.customStart)}" aria-label="Data inicial do período personalizado"></label>
          <label><span>Até</span><input id="adminPeriodEnd" type="date" value="${escapeHtml(model.customEnd)}" aria-label="Data final do período personalizado"></label>
          <button class="btn btn-primary btn-sm admin-period-apply" id="adminPeriodApply" type="button">Aplicar</button>
        </div>
      </div>
    </section>

    <section class="admin-insight-grid">
      <article class="admin-insight-card admin-treasury-insight">
        <div class="admin-insight-heading"><div class="admin-insight-title"><span class="admin-module-icon">${uiIcon('wallet')}</span><div><span class="admin-insight-eyebrow">Finanças</span><h3>Resumo do período</h3></div></div><div class="admin-insight-heading-actions">${financePrivacyButton}<div class="admin-insight-total"><strong>${treasury.total}</strong><small>total</small></div></div></div>
        <div class="admin-balance-highlight ${treasury.balance < 0 ? 'is-negative' : ''}"><small>Saldo do período</small><strong class="sensitive-money">${currency.format(treasury.balance)}</strong><span>Entradas − saídas</span></div>
        <div class="admin-money-chart">
          ${moneyBar('Entradas', treasury.entries.length, treasury.entriesValue, 'entry', treasury.maxValue)}
          ${moneyBar('Saídas', treasury.exits.length, treasury.exitsValue, 'exit', treasury.maxValue)}
        </div>
        <div class="admin-insight-actions">${addMovementButton}<button class="btn btn-ghost btn-sm" data-manage="treasury" type="button">Ver tesouraria</button></div>
      </article>

      <article class="admin-insight-card admin-agenda-insight">
        <div class="admin-insight-heading"><div class="admin-insight-title"><span class="admin-module-icon">${uiIcon('calendar')}</span><div><span class="admin-insight-eyebrow">Agenda</span><h3>Eventos</h3></div></div><div class="admin-insight-total"><strong>${model.events.items.length}</strong><small>total</small></div></div>
        ${statusDistribution(model.events.groups, model.events.items.length, `Distribuição de ${model.events.items.length} eventos por status`)}
        ${statusRows(model.events.groups)}
        <div class="admin-insight-actions">${addEventButton}<button class="btn btn-ghost btn-sm" data-manage="agenda" type="button">Ver agenda</button></div>
      </article>

      <article class="admin-insight-card admin-meeting-insight">
        <div class="admin-insight-heading"><div class="admin-insight-title"><span class="admin-module-icon">${uiIcon('handshake')}</span><div><span class="admin-insight-eyebrow">Agenda</span><h3>Reuniões</h3></div></div><div class="admin-insight-total"><strong>${model.meetings.items.length}</strong><small>total</small></div></div>
        ${statusDistribution(model.meetings.groups, model.meetings.items.length, `Distribuição de ${model.meetings.items.length} compromissos por status`)}
        ${statusRows(model.meetings.groups)}
        <div class="admin-insight-actions">${addMeetingButton}<button class="btn btn-ghost btn-sm" data-manage="agenda" type="button">Ver agenda</button></div>
      </article>
    </section>

    <section class="admin-support-grid">
      <article class="admin-support-card admin-people-support-card"><div class="admin-support-main"><span class="admin-module-icon">${uiIcon('cake')}</span><div><span class="admin-insight-eyebrow">Pessoas</span><div class="admin-people-counts" aria-label="${model.birthdayAssociateCount} associado(s) e ${model.birthdayMutualCount} mutuário(s)"><span class="admin-people-count"><strong>${model.birthdayAssociateCount}</strong><small>Associado(s)</small></span><span class="admin-people-count is-mutual"><strong>${model.birthdayMutualCount}</strong><small>Mutuário(s)</small></span></div><p>Consulte pessoas e datas de aniversário.</p></div></div><div class="admin-support-actions">${addBirthdayButton}<button class="btn btn-ghost btn-sm" data-manage="birthdays" type="button">Ver pessoas</button></div></article>
      <article class="admin-support-card"><div class="admin-support-main"><span class="admin-module-icon">${uiIcon('megaphone')}</span><div><span class="admin-insight-eyebrow">Avisos</span><h3>${model.noticeCount} aviso(s)</h3><p>Crie e consulte comunicados.</p></div></div><div class="admin-support-actions">${addNoticeButton}<button class="btn btn-ghost btn-sm" data-manage="notices" type="button">Ver avisos</button></div></article>
    </section>

    ${canExportReports ? `    <section class="card admin-report-center" aria-labelledby="adminReportTitle">
      <div class="admin-report-heading"><span class="admin-card-icon" aria-hidden="true">${uiIcon('file-text')}</span><div><span class="admin-insight-eyebrow">Relatórios</span><h3 id="adminReportTitle">Gerar relatório</h3><p>Escolha o conteúdo e exporte em PDF ou CSV.</p></div></div>
      <div class="admin-report-controls">
        <label class="admin-report-type"><span>Conteúdo</span><select id="adminReportType">
          <option value="movements">Movimentações financeiras</option>
          <option value="memberships">Mensalidades</option>
          <option value="mutuals">Mútuas</option>
          <option value="birthdays">Aniversariantes</option>
          <option value="agenda">Agenda</option>
          <option value="notices">Avisos</option>
        </select></label>
        <div class="admin-report-period"><small>Período aplicado</small><strong>${escapeHtml(model.selectedPeriodLabel)}</strong></div>
        <div class="admin-report-actions"><button class="btn btn-primary" id="generateReportPrint" type="button">${uiIcon('printer')} Abrir PDF</button><button class="btn btn-ghost" id="generateReportCsv" type="button">${uiIcon('download')} Baixar CSV</button></div>
      </div>
    </section>` : ''}

    <section class="admin-operation-grid">
      ${canManageBackups ? `<article class="card admin-backup-card admin-backup-card-wide">
        <div class="admin-card-heading"><span class="admin-card-icon">${uiIcon('lifebuoy')}</span><div><h3>Backup e recuperação</h3><p>Baixe uma cópia ou restaure dados quando necessário.</p></div></div>
        <div class="admin-recovery-summary"><span class="is-${escapeHtml(recoverySummary?.diagnosticStatus || 'ok')}">${recoverySummary?.diagnosticStatus === 'error' ? '!' : recoverySummary?.diagnosticStatus === 'warning' ? '!' : '✓'}</span><div><strong>${Number(recoverySummary?.snapshots || 0)} ponto(s) de recuperação</strong><small>${recoverySummary?.latestAt ? `Último criado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(recoverySummary.latestAt))}` : 'O portal criará cópias antes de operações críticas'}</small></div>${recoveryButton}</div>
        <div class="admin-backup-options"><button class="admin-backup-action" id="exportBtn" type="button"><span>${uiIcon('download')}</span><div><strong>Baixar backup</strong><small>Salvar uma cópia dos dados</small></div></button>${importButton}</div>
      </article>` : ''}
      <article class="admin-audit-card">
        <div class="admin-audit-main"><span class="admin-module-icon" aria-hidden="true">${uiIcon('history')}</span><div><span class="admin-insight-eyebrow">Atividade</span><h3>Histórico de alterações</h3><p>${auditSummary?.latestAction ? `Última operação: ${escapeHtml(auditSummary.latestAction)}` : 'As alterações feitas neste navegador aparecem aqui.'}</p></div></div>
        <div class="admin-audit-stats"><div class="admin-audit-stat"><strong>${Number(auditSummary?.operations || 0)}</strong><small>operações</small></div><div class="admin-audit-stat"><strong>${Number(auditSummary?.pendingBatches || 0)}</strong><small>pendentes</small></div></div>
        <div class="admin-audit-actions"><button class="btn btn-primary btn-sm" id="openAuditLogBtn" type="button">Ver histórico</button></div>
      </article>
      ${canManageUsers ? `<article class="admin-audit-card admin-access-card"><div class="admin-audit-main"><span class="admin-module-icon" aria-hidden="true">${uiIcon('users')}</span><div><span class="admin-insight-eyebrow">Acessos</span><h3>Usuários e cargos</h3><p>Crie acessos individuais e defina permissões por responsabilidade.</p></div></div><div class="admin-audit-stats"><div class="admin-audit-stat"><strong>${Number(model.userCount || 0)}</strong><small>usuários</small></div><div class="admin-audit-stat"><strong>${Number(model.roleCount || 0)}</strong><small>cargos</small></div></div><div class="admin-audit-actions"><button class="btn btn-primary btn-sm" id="openAccessManagementBtn" type="button">Gerenciar acessos</button></div></article>` : ''}
    </section>`;
}
