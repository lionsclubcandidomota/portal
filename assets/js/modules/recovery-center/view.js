import { RECOVERY_AREAS, SNAPSHOT_REASON_LABELS } from './domain.js?v=6.36.1';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatSize(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 ** 2)).toFixed(1)} MB`;
}

function diagnosticStatus(status) {
  if (status === 'error') return { label: 'Atenção necessária', icon: '!' };
  if (status === 'warning') return { label: 'Há recomendações', icon: '!' };
  return { label: 'Dados íntegros', icon: '✓' };
}

function snapshotCard(snapshot) {
  const integrity = snapshot.integrity?.valid === false ? 'is-invalid' : 'is-valid';
  const label = snapshot.label || SNAPSHOT_REASON_LABELS[snapshot.reason] || 'Ponto de recuperação';
  const summary = snapshot.summary || {};
  return `<article class="recovery-snapshot ${integrity}">
    <div class="recovery-snapshot-main"><span class="recovery-snapshot-icon" aria-hidden="true">${snapshot.reason === 'manual' ? '◆' : '↶'}</span><div><span class="recovery-snapshot-reason">${escapeHtml(SNAPSHOT_REASON_LABELS[snapshot.reason] || snapshot.reason)}</span><h4>${escapeHtml(label)}</h4><p>${formatDate(snapshot.createdAt)} · ${formatSize(snapshot.sizeBytes)}</p></div></div>
    <div class="recovery-snapshot-counts"><span><strong>${Number(summary.birthdays || 0)}</strong><small>associados</small></span><span><strong>${Number(summary.treasury || 0)}</strong><small>movimentações</small></span><span><strong>${Number(summary.events || 0) + Number(summary.meetings || 0)}</strong><small>agenda</small></span></div>
    ${snapshot.integrity?.valid === false ? `<p class="recovery-snapshot-error">Este ponto falhou na verificação de integridade e não pode ser restaurado.</p>` : ''}
    <div class="recovery-snapshot-actions"><button class="btn btn-primary btn-sm" type="button" data-recovery-restore="${escapeHtml(snapshot.id)}" ${snapshot.integrity?.valid === false ? 'disabled' : ''}>Restaurar</button><button class="btn btn-ghost btn-sm" type="button" data-recovery-export="${escapeHtml(snapshot.id)}">Baixar</button><button class="btn btn-ghost btn-sm" type="button" data-recovery-delete="${escapeHtml(snapshot.id)}">Excluir</button></div>
  </article>`;
}

function diagnosticChecks(diagnostic) {
  return diagnostic.checks.map(check => `<div class="recovery-check is-${escapeHtml(check.status)}"><span class="recovery-check-state" aria-hidden="true">${check.status === 'ok' ? '✓' : '!'}</span><div><strong>${escapeHtml(check.label)}</strong><p>${escapeHtml(check.detail)}</p></div></div>`).join('');
}

export function recoveryLoadingHtml() {
  return '<div class="recovery-loading"><span class="spinner" aria-hidden="true"></span><p>Preparando os pontos de recuperação…</p></div>';
}

function privateStatusMeta(status) {
  if (status === 'error') return { label: 'Correção necessária', icon: '!' };
  if (status === 'warning') return { label: 'Revisão recomendada', icon: '!' };
  if (status === 'ok') return { label: 'R2 íntegro', icon: '✓' };
  return { label: 'Aguardando verificação', icon: '…' };
}

function privateBackupReason(reason) {
  const labels = {
    migration: 'Migração inicial',
    publication: 'Estado publicado',
    'before-publication': 'Antes de uma publicação',
    automatic: 'Backup automático',
    manual: 'Backup manual',
    'before-restore': 'Antes de uma restauração',
    restored: 'Versão restaurada'
  };
  return labels[reason] || 'Backup privado';
}

function privateBackupCard(backup, canWrite) {
  const summary = backup.summary || {};
  return `<article class="recovery-cloud-backup">
    <div class="recovery-cloud-backup-main"><span aria-hidden="true">☁️</span><div><small>${escapeHtml(privateBackupReason(backup.reason))}</small><strong>${escapeHtml(backup.label || 'Estado privado do Portal')}</strong><p>${formatDate(backup.createdAt)} · ${formatSize(backup.size)}</p></div></div>
    <div class="recovery-cloud-backup-counts"><span><strong>${Number(summary.treasury || 0)}</strong><small>movimentações</small></span><span><strong>${Number(summary.attachments || 0)}</strong><small>anexos</small></span></div>
    ${canWrite ? `<button class="btn btn-ghost btn-sm" type="button" data-private-backup-restore="${escapeHtml(backup.key)}">Restaurar</button>` : '<span class="recovery-readonly-label">Somente leitura</span>'}
  </article>`;
}

function privateRecoverySection(remote = {}) {
  if (!remote.available) {
    return `<section class="recovery-cloud"><header><div><span class="section-eyebrow">Cloudflare R2</span><h3>Proteção do estado privado</h3></div></header><div class="recovery-cloud-empty"><span aria-hidden="true">☁️</span><div><strong>Disponível após entrar no painel</strong><p>Entre como Administrador ou Diretoria para verificar os dados privados, anexos e backups versionados.</p></div></div></section>`;
  }
  if (remote.loading) {
    return `<section class="recovery-cloud"><header><div><span class="section-eyebrow">Cloudflare R2</span><h3>Proteção do estado privado</h3></div></header><div class="recovery-loading"><span class="spinner" aria-hidden="true"></span><p>Verificando backups e anexos privados…</p></div></section>`;
  }
  if (remote.error) {
    return `<section class="recovery-cloud"><header><div><span class="section-eyebrow">Cloudflare R2</span><h3>Proteção do estado privado</h3></div><button class="btn btn-ghost btn-sm" id="refreshPrivateRecoveryBtn" type="button">Tentar novamente</button></header><div class="recovery-cloud-error"><span aria-hidden="true">!</span><div><strong>Não foi possível consultar o R2</strong><p>${escapeHtml(remote.error)}</p></div></div></section>`;
  }

  const integrity = remote.diagnostic || {};
  const status = privateStatusMeta(integrity.status);
  const attachments = integrity.attachments || {};
  const current = integrity.current || remote.current || {};
  const summary = current.summary || {};
  const problems = [...(integrity.errors || []), ...(integrity.warnings || [])];
  const missing = Array.isArray(attachments.missing) ? attachments.missing : [];
  const orphaned = Array.isArray(attachments.orphaned) ? attachments.orphaned : [];
  const backups = Array.isArray(remote.backups) ? remote.backups : [];

  return `<section class="recovery-cloud">
    <header><div><span class="section-eyebrow">Cloudflare R2</span><h3>Proteção do estado privado</h3><p>Backups automáticos, integridade da Tesouraria e conferência dos comprovantes.</p></div><div class="recovery-cloud-actions">${remote.canWrite ? '<button class="btn btn-primary btn-sm" id="createPrivateBackupBtn" type="button">＋ Criar backup no R2</button>' : ''}<button class="btn btn-ghost btn-sm" id="refreshPrivateRecoveryBtn" type="button">Verificar agora</button></div></header>
    <div class="recovery-cloud-overview">
      <div class="recovery-health is-${escapeHtml(integrity.status || 'warning')}"><span aria-hidden="true">${status.icon}</span><div><small>Integridade remota</small><strong>${status.label}</strong><p>${problems.length ? `${problems.length} observação(ões)` : 'Nenhuma inconsistência encontrada'}</p></div></div>
      <div class="recovery-stat"><small>Estado protegido</small><strong>${Number(summary.treasury || 0)} movimentações</strong><p>${Number(summary.accounts || 0)} contas · ${formatDate(current.updatedAt)}</p></div>
      <div class="recovery-stat"><small>Comprovantes</small><strong>${Number(attachments.existing || 0)} de ${Number(attachments.referenced || 0)}</strong><p>${missing.length ? `${missing.length} ausente(s)` : 'Todos localizados no R2'}</p></div>
      <div class="recovery-stat"><small>Backups versionados</small><strong>${backups.length}</strong><p>Retenção automática de até ${Number(remote.retention || 0)} versões</p></div>
    </div>
    ${problems.length ? `<div class="recovery-cloud-problems">${problems.map(item => `<p><span aria-hidden="true">!</span>${escapeHtml(item)}</p>`).join('')}</div>` : ''}
    ${missing.length ? `<details class="recovery-cloud-details"><summary>Anexos ausentes (${missing.length})</summary><ul>${missing.map(key => `<li>${escapeHtml(key)}</li>`).join('')}</ul></details>` : ''}
    ${orphaned.length ? `<details class="recovery-cloud-details"><summary>Objetos sem vínculo atual (${orphaned.length})</summary><ul>${orphaned.map(key => `<li>${escapeHtml(key)}</li>`).join('')}</ul></details>` : ''}
    <div class="recovery-cloud-backups"><header><div><strong>Linha do tempo privada</strong><p>Cada publicação gera uma versão restaurável antes de substituir o estado principal.</p></div><small>${backups.length} de ${Number(remote.retention || 0)} posição(ões)</small></header><div>${backups.length ? backups.map(item => privateBackupCard(item, remote.canWrite)).join('') : '<div class="recovery-empty"><span aria-hidden="true">☁️</span><h3>Nenhum backup remoto</h3><p>O primeiro será criado automaticamente na próxima publicação privada.</p></div>'}</div></div>
  </section>`;
}

export function recoveryCenterHtml({ snapshots, diagnostic, storageMode = '', storageEstimate = null, remote = null }) {
  const status = diagnosticStatus(diagnostic.status);
  const latest = snapshots[0] || null;
  const estimate = storageEstimate?.quota
    ? `${formatSize(storageEstimate.usage)} de ${formatSize(storageEstimate.quota)} em uso no navegador`
    : storageMode === 'indexeddb' ? 'Armazenamento amplo do navegador ativo' : 'Modo de armazenamento reduzido ativo';

  return `<section class="recovery-center">
    <div class="recovery-hero"><span class="recovery-hero-icon" aria-hidden="true">🛟</span><div><span class="section-eyebrow">Continuidade operacional</span><h3>Recuperação e integridade</h3><p>Crie pontos seguros, revise a consistência dos dados e restaure somente as áreas necessárias.</p></div></div>
    <div class="recovery-overview">
      <div class="recovery-health is-${escapeHtml(diagnostic.status)}"><span aria-hidden="true">${status.icon}</span><div><small>Diagnóstico atual</small><strong>${status.label}</strong><p>${diagnostic.errors} erro(s) · ${diagnostic.warnings} recomendação(ões)</p></div></div>
      <div class="recovery-stat"><small>Pontos armazenados</small><strong>${snapshots.length}</strong><p>${latest ? `Último em ${formatDate(latest.createdAt)}` : 'Nenhum ponto criado'}</p></div>
      <div class="recovery-stat"><small>Armazenamento</small><strong>${storageMode === 'indexeddb' ? 'Protegido' : 'Compatível'}</strong><p>${escapeHtml(estimate)}</p></div>
    </div>
    <div class="recovery-toolbar"><button class="btn btn-primary" id="createRecoverySnapshotBtn" type="button">＋ Criar ponto local</button><button class="btn btn-ghost" id="refreshRecoveryDiagnosticBtn" type="button">Diagnóstico local</button></div>
    ${privateRecoverySection(remote)}
    <section class="recovery-diagnostic"><header><div><span class="section-eyebrow">Verificação</span><h3>Integridade dos dados atuais</h3></div><small>Atualizado em ${formatDate(diagnostic.checkedAt)}</small></header><div class="recovery-check-list">${diagnosticChecks(diagnostic)}</div></section>
    <section class="recovery-snapshots"><header><div><span class="section-eyebrow">Linha de segurança</span><h3>Pontos de recuperação</h3></div><small>Os ${snapshots.length} ponto(s) mais recentes deste navegador</small></header><div class="recovery-snapshot-list">${snapshots.length ? snapshots.map(snapshotCard).join('') : '<div class="recovery-empty"><span aria-hidden="true">◇</span><h3>Nenhum ponto criado</h3><p>O portal criará cópias automáticas antes de importar, publicar, descartar ou recarregar dados.</p></div>'}</div></section>
    <footer class="recovery-note">Os pontos locais protegem alterações ainda não publicadas neste navegador. Os backups versionados do R2 protegem o estado privado já sincronizado.</footer>
  </section>`;
}

function areaOption(area, currentSummary, snapshotSummary) {
  const countKey = area.key === 'settings' ? '' : area.key;
  const currentCount = countKey ? Number(currentSummary?.[countKey] || 0) : 1;
  const snapshotCount = countKey ? Number(snapshotSummary?.[countKey] || 0) : 1;
  return `<label class="recovery-area-option"><input type="checkbox" name="recoveryArea" value="${escapeHtml(area.key)}" checked><span class="recovery-area-icon" aria-hidden="true">${area.icon}</span><span><strong>${escapeHtml(area.label)}</strong><small>${escapeHtml(area.description)}</small><em>Atual: ${currentCount} · Ponto: ${snapshotCount}</em></span></label>`;
}

export function recoveryRestoreHtml({ snapshot, currentSummary }) {
  return `<section class="recovery-restore">
    <button class="recovery-back" id="recoveryRestoreBack" type="button">← Voltar aos pontos</button>
    <div class="recovery-restore-header"><span aria-hidden="true">↶</span><div><span class="section-eyebrow">Restauração seletiva</span><h3>${escapeHtml(snapshot.label)}</h3><p>Criado em ${formatDate(snapshot.createdAt)}. Marque somente as áreas que devem voltar para esta versão.</p></div></div>
    <div class="recovery-restore-warning"><span aria-hidden="true">🛡️</span><p>Antes da restauração, o portal criará automaticamente um novo ponto com o estado atual. As áreas não selecionadas serão preservadas.</p></div>
    <form id="recoveryRestoreForm"><div class="recovery-area-grid">${RECOVERY_AREAS.map(area => areaOption(area, currentSummary, snapshot.summary)).join('')}</div><div class="recovery-restore-actions"><button class="btn btn-ghost" id="recoverySelectNone" type="button">Desmarcar todas</button><button class="btn btn-primary" type="submit">Restaurar áreas selecionadas</button></div></form>
  </section>`;
}
