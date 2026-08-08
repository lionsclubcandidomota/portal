import {
  escapeHtml,
  formatDate,
  money,
  normalize,
  parseLocalDate
} from '../../utils.js';
import { timelineHeading } from '../timeline.js';
import { renderHtmlIfChanged, uiIcon } from '../visual-helpers.js?v=6.46.5';
import { attachmentReference, formatAttachmentSize } from '../treasury-admin/attachments.js';


function attachmentIcon(type = '') {
  const normalized = String(type).toLowerCase();
  if (normalized.startsWith('image/')) return uiIcon('image');
  if (normalized === 'application/pdf') return uiIcon('file-text');
  if (normalized.includes('sheet') || normalized.includes('excel') || normalized === 'text/csv') return uiIcon('chart-bar');
  return uiIcon('file-text');
}

function treasuryAttachmentGallery(item) {
  const attachments = (Array.isArray(item?.attachments) ? item.attachments : [])
    .map(attachment => ({ ...attachment, href: attachmentReference(attachment) }))
    .filter(attachment => attachment.href);
  if (!attachments.length) return '';

  const cards = attachments.map(attachment => {
    const previewable = String(attachment.type || '').startsWith('image/') || attachment.type === 'application/pdf';
    return `<article class="treasury-attachment-card"><span class="treasury-attachment-card-icon" aria-hidden="true">${attachmentIcon(attachment.type)}</span><div class="treasury-attachment-card-copy"><strong>${escapeHtml(attachment.name)}</strong><small>${escapeHtml(attachment.type || 'Documento')} · ${formatAttachmentSize(attachment.size)}</small></div><div class="treasury-attachment-card-actions">${previewable ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(attachment.href)}" target="_blank" rel="noopener noreferrer">Visualizar</a>` : ''}<a class="btn btn-primary btn-sm" href="${escapeHtml(attachment.href)}" download="${escapeHtml(attachment.name)}">Baixar</a></div></article>`;
  }).join('');

  return `<section class="treasury-attachment-gallery"><div class="treasury-attachment-gallery-heading"><div><span aria-hidden="true">${uiIcon('paperclip')}</span><div><strong>Comprovantes e documentos</strong><small>${attachments.length} arquivo(s) vinculado(s) a esta movimentação</small></div></div></div><div class="treasury-attachment-gallery-grid">${cards}</div></section>`;
}

export function treasuryCards(items, emptyText, treasury, helpers) {
  const { empty, rowActions } = helpers;

  if (!items.length) {
    return `<div class="mobile-card-empty">${empty('money', emptyText)}</div>`;
  }

  return items.map(item => {
    const value = item.entry ? money.format(item.entry) : money.format(item.exit || 0);
    const valueType = item.entry ? 'entry' : 'exit';
    const account = treasury.accountFor(item);
    const members = treasury.membersFor(item);
    const membership = treasury.isMembershipEntry(item);
    const mutual = treasury.isMutualEntry(item);
    const mutualGroup = mutual ? treasury.mutualGroupFor(item.mutualGroupId) : null;
    const mutualEvent = mutual && item.mutualEventId
      ? treasury.mutualEventFor(item.mutualGroupId, item.mutualEventId)
      : null;
    const mutualMonth = mutual ? treasury.mutualReferenceMonth(item) : '';
    const mutualDate = mutual ? treasury.mutualReferenceDate(item) : '';
    const coveredMonthText = treasury.coveredMonths(item)
      .map(treasury.monthLabel)
      .join(', ');
    const secondaryText = membership
      ? `Mensalidade · ${coveredMonthText || 'referência não informada'}`
      : mutual
        ? mutualEvent
          ? `Mútua · ${mutualGroup?.name || 'grupo não informado'} · falecimento de ${mutualEvent.deceasedName} em ${formatDate(mutualDate)}`
          : `Mútua histórica · ${mutualGroup?.name || 'grupo não informado'} · ${treasury.monthLabel(mutualMonth)}`
        : (item.notes || 'Sem observações adicionais');
    const movementLabel = item.entry ? 'Entrada financeira' : 'Saída financeira';
    const attachmentCount = Array.isArray(item.attachments) ? item.attachments.length : 0;

    return `<article class="expandable-record-card treasury-record-card ${treasury.statusClass(item)} ${item.entry ? 'is-entry' : 'is-exit'} ${membership || mutual ? 'is-membership' : ''} ${mutual ? 'is-mutual' : ''}" data-expandable-card>
      <button class="expandable-record-summary treasury-record-summary" type="button" data-card-toggle aria-expanded="false" aria-label="Ver detalhes de ${escapeHtml(item.description)}">
        <span class="record-icon treasury-record-icon" aria-hidden="true">${item.entry ? '↗' : '↘'}</span>
        <span class="record-summary-main treasury-summary-description"><strong>${escapeHtml(item.description)}</strong><small>${escapeHtml(secondaryText)}${attachmentCount ? ` · ${attachmentCount} anexo${attachmentCount === 1 ? '' : 's'}` : ''}</small></span>
        <span class="treasury-summary-field treasury-summary-account"><small>Conta</small><strong>${treasury.accountTypeIcon(account?.type)} ${escapeHtml(account?.name || 'Conta principal')}</strong></span>
        <span class="treasury-summary-field treasury-summary-category"><small>Categoria</small><span class="badge badge-info">${escapeHtml(item.category)}</span></span>
        ${members.length ? `<span class="treasury-summary-field treasury-summary-member"><small>${members.length > 1 ? 'Associados' : 'Associado'}</small><strong>${uiIcon('users')} ${escapeHtml(members.map(member => member.name).join(', '))}</strong></span>` : ''}
        <span class="treasury-summary-field treasury-summary-date"><small>Data</small><strong>${formatDate(item.date)}</strong></span>
        <span class="treasury-summary-field treasury-summary-type"><small>Movimento</small><span class="treasury-type-chip ${valueType}">${item.entry ? 'Entrada' : 'Saída'}</span></span>
        <span class="treasury-summary-field treasury-summary-status"><small>Situação</small><span class="treasury-status-chip ${treasury.statusClass(item)}">${escapeHtml(treasury.statusLabel(item))}</span></span>
        <span class="treasury-summary-actions">
          <strong class="record-value ${valueType} sensitive-money">${item.entry ? '+' : '−'} ${value}</strong>
          <span class="record-chevron" aria-hidden="true"></span>
        </span>
      </button>
      <div class="expandable-record-details treasury-expanded-details" hidden>
        <div class="treasury-expanded-hero">
          <div class="treasury-expanded-copy">
            <span class="treasury-expanded-eyebrow">${movementLabel}</span>
            <h4>${escapeHtml(item.description)}</h4>
            <p>${escapeHtml(secondaryText)}</p>
          </div>
          <div class="treasury-expanded-amount ${valueType}">
            <small>Valor do movimento</small>
            <strong class="sensitive-money">${item.entry ? '+' : '−'} ${value}</strong>
            <span class="treasury-status-chip ${treasury.statusClass(item)}">${escapeHtml(treasury.statusLabel(item))}</span>
          </div>
        </div>
        <div class="treasury-expanded-meta">
          <div class="treasury-expanded-meta-item is-date"><span aria-hidden="true">${uiIcon('calendar')}</span><div><small>Data</small><strong>${formatDate(item.date)}</strong></div></div>
          <div class="treasury-expanded-meta-item"><span aria-hidden="true">${treasury.accountTypeIcon(account?.type)}</span><div><small>Conta</small><strong>${escapeHtml(account?.name || 'Conta principal')}</strong></div></div>
          <div class="treasury-expanded-meta-item"><span aria-hidden="true">${uiIcon('tag')}</span><div><small>Categoria</small><strong>${escapeHtml(item.category)}</strong></div></div>
          <div class="treasury-expanded-meta-item"><span aria-hidden="true">${item.entry ? '↗' : '↘'}</span><div><small>Tipo</small><strong>${item.entry ? 'Entrada' : 'Saída'}</strong></div></div>
          ${members.length ? `<div class="treasury-expanded-meta-item is-wide"><span aria-hidden="true">${uiIcon('users')}</span><div><small>${members.length > 1 ? 'Associados vinculados' : 'Associado vinculado'}</small><strong>${escapeHtml(members.map(member => member.name).join(', '))}</strong></div></div>${membership ? `<div class="treasury-expanded-meta-item"><span aria-hidden="true">${uiIcon('calendar')}</span><div><small>Referência</small><strong>${escapeHtml(coveredMonthText || 'Não informada')}</strong></div></div>` : ''}${mutual ? `<div class="treasury-expanded-meta-item"><span aria-hidden="true">${uiIcon('heart')}</span><div><small>${mutualEvent ? 'Grupo / ocorrência' : 'Grupo / referência histórica'}</small><strong>${escapeHtml(mutualGroup?.name || 'Grupo não informado')} · ${mutualEvent ? `Falecimento de ${escapeHtml(mutualEvent.deceasedName)} em ${escapeHtml(formatDate(mutualDate))}` : escapeHtml(treasury.monthLabel(mutualMonth))}</strong></div></div>` : ''}` : ''}
        </div>
        ${treasuryAttachmentGallery(item)}
        <div class="treasury-expanded-footer">
          <div class="treasury-expanded-footer-copy"><small>Ações do lançamento</small><span>Edite os dados ou exclua este registro.</span></div>
          <div class="record-actions">${rowActions('treasury', item.id)}</div>
        </div>
      </div>
    </article>`;
  }).join('');
}

export function treasuryTable(items, emptyText, treasury, helpers) {
  return items.length
    ? `<div class="treasury-card-grid">${treasuryCards(items, emptyText, treasury, helpers)}</div>`
    : `<div class="card treasury-empty-state">${helpers.empty('money', emptyText)}</div>`;
}

export function categorySummaries(items, treasury) {
  const categoryMap = new Map();

  items
    .filter(item => !treasury.isProgrammed(item))
    .forEach(item => {
      const category = (item.category || 'Sem categoria').trim() || 'Sem categoria';
      const current = categoryMap.get(category) || { entries: 0, exits: 0 };
      current.entries += Number(item.entry || 0);
      current.exits += Number(item.exit || 0);
      categoryMap.set(category, current);
    });

  return [...categoryMap.entries()]
    .sort((first, second) => (
      second[1].entries + second[1].exits
    ) - (
      first[1].entries + first[1].exits
    ));
}

export function summarizeMovementFilter(items, movementFilter, treasury) {
  const visibleItems = Array.isArray(items) ? items : [];
  const summaryItems = movementFilter === 'all'
    ? visibleItems.filter(item => !treasury.isProgrammed(item))
    : visibleItems;
  const entries = summaryItems.reduce((sum, item) => sum + Number(item.entry || 0), 0);
  const exits = summaryItems.reduce((sum, item) => sum + Number(item.exit || 0), 0);
  const scheduled = movementFilter === 'scheduled';
  const completed = movementFilter === 'completed' || movementFilter === 'all';

  return {
    entries,
    exits,
    result: entries - exits,
    count: summaryItems.length,
    entryLabel: scheduled ? 'Entradas programadas' : completed ? 'Entradas realizadas' : 'Entradas exibidas',
    exitLabel: scheduled ? 'Saídas programadas' : completed ? 'Saídas realizadas' : 'Saídas exibidas',
    resultLabel: scheduled ? 'Saldo previsto' : completed ? 'Resultado realizado' : 'Resultado exibido'
  };
}

export function bindTreasuryMovementLists({ root, periodItems, treasury, helpers }) {
  const { bindToolbar, bindRowActions } = helpers;

  const scheduledHeading = (count, expanded) => `<div class="timeline-heading treasury-scheduled-heading">
    <div class="timeline-heading-main">
      <span aria-hidden="true">${uiIcon('calendar')}</span>
      <div><h3>Programados</h3><p>Valores previstos que ainda não alteram o saldo.</p></div>
    </div>
    <div class="treasury-timeline-heading-actions">
      <span class="timeline-count">${count}</span>
      <button class="btn btn-ghost btn-sm treasury-scheduled-toggle" type="button" data-scheduled-toggle aria-expanded="${String(expanded)}" aria-controls="treasuryScheduledBody">
        <span aria-hidden="true">${expanded ? '−' : '＋'}</span>
        <strong>${expanded ? 'Recolher' : 'Expandir'}</strong>
      </button>
    </div>
  </div>`;

  const draw = (query = treasury.movementSearch) => {
    treasury.movementSearch = query;
    const movementFilter = treasury.movementFilter;
    const searchMatched = periodItems.filter(item => {
      const account = treasury.accountFor(item);
      const members = treasury.membersFor(item);
      return normalize(
        `${item.description} ${item.category} ${account?.name || ''} ${members.map(member => `${member.name} ${member.memberNumber || ''}`).join(' ')}`
      ).includes(normalize(treasury.movementSearch));
    });
    const matchesFilter = item => {
      if (movementFilter === 'scheduled') return treasury.isProgrammed(item);
      if (movementFilter === 'completed') return !treasury.isProgrammed(item);
      if (movementFilter === 'entries') return Number(item.entry || 0) > 0;
      if (movementFilter === 'exits') return Number(item.exit || 0) > 0;
      return true;
    };
    const filtered = searchMatched.filter(matchesFilter);
    const scheduled = filtered
      .filter(item => treasury.isProgrammed(item))
      .sort((first, second) => (parseLocalDate(first.date)?.getTime() || 0) - (parseLocalDate(second.date)?.getTime() || 0));
    const completed = filtered
      .filter(item => !treasury.isProgrammed(item))
      .sort((first, second) => (parseLocalDate(second.date)?.getTime() || 0) - (parseLocalDate(first.date)?.getTime() || 0));
    const scheduledPage = treasury.pagination(scheduled, treasury.scheduledPage, 'scheduled');
    const completedPage = treasury.pagination(completed, treasury.completedPage, 'completed');
    treasury.scheduledPage = scheduledPage.page;
    treasury.completedPage = completedPage.page;

    const search = root.querySelector('#searchInput');
    if (search && search.value !== treasury.movementSearch) search.value = treasury.movementSearch;
    const lists = root.querySelector('#treasuryLists');
    if (!lists) return;

    const counts = {
      all: searchMatched.length,
      scheduled: searchMatched.filter(item => treasury.isProgrammed(item)).length,
      completed: searchMatched.filter(item => !treasury.isProgrammed(item)).length,
      entries: searchMatched.filter(item => Number(item.entry || 0) > 0).length,
      exits: searchMatched.filter(item => Number(item.exit || 0) > 0).length
    };
    const summary = summarizeMovementFilter(filtered, movementFilter, treasury);
    const filterButton = (key, label) => `<button type="button" class="treasury-movement-filter ${movementFilter === key ? 'is-active' : ''}" data-movement-filter="${key}" aria-pressed="${String(movementFilter === key)}"><span>${label}</span><strong>${counts[key]}</strong></button>`;
    const scheduledExpanded = treasury.scheduledExpanded;
    const scheduledSection = movementFilter === 'completed'
      ? ''
      : `<section class="timeline-section treasury-scheduled-section ${scheduledExpanded ? 'is-expanded' : 'is-collapsed'}">${scheduledHeading(scheduled.length, scheduledExpanded)}<div id="treasuryScheduledBody" class="treasury-scheduled-body" ${scheduledExpanded ? '' : 'hidden'}>${treasuryTable(scheduledPage.visible, movementFilter === 'all' ? 'Nenhum lançamento programado.' : 'Nenhum lançamento programado corresponde ao filtro.', treasury, helpers)}${scheduledPage.html}</div></section>`;
    const completedSection = movementFilter === 'scheduled'
      ? ''
      : `<section class="timeline-section is-history">${timelineHeading(uiIcon('receipt'), 'Realizados', 'Entradas recebidas e despesas pagas.', completed.length)}${treasuryTable(completedPage.visible, movementFilter === 'all' ? 'Nenhum lançamento realizado.' : 'Nenhum lançamento realizado corresponde ao filtro.', treasury, helpers)}${completedPage.html}</section>`;

    const changed = renderHtmlIfChanged(
      lists,
      `<section class="treasury-movement-console card"><div class="treasury-movement-console-heading"><div><span class="section-eyebrow">Movimentações</span><h3>Histórico financeiro</h3><p>Filtre os lançamentos para conferir os valores.</p></div><div class="treasury-movement-balance ${summary.result >= 0 ? 'is-positive' : 'is-negative'}"><small>${summary.resultLabel}</small><strong class="sensitive-money">${money.format(summary.result)}</strong></div></div><div class="treasury-movement-stats"><span><small>${summary.entryLabel}</small><strong class="sensitive-money">${money.format(summary.entries)}</strong></span><span><small>${summary.exitLabel}</small><strong class="sensitive-money">${money.format(summary.exits)}</strong></span><span><small>Registros</small><strong>${summary.count}</strong></span></div><div class="treasury-movement-filters" role="group" aria-label="Filtrar movimentações">${filterButton('all', 'Todos')}${filterButton('completed', 'Realizados')}${filterButton('scheduled', 'Programados')}${filterButton('entries', 'Entradas')}${filterButton('exits', 'Saídas')}</div></section>${scheduledSection}${completedSection}`
    );

    if (!changed) return;
    bindRowActions();

    root.querySelectorAll('[data-movement-filter]').forEach(button => {
      button.addEventListener('click', () => {
        treasury.movementFilter = button.dataset.movementFilter || 'all';
        treasury.scheduledPage = 1;
        treasury.completedPage = 1;
        draw(treasury.movementSearch);
      });
    });

    root.querySelector('[data-scheduled-toggle]')?.addEventListener('click', () => {
      treasury.toggleScheduledExpanded();
      draw(treasury.movementSearch);
    });

    root.querySelectorAll('[data-treasury-page]').forEach(button => {
      button.addEventListener('click', () => {
        const next = Number(button.dataset.page || 1);
        if (button.dataset.treasuryPage === 'scheduled') {
          treasury.scheduledPage = next;
        } else {
          treasury.completedPage = next;
        }
        draw(treasury.movementSearch);
        root.querySelector('#treasuryLists')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    });
  };

  bindToolbar(query => {
    treasury.movementSearch = query;
    treasury.scheduledPage = 1;
    treasury.completedPage = 1;
    draw(query);
  });
  draw(treasury.movementSearch);
}
