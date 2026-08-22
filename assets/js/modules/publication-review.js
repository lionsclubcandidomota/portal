import { uiIcon } from './visual-helpers.js?v=6.52.3';
export { buildPublicationReview } from './publication-review-domain.js?v=6.52.3';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#039;');
}

function typeLabel(type) {
  if (type === 'added') return 'Adicionado';
  if (type === 'removed') return 'Removido';
  return 'Atualizado';
}

function renderField(changeType, field) {
  const beforeVisible = changeType !== 'added';
  const afterVisible = changeType !== 'removed';
  return `<div class="publication-review-field">
    <strong>${escapeHtml(field.label)}</strong>
    <div class="publication-review-values">
      ${beforeVisible ? `<span class="publication-review-value is-before"><small>Antes</small>${escapeHtml(field.before)}</span>` : ''}
      ${beforeVisible && afterVisible ? '<span class="publication-review-value-arrow" aria-hidden="true">→</span>' : ''}
      ${afterVisible ? `<span class="publication-review-value is-after"><small>${changeType === 'added' ? 'Será publicado' : 'Depois'}</small>${escapeHtml(field.after)}</span>` : ''}
    </div>
  </div>`;
}

function renderChange(change) {
  return `<article class="publication-review-change is-${escapeHtml(change.type)}">
    <div class="publication-review-change-heading">
      <div>
        <span class="publication-review-type">${typeLabel(change.type)}</span>
        <h4>${escapeHtml(change.title)}</h4>
        <p>${escapeHtml(change.description)}</p>
      </div>
    </div>
    ${change.fields.length
      ? `<div class="publication-review-fields">${change.fields.map(field => renderField(change.type, field)).join('')}</div>`
      : '<p class="publication-review-no-fields">Nenhum detalhe adicional é necessário para esta alteração.</p>'}
  </article>`;
}

export function publicationReviewHtml(review, { canPublish = false } = {}) {
  const safeReview = review || { total: 0, fieldsTotal: 0, groups: [] };
  if (!safeReview.total) {
    return `<section class="publication-review publication-review-empty">
      <div class="publication-review-empty-icon" aria-hidden="true">${uiIcon('check')}</div>
      <h3>Nenhuma diferença para publicar</h3>
      <p>O conteúdo atual é igual à última versão sincronizada do portal.</p>
      <div class="publication-review-footer"><button class="btn btn-primary" type="button" data-publication-review-close>Voltar</button></div>
    </section>`;
  }

  return `<section class="publication-review">
    <div class="publication-review-intro">
      <div class="publication-review-intro-icon" aria-hidden="true">${uiIcon('file-text')}</div>
      <div><span class="section-eyebrow">Revisão antes da publicação</span><h3>Confira o que será enviado ao portal</h3><p>As alterações são comparadas com a última versão sincronizada. Edições repetidas no mesmo registro aparecem consolidadas no resultado final.</p></div>
    </div>
    <div class="publication-review-summary" aria-label="Resumo das alterações">
      <div><small>Alterações</small><strong>${safeReview.total}</strong></div>
      <div><small>Áreas afetadas</small><strong>${safeReview.groups.length}</strong></div>
      <div><small>Campos modificados</small><strong>${safeReview.fieldsTotal}</strong></div>
    </div>
    <div class="publication-review-groups">
      ${safeReview.groups.map((group, index) => `<details class="publication-review-group" ${index < 2 ? 'open' : ''}>
        <summary><span class="publication-review-group-icon" aria-hidden="true">${uiIcon(group.icon)}</span><span><strong>${escapeHtml(group.title)}</strong><small>${group.changes.length} alteraç${group.changes.length === 1 ? 'ão' : 'ões'}</small></span><span class="publication-review-group-chevron" aria-hidden="true"></span></summary>
        <div class="publication-review-change-list">${group.changes.map(renderChange).join('')}</div>
      </details>`).join('')}
    </div>
    <div class="publication-review-footer">
      <button class="btn btn-ghost" type="button" data-publication-review-close>Voltar</button>
      <button class="btn btn-primary" type="button" data-publication-review-publish ${canPublish ? '' : 'disabled'}>Publicar ${safeReview.total} alteraç${safeReview.total === 1 ? 'ão' : 'ões'}</button>
    </div>
    ${canPublish ? '' : '<p class="publication-review-help">Conecte o acesso administrativo ao GitHub para publicar as alterações.</p>'}
  </section>`;
}
