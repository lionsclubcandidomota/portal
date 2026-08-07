import { escapeHtml } from '../../utils.js';

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
    <div class="admin-login-hero"><span class="admin-login-icon" aria-hidden="true">🔐</span><div class="admin-login-heading"><span class="admin-eyebrow">Área restrita</span><h2>Acesso ao painel</h2><p>Entre com a credencial correspondente ao seu perfil.</p></div></div>
    <div class="admin-access-switch" role="tablist" aria-label="Perfil de acesso">
      <button class="btn btn-ghost admin-access-option is-active" id="adminAccessTab" type="button" role="tab" aria-selected="true" aria-controls="adminLoginForm" data-login-mode="admin"><span aria-hidden="true">🛠️</span><strong>Administrador</strong></button>
      <button class="btn btn-ghost admin-access-option" id="directorAccessTab" type="button" role="tab" aria-selected="false" aria-controls="directorLoginForm" data-login-mode="director"><span aria-hidden="true">👁️</span><strong>Diretoria</strong></button>
    </div>
    <form id="adminLoginForm" class="admin-login-form" autocomplete="on" role="tabpanel" aria-labelledby="adminAccessTab">
      <div class="admin-security-note admin-auth-status" id="adminAuthStatus" role="status" aria-live="polite"><span aria-hidden="true">○</span><div><strong>Verificando autenticação do banco…</strong><small>Aguarde a consulta ao Cloudflare Worker.</small></div></div>
      <div class="form-field"><label for="adminUsername">Usuário <span class="required-mark">*</span></label><input id="adminUsername" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" placeholder="Informe o usuário" required></div>
      <div class="form-field"><label for="adminPassword">Senha <span class="required-mark">*</span></label><div class="admin-token-field"><input id="adminPassword" name="password" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" maxlength="128" placeholder="Informe a senha" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleAdminPassword" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div></div>
      <div class="admin-login-actions"><button class="btn btn-primary admin-login-submit" type="submit">Entrar como Administrador</button></div>
      <button class="btn btn-ghost btn-sm admin-first-access-toggle" id="toggleAdminBootstrap" type="button" aria-expanded="false" aria-controls="adminBootstrapForm">Primeiro acesso: criar Administrador</button>
    </form>
    <form id="adminBootstrapForm" class="admin-login-form admin-bootstrap-form" autocomplete="off" aria-label="Configuração do primeiro Administrador" hidden>
      <div class="admin-security-note admin-bootstrap-heading"><span aria-hidden="true">🧩</span><div><strong>Configuração inicial</strong><small>Use o código ADMIN_BOOTSTRAP_KEY configurado no Worker. Esta operação só funciona enquanto não existir Administrador.</small></div></div>
      <div class="form-field"><label for="adminSetupKey">Código de ativação <span class="required-mark">*</span></label><div class="admin-token-field"><input id="adminSetupKey" name="setupKey" type="password" autocomplete="off" minlength="24" maxlength="256" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleAdminSetupKey" aria-label="Mostrar código de ativação" aria-pressed="false">Mostrar</button></div></div>
      <div class="form-field"><label for="adminDisplayName">Nome exibido <span class="required-mark">*</span></label><input id="adminDisplayName" name="displayName" type="text" maxlength="100" placeholder="Ex.: João Augusto" required></div>
      <div class="form-field"><label for="adminBootstrapUsername">Usuário <span class="required-mark">*</span></label><input id="adminBootstrapUsername" name="username" type="text" autocapitalize="none" spellcheck="false" minlength="3" maxlength="64" placeholder="Ex.: administrador" required></div>
      <div class="form-field"><label for="adminBootstrapPassword">Senha <span class="required-mark">*</span></label><div class="admin-token-field"><input id="adminBootstrapPassword" name="password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleAdminBootstrapPassword" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div><small>Mínimo de 10 caracteres, contendo uma letra e um número.</small></div>
      <div class="form-field"><label for="adminBootstrapConfirm">Confirmar senha <span class="required-mark">*</span></label><input id="adminBootstrapConfirm" name="passwordConfirmation" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></div>
      <div class="admin-login-actions"><button class="btn btn-primary admin-login-submit" type="submit">Criar primeiro Administrador</button></div>
    </form>
    <form id="directorLoginForm" class="admin-login-form" autocomplete="off" role="tabpanel" aria-labelledby="directorAccessTab" hidden>
      <div class="form-field"><label for="directorPassword">Senha da Diretoria <span class="required-mark">*</span></label><div class="admin-token-field"><input id="directorPassword" name="directorAccessPassword" type="password" value="" autocomplete="current-password" autocapitalize="none" spellcheck="false" placeholder="Informe a senha da Diretoria" data-lpignore="true" data-1p-ignore="true" data-form-type="other" required disabled><button type="button" class="btn btn-ghost admin-token-toggle" id="toggleDirectorPassword" aria-label="Mostrar senha" aria-pressed="false" disabled>Mostrar</button></div></div>
      <div class="admin-login-actions"><button class="btn btn-primary admin-login-submit" type="submit">Entrar como Diretoria</button></div>
    </form>
  </div>`;
}


export function adminDashboardHtml(model, { financePrivacyButton = '', auditSummary = null, recoverySummary = null, canWrite = true, accessRole = 'admin' } = {}) {
  const treasury = model.treasury;
  const directorMode = accessRole === 'director';
  const dashboardTitle = directorMode ? 'Dashboard Diretoria' : 'Dashboard Administrativo';
  const sessionLabel = directorMode ? 'Diretoria · somente leitura' : 'Portal conectado';
  const customHidden = model.customPeriodVisible ? '' : 'hidden';
  const treasuryEntryCount = Number.isFinite(Number(treasury.entryCount)) ? Number(treasury.entryCount) : treasury.entries.length;
  const treasuryExitCount = Number.isFinite(Number(treasury.exitCount)) ? Number(treasury.exitCount) : treasury.exits.length;
  const treasurySource = treasury.dataSource === 'd1'
    ? `<span class="admin-data-source is-d1" title="Consulta SQL concluída em ${Math.max(0, Number(treasury.queryDurationMs || 0))} ms">D1 · consulta otimizada</span>`
    : '<span class="admin-data-source">Dados locais</span>'; 

  return `
    <section class="admin-command-header admin-dashboard-header">
      <div><span class="admin-eyebrow">Visão gerencial</span><h2>${dashboardTitle}</h2><p>Acompanhe os principais indicadores do clube e identifique rapidamente o que exige atenção.</p>${directorMode ? '<div class="notice medium"><strong>👁️ Acesso somente leitura</strong><p>Consultas, filtros, relatórios e exportações estão liberados. Alterações permanecem bloqueadas.</p></div>' : ''}</div>
      <div class="admin-session-box"><span class="admin-session-dot"></span><div><strong>${sessionLabel}</strong><small>Cloudflare D1 · dados operacionais</small></div><button class="btn btn-ghost btn-sm" id="logoutInlineBtn" type="button">Sair</button></div>
    </section>

    <section class="admin-period-panel" aria-label="Filtro de período do dashboard">
      <div class="admin-period-copy"><span class="admin-period-icon" aria-hidden="true">🗓️</span><div><small>Período analisado</small><strong>${escapeHtml(model.selectedPeriodLabel)}</strong></div></div>
      <div class="admin-period-controls">
        <label class="admin-period-select"><span>Visualizar</span><select id="adminPeriodPreset">
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
          <button class="btn btn-primary btn-sm admin-period-apply" id="adminPeriodApply" type="button">Aplicar período</button>
        </div>
      </div>
    </section>

    <section class="admin-insight-grid">
      <article class="admin-insight-card admin-treasury-insight">
        <div class="admin-insight-heading"><div class="admin-insight-title"><span class="admin-module-icon">💰</span><div><span class="admin-insight-eyebrow">Tesouraria</span><h3>Movimentações do período</h3>${treasurySource}</div></div><div class="admin-insight-heading-actions">${financePrivacyButton}<div class="admin-insight-total"><strong>${treasury.total}</strong><small>total</small></div></div></div>
        <div class="admin-balance-highlight ${treasury.balance < 0 ? 'is-negative' : ''}"><small>Saldo do período</small><strong class="sensitive-money">${currency.format(treasury.balance)}</strong><span>Entradas − saídas</span></div>
        <div class="admin-money-chart">
          ${moneyBar('Entradas', treasuryEntryCount, treasury.entriesValue, 'entry', treasury.maxValue)}
          ${moneyBar('Saídas', treasuryExitCount, treasury.exitsValue, 'exit', treasury.maxValue)}
        </div>
        <div class="admin-insight-actions">${canWrite ? '<button class="btn btn-primary btn-sm" data-add="treasury" type="button">＋ Novo lançamento</button>' : ''}<button class="btn btn-ghost btn-sm" data-manage="treasury" type="button">Abrir tesouraria</button></div>
      </article>

      <article class="admin-insight-card admin-agenda-insight">
        <div class="admin-insight-heading"><div class="admin-insight-title"><span class="admin-module-icon">🗓️</span><div><span class="admin-insight-eyebrow">Agenda</span><h3>Situação dos eventos</h3></div></div><div class="admin-insight-total"><strong>${model.events.items.length}</strong><small>total</small></div></div>
        ${statusDistribution(model.events.groups, model.events.items.length, `Distribuição de ${model.events.items.length} eventos por status`)}
        ${statusRows(model.events.groups)}
        <div class="admin-insight-actions">${canWrite ? '<button class="btn btn-primary btn-sm" data-add="event" type="button">＋ Novo evento</button>' : ''}<button class="btn btn-ghost btn-sm" data-manage="agenda" type="button">Abrir agenda</button></div>
      </article>

      <article class="admin-insight-card admin-meeting-insight">
        <div class="admin-insight-heading"><div class="admin-insight-title"><span class="admin-module-icon">🤝</span><div><span class="admin-insight-eyebrow">Compromissos</span><h3>Situação das reuniões</h3></div></div><div class="admin-insight-total"><strong>${model.meetings.items.length}</strong><small>total</small></div></div>
        ${statusDistribution(model.meetings.groups, model.meetings.items.length, `Distribuição de ${model.meetings.items.length} compromissos por status`)}
        ${statusRows(model.meetings.groups)}
        <div class="admin-insight-actions">${canWrite ? '<button class="btn btn-primary btn-sm" data-add="meeting" type="button">＋ Novo compromisso</button>' : ''}<button class="btn btn-ghost btn-sm" data-manage="agenda" type="button">Ver compromissos</button></div>
      </article>
    </section>

    <section class="admin-support-grid">
      <article class="admin-support-card admin-people-support-card"><div class="admin-support-main"><span class="admin-module-icon">🎂</span><div><span class="admin-insight-eyebrow">Aniversariantes</span><div class="admin-people-counts" aria-label="${model.birthdayAssociateCount} associado(s) e ${model.birthdayMutualCount} mutuário(s)"><span class="admin-people-count"><strong>${model.birthdayAssociateCount}</strong><small>Associado(s)</small></span><span class="admin-people-count is-mutual"><strong>${model.birthdayMutualCount}</strong><small>Mutuário(s)</small></span></div><p>Gerencie associados, mutuários e suas datas comemorativas.</p></div></div><div class="admin-support-actions">${canWrite ? '<button class="btn btn-primary btn-sm" data-add="birthday" type="button">＋ Cadastrar</button>' : ''}<button class="btn btn-ghost btn-sm" data-manage="birthdays" type="button">Ver cadastros</button></div></article>
      <article class="admin-support-card"><div class="admin-support-main"><span class="admin-module-icon">📢</span><div><span class="admin-insight-eyebrow">Avisos</span><h3>${model.noticeCount} aviso(s)</h3><p>Cadastre comunicados e acompanhe as prioridades.</p></div></div><div class="admin-support-actions">${canWrite ? '<button class="btn btn-primary btn-sm" data-add="notice" type="button">＋ Novo aviso</button>' : ''}<button class="btn btn-ghost btn-sm" data-manage="notices" type="button">Ver avisos</button></div></article>
    </section>

    <section class="card admin-report-center" aria-labelledby="adminReportTitle">
      <div class="admin-report-heading"><span class="admin-card-icon" aria-hidden="true">📄</span><div><span class="admin-insight-eyebrow">Documentos gerenciais</span><h3 id="adminReportTitle">Central de relatórios</h3><p>Gere documentos usando o período selecionado acima. Relatórios financeiros consultam somente o recorte necessário no D1; a visualização de impressão também permite salvar em PDF.</p></div></div>
      <div class="admin-report-controls">
        <label class="admin-report-type"><span>Tipo de relatório</span><select id="adminReportType">
          <option value="movements">Movimentações financeiras</option>
          <option value="memberships">Mensalidades</option>
          <option value="mutuals">Mútuas</option>
          <option value="birthdays">Aniversariantes</option>
          <option value="agenda">Agenda</option>
          <option value="notices">Avisos</option>
        </select></label>
        <div class="admin-report-period"><small>Período aplicado</small><strong>${escapeHtml(model.selectedPeriodLabel)}</strong></div>
        <div class="admin-report-actions"><button class="btn btn-primary" id="generateReportPrint" type="button">🖨️ Visualizar / PDF</button><button class="btn btn-ghost" id="generateReportCsv" type="button">⬇️ Exportar CSV</button></div>
      </div>
    </section>

    <section class="admin-operation-grid">
      <article class="card admin-backup-card admin-backup-card-wide">
        <div class="admin-card-heading"><span class="admin-card-icon">🛟</span><div><h3>Recuperação e continuidade</h3><p>Exporte dados, importe uma cópia ou restaure áreas específicas usando pontos automáticos.</p></div></div>
        <div class="admin-recovery-summary"><span class="is-${escapeHtml(recoverySummary?.diagnosticStatus || 'ok')}">${recoverySummary?.diagnosticStatus === 'error' ? '!' : recoverySummary?.diagnosticStatus === 'warning' ? '!' : '✓'}</span><div><strong>${Number(recoverySummary?.snapshots || 0)} ponto(s) de recuperação</strong><small>${recoverySummary?.latestAt ? `Último criado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(recoverySummary.latestAt))}` : 'O portal criará cópias antes de operações críticas'}</small></div>${canWrite ? '<button class="btn btn-primary btn-sm" id="openRecoveryCenterBtn" type="button">Abrir recuperação</button>' : '<span class="badge badge-muted">Somente Administrador</span>'}</div>
        <div class="admin-backup-options"><button class="admin-backup-action" id="exportBtn" type="button"><span>⬇️</span><div><strong>Exportar JSON</strong><small>Baixar uma cópia externa</small></div></button>${canWrite ? '<button class="admin-backup-action" id="importBtn" type="button"><span>⬆️</span><div><strong>Importar JSON</strong><small>Substituir dados com proteção automática</small></div></button>' : ''}</div>
      </article>
      <article class="admin-audit-card">
        <div class="admin-audit-main"><span class="admin-module-icon" aria-hidden="true">◷</span><div><span class="admin-insight-eyebrow">Observabilidade</span><h3>Histórico de alterações</h3><p>${auditSummary?.latestAction ? `Última operação: ${escapeHtml(auditSummary.latestAction)}` : 'As operações administrativas realizadas neste navegador aparecerão aqui.'}</p></div></div>
        <div class="admin-audit-stats"><div class="admin-audit-stat"><strong>${Number(auditSummary?.operations || 0)}</strong><small>operações</small></div><div class="admin-audit-stat"><strong>${Number(auditSummary?.pendingBatches || 0)}</strong><small>pendentes</small></div></div>
        <div class="admin-audit-actions"><button class="btn btn-primary btn-sm" id="openAuditLogBtn" type="button">Abrir histórico</button></div>
      </article>
    </section>`;
}
