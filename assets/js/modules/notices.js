import {
  escapeHtml,
  formatDate,
  normalize,
  parseLocalDate
} from '../utils.js';
import { markdownToHtml } from './markdown.js';
import { timelineHeading, todayStart } from './timeline.js';
import { renderHtmlIfChanged } from './visual-helpers.js?v=6.46.5';

export function noticeIsExpired(notice, reference = new Date()) {
  if (!notice?.endDate) return false;

  const end = parseLocalDate(notice.endDate);
  end.setHours(23, 59, 59, 999);

  return end < reference;
}

export function noticeIsActive(notice, reference = new Date()) {
  const start = parseLocalDate(notice.date);
  start.setHours(0, 0, 0, 0);

  return start <= reference && !noticeIsExpired(notice, reference);
}

export function noticePeriodText(notice) {
  return notice.endDate
    ? `${formatDate(notice.date)} até ${formatDate(notice.endDate)}`
    : `A partir de ${formatDate(notice.date)}`;
}

function noticeCards(items, emptyText, helpers) {
  const {
    priorityBadge,
    rowActions,
    empty
  } = helpers;

  if (!items.length) {
    return `<div class="mobile-card-empty">${empty('📢', emptyText)}</div>`;
  }

  return items.map(item => {
    const expired = noticeIsExpired(item);
    const active = noticeIsActive(item);

    return `<article class="expandable-record-card notice-record-card ${expired ? 'is-past' : ''}" data-expandable-card>
      <button class="expandable-record-summary" type="button" data-card-toggle aria-expanded="false">
        <span class="record-icon">📢</span><span class="record-summary-main"><span class="badge ${priorityBadge(item.priority)}">${escapeHtml(item.priority)}</span><strong>${escapeHtml(item.title)}</strong><small>📅 ${formatDate(item.date)}${item.endDate ? ` até ${formatDate(item.endDate)}` : ''}</small></span><span class="badge ${expired ? 'badge-muted' : active ? 'badge-success' : 'badge-info'}">${expired ? 'Encerrado' : active ? 'Disponível' : 'Programado'}</span><span class="record-chevron" aria-hidden="true"></span>
      </button>
      <div class="expandable-record-details" hidden><div class="record-notes markdown-body">${markdownToHtml(item.text || 'Sem mensagem informada.')}</div><div class="record-actions">${rowActions('notice', item.id)}</div></div>
    </article>`;
  }).join('');
}

export function renderNotices(state, helpers) {
  const {
    root,
    adminUnlocked,
    pageToolbar,
    bindToolbar,
    bindRowActions
  } = helpers;

  root.innerHTML = `${pageToolbar('Buscar avisos...', 'Adicionar aviso', 'notice')}<div id="noticeLists"></div>`;

  const draw = (query = '') => {
    const visible = state.notices.filter(item => {
      const canShow = adminUnlocked || !noticeIsExpired(item);
      const matchesSearch = normalize(`${item.title} ${item.text}`).includes(normalize(query));
      return canShow && matchesSearch;
    });
    const today = todayStart();
    const current = visible
      .filter(item => parseLocalDate(item.date) >= today || noticeIsActive(item))
      .sort((first, second) => parseLocalDate(first.date) - parseLocalDate(second.date));
    const history = visible
      .filter(item => parseLocalDate(item.date) < today && !noticeIsActive(item))
      .sort((first, second) => parseLocalDate(second.date) - parseLocalDate(first.date));
    const lists = root.querySelector('#noticeLists');

    if (!lists) return;

    const changed = renderHtmlIfChanged(
      lists,
      `<section class="timeline-section">${timelineHeading('📢', 'Avisos atuais', 'Comunicados disponíveis e programados.', current.length)}<div class="expandable-record-list">${noticeCards(current, 'Nenhum aviso ativo ou programado.', helpers)}</div></section>${adminUnlocked ? `<section class="timeline-section is-history">${timelineHeading('🗂️', 'Histórico', 'Avisos encerrados.', history.length, true)}<div class="expandable-record-list">${noticeCards(history, 'Nenhum aviso encerrado.', helpers)}</div></section>` : ''}`
    );

    if (changed) bindRowActions();
  };

  bindToolbar(draw);
  draw();
}
