import { RECOVERY_AREAS, SNAPSHOT_REASON_LABELS } from './domain.js?v=6.46.5';

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

export function recoveryCenterHtml({ snapshots, diagnostic, storageMode = '', storageEstimate = null }) {
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
    <div class="recovery-toolbar"><button class="btn btn-primary" id="createRecoverySnapshotBtn" type="button">＋ Criar ponto agora</button><button class="btn btn-ghost" id="refreshRecoveryDiagnosticBtn" type="button">Executar diagnóstico</button></div>
    <section class="recovery-diagnostic"><header><div><span class="section-eyebrow">Verificação</span><h3>Integridade dos dados atuais</h3></div><small>Atualizado em ${formatDate(diagnostic.checkedAt)}</small></header><div class="recovery-check-list">${diagnosticChecks(diagnostic)}</div></section>
    <section class="recovery-snapshots"><header><div><span class="section-eyebrow">Linha de segurança</span><h3>Pontos de recuperação</h3></div><small>Os ${snapshots.length} ponto(s) mais recentes deste navegador</small></header><div class="recovery-snapshot-list">${snapshots.length ? snapshots.map(snapshotCard).join('') : '<div class="recovery-empty"><span aria-hidden="true">◇</span><h3>Nenhum ponto criado</h3><p>O portal criará cópias automáticas antes de importar, publicar, descartar ou recarregar dados.</p></div>'}</div></section>
    <footer class="recovery-note">Os pontos ficam somente neste navegador. Backups automáticos não substituem a exportação periódica do arquivo JSON.</footer>
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
