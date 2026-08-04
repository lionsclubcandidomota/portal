const STATUS_LABELS = Object.freeze({
  pending: 'Pendente',
  published: 'Enviada ao GitHub',
  confirmed: 'Publicada no portal',
  discarded: 'Descartada',
  replaced: 'Substituída'
});

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

function initials(actor) {
  const source = actor?.name || actor?.login || 'A';
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'A';
}

function renderField(type, field) {
  return `<div class="audit-field"><strong>${escapeHtml(field.label)}</strong><div class="audit-field-values">
    ${type !== 'added' ? `<span><small>Antes</small>${escapeHtml(field.before)}</span>` : ''}
    ${type === 'updated' ? '<i aria-hidden="true">→</i>' : ''}
    ${type !== 'removed' ? `<span class="is-after"><small>${type === 'added' ? 'Incluído' : 'Depois'}</small>${escapeHtml(field.after)}</span>` : ''}
  </div></div>`;
}

function renderOperation(entry) {
  return `<details class="audit-operation">
    <summary><span class="audit-operation-dot" aria-hidden="true"></span><span><strong>${escapeHtml(entry.action)}</strong><small>${formatDate(entry.createdAt)} · ${entry.review.total} alteração(ões)</small></span><span class="audit-operation-chevron" aria-hidden="true">⌄</span></summary>
    <div class="audit-operation-body">${entry.review.groups.map(group => `<section class="audit-area"><header><span aria-hidden="true">${escapeHtml(group.icon)}</span><div><strong>${escapeHtml(group.title)}</strong><small>${group.changes.length} registro(s)</small></div></header>${group.changes.map(change => `<article class="audit-change is-${escapeHtml(change.type)}"><div><span>${change.type === 'added' ? 'Adicionado' : change.type === 'removed' ? 'Removido' : 'Atualizado'}</span><strong>${escapeHtml(change.title)}</strong>${change.description ? `<small>${escapeHtml(change.description)}</small>` : ''}</div>${change.fields.length ? `<div class="audit-fields">${change.fields.map(field => renderField(change.type, field)).join('')}</div>` : ''}</article>`).join('')}</section>`).join('')}</div>
  </details>`;
}

function renderBatch(batch) {
  const actorLabel = batch.actor.login && batch.actor.login !== batch.actor.name
    ? `${batch.actor.name} (@${batch.actor.login})`
    : batch.actor.name;
  const commitLink = batch.publication?.commitUrl
    ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(batch.publication.commitUrl)}" target="_blank" rel="noopener noreferrer">Ver commit</a>`
    : '';
  const outcome = batch.outcome?.reason ? `<p class="audit-batch-outcome">${escapeHtml(batch.outcome.reason)}</p>` : '';

  return `<article class="audit-batch is-${escapeHtml(batch.status)}">
    <header class="audit-batch-header"><div class="audit-actor"><span>${escapeHtml(initials(batch.actor))}</span><div><strong>${escapeHtml(actorLabel)}</strong><small>${formatDate(batch.createdAt)}</small></div></div><span class="audit-status is-${escapeHtml(batch.status)}">${escapeHtml(STATUS_LABELS[batch.status] || batch.status)}</span></header>
    <div class="audit-batch-summary"><div><strong>${batch.operations}</strong><small>operações</small></div><div><strong>${batch.changes}</strong><small>registros alterados</small></div>${batch.publication?.commitSha ? `<div><strong>${escapeHtml(batch.publication.commitSha.slice(0, 7))}</strong><small>commit</small></div>` : ''}</div>
    ${outcome}
    <div class="audit-operations">${batch.entries.map(renderOperation).join('')}</div>
    ${commitLink ? `<footer class="audit-batch-footer">${commitLink}</footer>` : ''}
  </article>`;
}

export function auditLogHtml({ summary, batches, filter = 'all', query = '' }) {
  return `<section class="audit-log">
    <div class="audit-log-intro"><div class="audit-log-icon" aria-hidden="true">◷</div><div><span class="section-eyebrow">Rastreabilidade local</span><h3>Histórico de alterações</h3><p>Consulte as operações realizadas neste navegador e veja a publicação associada. Tokens, senhas e conteúdos de imagens não são registrados.</p></div></div>
    <div class="audit-log-summary"><div><small>Operações</small><strong>${summary.operations}</strong></div><div><small>Publicações</small><strong>${summary.publications}</strong></div><div><small>Pendentes</small><strong>${summary.pendingBatches}</strong></div><div><small>Descartadas</small><strong>${summary.discardedBatches}</strong></div></div>
    <div class="audit-log-toolbar"><label><span>Pesquisar</span><input id="auditLogSearch" type="search" value="${escapeHtml(query)}" placeholder="Ação, área, registro ou administrador"></label><label><span>Situação</span><select id="auditLogFilter"><option value="all" ${filter === 'all' ? 'selected' : ''}>Todas</option><option value="pending" ${filter === 'pending' ? 'selected' : ''}>Pendentes</option><option value="published" ${filter === 'published' ? 'selected' : ''}>Publicadas</option><option value="discarded" ${filter === 'discarded' ? 'selected' : ''}>Descartadas</option><option value="replaced" ${filter === 'replaced' ? 'selected' : ''}>Substituídas</option></select></label><button class="btn btn-ghost" id="auditLogExport" type="button">Exportar histórico</button></div>
    <div class="audit-log-list">${batches.length ? batches.map(renderBatch).join('') : '<div class="audit-log-empty"><span aria-hidden="true">◌</span><h3>Nenhum registro encontrado</h3><p>As próximas alterações administrativas aparecerão aqui.</p></div>'}</div>
    <footer class="audit-log-note">O histórico é armazenado somente neste navegador, com retenção das 400 operações mais recentes.</footer>
  </section>`;
}
