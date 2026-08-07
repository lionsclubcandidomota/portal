import {
  escapeHtml,
  formatDate,
  money,
  normalize,
  parseLocalDate
} from '../../utils.js';
import { timelineHeading } from '../timeline.js';
import { attachmentReference, formatAttachmentSize } from '../treasury-admin/attachments.js';
import { isSecureTreasuryAttachment, requestSecureAttachmentAccess } from '../secure-storage/client.js?v=6.46.0';


export function movementValueSummary(items = [], isProgrammed = () => false, mode = 'realized') {
  const scheduled = mode === 'scheduled';
  const summarized = (Array.isArray(items) ? items : [])
    .filter(item => Boolean(isProgrammed(item)) === scheduled);
  const entries = summarized.reduce((sum, item) => sum + Number(item?.entry || 0), 0);
  const exits = summarized.reduce((sum, item) => sum + Number(item?.exit || 0), 0);
  return {
    scheduled,
    entries,
    exits,
    result: entries - exits,
    count: summarized.length
  };
}

function attachmentIcon(type = '') {
  const normalized = String(type).toLowerCase();
  if (normalized.startsWith('image/')) return '🖼️';
  if (normalized === 'application/pdf') return '📕';
  if (normalized.includes('sheet') || normalized.includes('excel') || normalized === 'text/csv') return '📊';
  return '📄';
}

function treasuryAttachmentGallery(item) {
  const attachments = (Array.isArray(item?.attachments) ? item.attachments : [])
    .map(attachment => ({
      ...attachment,
      secure: isSecureTreasuryAttachment(attachment),
      href: attachmentReference(attachment)
    }))
    .filter(attachment => attachment.secure || attachment.href);
  if (!attachments.length) return '';

  const cards = attachments.map(attachment => {
    const previewable = String(attachment.type || '').startsWith('image/') || attachment.type === 'application/pdf';
    const actions = attachment.secure
      ? `${previewable ? `<button class="btn btn-ghost btn-sm" type="button" data-secure-attachment-action="inline" data-movement-id="${escapeHtml(item.id)}" data-attachment-id="${escapeHtml(attachment.id)}">Visualizar</button>` : ''}<button class="btn btn-primary btn-sm" type="button" data-secure-attachment-action="attachment" data-movement-id="${escapeHtml(item.id)}" data-attachment-id="${escapeHtml(attachment.id)}">Baixar</button>`
      : `${previewable ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(attachment.href)}" target="_blank" rel="noopener noreferrer">Visualizar</a>` : ''}<a class="btn btn-primary btn-sm" href="${escapeHtml(attachment.href)}" download="${escapeHtml(attachment.name)}">Baixar</a>`;
    const storageLabel = attachment.secure ? 'Armazenamento privado' : 'Arquivo público legado';
    return `<article class="treasury-attachment-card"><span class="treasury-attachment-card-icon" aria-hidden="true">${attachmentIcon(attachment.type)}</span><div class="treasury-attachment-card-copy"><strong>${escapeHtml(attachment.name)}</strong><small>${escapeHtml(attachment.type || 'Documento')} · ${formatAttachmentSize(attachment.size)} · ${storageLabel}</small></div><div class="treasury-attachment-card-actions">${actions}</div></article>`;
  }).join('');

  return `<section class="treasury-attachment-gallery"><div class="treasury-attachment-gallery-heading"><div><span aria-hidden="true">📎</span><div><strong>Comprovantes e documentos</strong><small>${attachments.length} arquivo(s) vinculado(s) a esta movimentação</small></div></div></div><div class="treasury-attachment-gallery-grid">${cards}</div></section>`;
}

export function treasuryCards(items, emptyText, treasury, helpers) {
  const { empty, rowActions } = helpers;

  if (!items.length) {
    return `<div class="mobile-card-empty">${empty('💰', emptyText)}</div>`;
  }

  return items.map(item => {
    const value = item.entry ? money.format(item.entry) : money.format(item.exit || 0);
    const valueType = item.entry ? 'entry' : 'exit';
    const account = treasury.accountFor(item);
    const members = treasury.membersFor(item);
    const membership = treasury.isMembershipEntry(item);
    const mutual = treasury.isMutualEntry(item);
    const mutualGroup = mutual ? treasury.mutualGroupFor(item.mutualGroupId) : null;
    const mutualEvent = mutual ? treasury.mutualEventFor(item.mutualGroupId, item.mutualEventId) : null;
    const mutualDate = mutual ? (item.mutualEventDate || mutualEvent?.deathDate || treasury.mutualEventDate(item)) : '';
    const coveredMonthText = treasury.coveredMonths(item)
      .map(treasury.monthLabel)
      .join(', ');
    const secondaryText = membership
      ? `Mensalidade · ${coveredMonthText || 'referência não informada'}`
      : mutual
        ? `Mútua · ${mutualGroup?.name || 'grupo não informado'} · Falecimento de ${item.mutualDeceasedName || mutualEvent?.deceasedName || 'associado não informado'} · ${formatDate(mutualDate)}`
        : (item.notes || 'Sem observações adicionais');
    const movementLabel = item.entry ? 'Entrada financeira' : 'Saída financeira';
    const attachmentCount = Array.isArray(item.attachments) ? item.attachments.length : 0;

    return `<article class="expandable-record-card treasury-record-card ${treasury.statusClass(item)} ${item.entry ? 'is-entry' : 'is-exit'} ${membership || mutual ? 'is-membership' : ''} ${mutual ? 'is-mutual' : ''}" data-expandable-card>
      <button class="expandable-record-summary treasury-record-summary" type="button" data-card-toggle aria-expanded="false" aria-label="Ver detalhes de ${escapeHtml(item.description)}">
        <span class="record-icon treasury-record-icon" aria-hidden="true">${item.entry ? '↗' : '↘'}</span>
        <span class="record-summary-main treasury-summary-description"><strong>${escapeHtml(item.description)}</strong><small>${escapeHtml(secondaryText)}${attachmentCount ? ` · 📎 ${attachmentCount} anexo${attachmentCount === 1 ? '' : 's'}` : ''}</small></span>
        <span class="treasury-summary-field treasury-summary-account"><small>Conta</small><strong>${treasury.accountTypeIcon(account?.type)} ${escapeHtml(account?.name || 'Conta principal')}</strong></span>
        <span class="treasury-summary-field treasury-summary-category"><small>Categoria</small><span class="badge badge-info">${escapeHtml(item.category)}</span></span>
        ${members.length ? `<span class="treasury-summary-field treasury-summary-member"><small>${members.length > 1 ? 'Associados' : 'Associado'}</small><strong>👥 ${escapeHtml(members.map(member => member.name).join(', '))}</strong></span>` : ''}
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
          <div class="treasury-expanded-meta-item is-date"><span aria-hidden="true">📅</span><div><small>Data</small><strong>${formatDate(item.date)}</strong></div></div>
          <div class="treasury-expanded-meta-item"><span aria-hidden="true">${treasury.accountTypeIcon(account?.type)}</span><div><small>Conta</small><strong>${escapeHtml(account?.name || 'Conta principal')}</strong></div></div>
          <div class="treasury-expanded-meta-item"><span aria-hidden="true">🏷️</span><div><small>Categoria</small><strong>${escapeHtml(item.category)}</strong></div></div>
          <div class="treasury-expanded-meta-item"><span aria-hidden="true">${item.entry ? '↗' : '↘'}</span><div><small>Tipo</small><strong>${item.entry ? 'Entrada' : 'Saída'}</strong></div></div>
          ${members.length ? `<div class="treasury-expanded-meta-item is-wide"><span aria-hidden="true">👥</span><div><small>${members.length > 1 ? 'Associados vinculados' : 'Associado vinculado'}</small><strong>${escapeHtml(members.map(member => member.name).join(', '))}</strong></div></div>${membership ? `<div class="treasury-expanded-meta-item"><span aria-hidden="true">🗓️</span><div><small>Referência</small><strong>${escapeHtml(coveredMonthText || 'Não informada')}</strong></div></div>` : ''}${mutual ? `<div class="treasury-expanded-meta-item"><span aria-hidden="true">🤲</span><div><small>Grupo / evento</small><strong>${escapeHtml(mutualGroup?.name || 'Grupo não informado')} · Falecimento de ${escapeHtml(item.mutualDeceasedName || mutualEvent?.deceasedName || 'associado não informado')} · ${escapeHtml(formatDate(mutualDate))}</strong></div></div>` : ''}` : ''}
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
    : `<div class="card treasury-empty-state">${helpers.empty('💰', emptyText)}</div>`;
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

function dateReference(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function operationalPagination(section = {}, key = '') {
  const page = Math.max(1, Number(section.page || 1));
  const pages = Math.max(1, Number(section.pages || 1));
  if (pages <= 1) return '';
  return `<nav class="list-pagination" aria-label="Paginação dos lançamentos"><button class="btn btn-ghost btn-sm" type="button" data-treasury-page="${escapeHtml(key)}" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>← Anterior</button><span>Página <strong>${page}</strong> de ${pages}</span><button class="btn btn-ghost btn-sm" type="button" data-treasury-page="${escapeHtml(key)}" data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>Próxima →</button></nav>`;
}

export function bindTreasuryMovementLists({ root, state, periodItems, treasury, helpers }) {
  const { bindToolbar, bindRowActions, loadOperationalMovements } = helpers;
  let treasurySearchQuery = '';
  let movementFilter = 'all';
  let requestGeneration = 0;
  let fallbackNotified = false;
  let renderedMovements = new Map();

  const localModel = query => {
    const searchMatched = periodItems.filter(item => {
      const account = treasury.accountFor(item);
      const members = treasury.membersFor(item);
      return normalize(
        `${item.description} ${item.category} ${account?.name || ''} ${members.map(member => `${member.name} ${member.memberNumber || ''}`).join(' ')}`
      ).includes(normalize(query));
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
    const scheduledSummary = movementFilter === 'scheduled';
    const summary = movementValueSummary(
      filtered,
      item => treasury.isProgrammed(item),
      scheduledSummary ? 'scheduled' : 'realized'
    );
    return {
      source: 'local',
      counts: {
        all: searchMatched.length,
        scheduled: searchMatched.filter(item => treasury.isProgrammed(item)).length,
        completed: searchMatched.filter(item => !treasury.isProgrammed(item)).length,
        entries: searchMatched.filter(item => Number(item.entry || 0) > 0).length,
        exits: searchMatched.filter(item => Number(item.exit || 0) > 0).length
      },
      summary: { mode: scheduledSummary ? 'scheduled' : 'realized', ...summary },
      scheduled: {
        items: scheduledPage.visible,
        total: scheduled.length,
        page: scheduledPage.page,
        pages: scheduledPage.totalPages,
        html: scheduledPage.html
      },
      completed: {
        items: completedPage.visible,
        total: completed.length,
        page: completedPage.page,
        pages: completedPage.totalPages,
        html: completedPage.html
      }
    };
  };

  const loadD1Model = async query => {
    if (typeof loadOperationalMovements !== 'function') return null;
    const bounds = treasury.periodBounds();
    return loadOperationalMovements({
      start: dateReference(bounds.start),
      end: dateReference(bounds.end),
      query,
      filter: movementFilter,
      scheduledPage: treasury.scheduledPage,
      completedPage: treasury.completedPage,
      pageSize: 8
    });
  };

  const bindAttachmentActions = () => {
    root.querySelectorAll('[data-secure-attachment-action]').forEach(button => {
      button.addEventListener('click', async () => {
        const movementId = String(button.dataset.movementId || '');
        const movement = renderedMovements.get(movementId)
          || (Array.isArray(state?.treasury) ? state.treasury : []).find(item => String(item?.id || '') === movementId);
        const attachment = (Array.isArray(movement?.attachments) ? movement.attachments : [])
          .find(item => String(item?.id || '') === String(button.dataset.attachmentId || ''));
        if (!attachment) {
          helpers.toast?.({ type: 'error', title: 'Anexo indisponível', message: 'Não foi possível localizar o documento vinculado.' });
          return;
        }

        const disposition = button.dataset.secureAttachmentAction === 'attachment' ? 'attachment' : 'inline';
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = disposition === 'attachment' ? 'Preparando…' : 'Abrindo…';
        let previewWindow = null;
        if (disposition === 'inline') {
          previewWindow = window.open('', '_blank');
          if (previewWindow) previewWindow.opener = null;
        }
        try {
          const url = await requestSecureAttachmentAccess(state, attachment, disposition);
          if (disposition === 'inline') {
            if (previewWindow) previewWindow.location.href = url;
            else window.open(url, '_blank', 'noopener,noreferrer');
          } else {
            const link = document.createElement('a');
            link.href = url;
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            link.remove();
          }
        } catch (error) {
          previewWindow?.close();
          helpers.toast?.({ type: 'error', title: 'Acesso ao anexo bloqueado', message: error?.message || 'Não foi possível abrir o documento.' });
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
  };

  const renderModel = model => {
    const lists = root.querySelector('#treasuryLists');
    if (!lists) return;
    treasury.scheduledPage = Math.max(1, Number(model.scheduled?.page || 1));
    treasury.completedPage = Math.max(1, Number(model.completed?.page || 1));
    const scheduledItems = Array.isArray(model.scheduled?.items) ? model.scheduled.items : [];
    const completedItems = Array.isArray(model.completed?.items) ? model.completed.items : [];
    renderedMovements = new Map([...scheduledItems, ...completedItems].map(item => [String(item?.id || ''), item]));

    const summary = model.summary || {};
    const scheduledSummary = summary.mode === 'scheduled';
    const summaryEntries = Number(summary.entries || 0);
    const summaryExits = Number(summary.exits || 0);
    const summaryResult = Number(summary.result || 0);
    const summaryModeLabel = scheduledSummary ? 'programado' : 'realizado';
    const summaryEntriesLabel = scheduledSummary ? 'Entradas programadas' : 'Entradas realizadas';
    const summaryExitsLabel = scheduledSummary ? 'Saídas programadas' : 'Saídas realizadas';
    const summaryDescription = scheduledSummary
      ? 'Os valores abaixo são previsões e ainda não alteram o saldo atual.'
      : 'Use os filtros rápidos para localizar lançamentos e conferir valores realizados.';
    const sourceD1 = String(model.source || '').startsWith('d1');
    const sourceLabel = sourceD1 ? 'D1 · consulta paginada' : 'Modo local de contingência';
    const showScheduledSection = movementFilter !== 'completed';
    const showCompletedSection = movementFilter !== 'scheduled';
    const counts = model.counts || {};
    const filterButton = (key, label) => `<button type="button" class="treasury-movement-filter ${movementFilter === key ? 'is-active' : ''}" data-movement-filter="${key}" aria-pressed="${String(movementFilter === key)}"><span>${label}</span><strong>${Number(counts[key] || 0)}</strong></button>`;
    const scheduledPagination = model.scheduled?.html ?? operationalPagination(model.scheduled, 'scheduled');
    const completedPagination = model.completed?.html ?? operationalPagination(model.completed, 'completed');
    const scheduledSection = showScheduledSection
      ? `<section class="timeline-section">${timelineHeading('🗓️', 'Lançamentos programados', 'Receitas e despesas agendadas que ainda não impactam o saldo atual.', Number(model.scheduled?.total || 0))}${treasuryTable(scheduledItems, movementFilter === 'all' ? 'Nenhum lançamento programado.' : 'Nenhum lançamento programado corresponde ao filtro.', treasury, helpers)}${scheduledPagination}</section>`
      : '';
    const completedSection = showCompletedSection
      ? `<section class="timeline-section is-history">${timelineHeading('🧾', 'Lançamentos realizados', 'Somente movimentações recebidas, pagas ou realizadas.', Number(model.completed?.total || 0), true)}${treasuryTable(completedItems, movementFilter === 'all' ? 'Nenhum lançamento realizado.' : 'Nenhum lançamento realizado corresponde ao filtro.', treasury, helpers)}${completedPagination}</section>`
      : '';

    lists.innerHTML = `<section class="treasury-movement-console card"><div class="treasury-movement-console-heading"><div><span class="section-eyebrow">Histórico financeiro</span><h3>Movimentações do período</h3><p>${summaryDescription}</p><span class="badge ${sourceD1 ? 'badge-success' : 'badge-warning'}">${sourceLabel}</span></div><div class="treasury-movement-balance ${summaryResult >= 0 ? 'is-positive' : 'is-negative'} ${scheduledSummary ? 'is-scheduled' : ''}"><small>Resultado ${summaryModeLabel}</small><strong class="sensitive-money">${money.format(summaryResult)}</strong></div></div><div class="treasury-movement-stats"><span><small>${summaryEntriesLabel}</small><strong class="sensitive-money">${money.format(summaryEntries)}</strong></span><span><small>${summaryExitsLabel}</small><strong class="sensitive-money">${money.format(summaryExits)}</strong></span><span><small>Registros exibidos</small><strong>${Number(summary.count || 0)}</strong></span></div><div class="treasury-movement-filters" role="group" aria-label="Filtrar movimentações">${filterButton('all', 'Todos')}${filterButton('completed', 'Realizados')}${filterButton('scheduled', 'Programados')}${filterButton('entries', 'Entradas')}${filterButton('exits', 'Saídas')}</div></section>${scheduledSection}${completedSection}`;

    bindRowActions();
    bindAttachmentActions();

    root.querySelectorAll('[data-movement-filter]').forEach(button => {
      button.addEventListener('click', () => {
        movementFilter = button.dataset.movementFilter || 'all';
        treasury.scheduledPage = 1;
        treasury.completedPage = 1;
        void draw(treasurySearchQuery);
      });
    });

    root.querySelectorAll('[data-treasury-page]').forEach(button => {
      button.addEventListener('click', () => {
        const next = Number(button.dataset.page || 1);
        if (button.dataset.treasuryPage === 'scheduled') treasury.scheduledPage = next;
        else treasury.completedPage = next;
        void draw(treasurySearchQuery).then(() => {
          root.querySelector('#treasuryLists')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    });
  };

  const draw = async (query = treasurySearchQuery) => {
    treasurySearchQuery = query;
    const generation = ++requestGeneration;
    const lists = root.querySelector('#treasuryLists');
    if (lists && typeof loadOperationalMovements === 'function') {
      lists.classList.add('is-loading');
      lists.setAttribute('aria-busy', 'true');
    }
    try {
      const remote = await loadD1Model(query);
      if (generation !== requestGeneration) return;
      renderModel(remote || localModel(query));
    } catch (error) {
      if (generation !== requestGeneration) return;
      renderModel(localModel(query));
      if (!fallbackNotified) {
        fallbackNotified = true;
        console.warn('Consulta operacional do D1 indisponível; usando o estado local.', error);
      }
    } finally {
      if (generation === requestGeneration && lists) {
        lists.classList.remove('is-loading');
        lists.removeAttribute('aria-busy');
      }
    }
  };

  bindToolbar(query => {
    treasury.scheduledPage = 1;
    treasury.completedPage = 1;
    void draw(query);
  });
  void draw();
}

