import {
  escapeHtml,
  formatDate,
  money,
  normalize
} from '../../utils.js';

function latestPayment(payments = []) {
  return [...payments]
    .sort((first, second) => String(second.paymentDate || second.date || '')
      .localeCompare(String(first.paymentDate || first.date || '')))[0] || null;
}

function periodLabel(start, end) {
  if (!start && !end) return 'Todos os eventos';
  if (start && !end) return `A partir de ${formatDate(start)}`;
  if (!start && end) return `Até ${formatDate(end)}`;
  if (start === end) return formatDate(start);
  return `${formatDate(start)} até ${formatDate(end)}`;
}

function eventInsideRange(event, start, end) {
  const date = String(event?.deathDate || '');
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

export function buildMutualViewModel(state, treasury) {
  const groups = [...treasury.mutualGroups()]
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR'));
  const selectedStart = treasury.mutualStart || '';
  const requestedEnd = treasury.mutualEnd || '';
  const selectedEnd = selectedStart && requestedEnd && requestedEnd < selectedStart ? selectedStart : requestedEnd;
  const requestedGroup = String(treasury.mutualGroup || 'all');
  const groupFilter = requestedGroup === 'all' || !groups.some(group => String(group.id) === requestedGroup)
    ? 'all'
    : requestedGroup;
  const selectedGroups = groupFilter === 'all'
    ? groups
    : groups.filter(group => String(group.id) === groupFilter);
  const selectedKeys = treasury.mutualSelectedCharges;
  const search = String(treasury.mutualSearch || '').trim();
  const statusFilter = String(treasury.mutualStatus || 'pending');
  const allGroupsMode = groupFilter === 'all';

  const groupSections = selectedGroups.map(group => {
    const eventSections = [...(Array.isArray(group.events) ? group.events : [])]
      .filter(event => !event.cancelledAt && eventInsideRange(event, selectedStart, selectedEnd))
      .sort((first, second) => String(second.deathDate || '').localeCompare(String(first.deathDate || '')))
      .map(event => {
        const members = treasury.mutualMembersForEvent(group.id, event.id)
          .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
        const amount = Math.max(0, Number(event.amountPerParticipant || 0));
        const charges = members.map(member => {
          const key = treasury.mutualChargeKey(group.id, event.id, member.id);
          const payment = latestPayment(treasury.mutualPaymentsFor(group.id, event.id, member.id));
          const paid = Boolean(payment);
          const item = {
            key,
            group,
            event,
            member,
            amount,
            displayAmount: paid ? Number(payment?.entry || amount) : amount,
            payment,
            paid,
            selected: !paid && selectedKeys.has(key)
          };
          const matchesSearch = !search || normalize(
            `${member.name || ''} ${member.memberNumber || ''} ${group.name || ''} ${event.deceasedName || ''} ${event.deceasedClub || ''} ${formatDate(event.deathDate)}`
          ).includes(normalize(search));
          const matchesStatus = statusFilter === 'all'
            || (statusFilter === 'paid' ? paid : !paid);
          return { ...item, visible: matchesSearch && matchesStatus };
        });
        const visibleCharges = charges.filter(item => item.visible);
        const paidCharges = charges.filter(item => item.paid);
        const pendingCharges = charges.filter(item => !item.paid);
        return {
          event,
          amount,
          charges,
          visibleCharges,
          paidCharges,
          pendingCharges,
          expectedTotal: charges.reduce((sum, item) => sum + item.amount, 0),
          receivedTotal: paidCharges.reduce((sum, item) => sum + Number(item.payment?.entry || item.amount), 0)
        };
      });
    const charges = eventSections.flatMap(section => section.charges);
    const visibleCharges = charges.filter(item => item.visible);
    const paidCharges = charges.filter(item => item.paid);
    const pendingCharges = charges.filter(item => !item.paid);
    return {
      group,
      active: !group.closedDate,
      expanded: allGroupsMode ? treasury.isMutualGroupExpanded(group.id) : true,
      eventSections,
      charges,
      visibleCharges,
      paidCharges,
      pendingCharges,
      expectedTotal: charges.reduce((sum, item) => sum + item.amount, 0),
      receivedTotal: paidCharges.reduce((sum, item) => sum + Number(item.payment?.entry || item.amount), 0)
    };
  });

  const charges = groupSections.flatMap(section => section.charges);
  const visibleCharges = charges.filter(item => item.visible);
  const paidCharges = charges.filter(item => item.paid);
  const pendingCharges = charges.filter(item => !item.paid);
  const selectedCharges = pendingCharges.filter(item => selectedKeys.has(item.key));
  const expectedTotal = charges.reduce((sum, item) => sum + item.amount, 0);
  const receivedTotal = paidCharges.reduce((sum, item) => sum + Number(item.payment?.entry || item.amount), 0);
  const eventCount = groupSections.reduce((sum, section) => sum + section.eventSections.length, 0);

  return {
    groups,
    selectedGroups,
    selectedStart,
    selectedEnd,
    periodLabel: periodLabel(selectedStart, selectedEnd),
    groupFilter,
    allGroupsMode,
    groupSections,
    charges,
    visibleCharges,
    paidCharges,
    pendingCharges,
    expectedTotal,
    receivedTotal,
    selectedCharges,
    eventCount,
    search,
    statusFilter,
    expanded: treasury.mutualExpanded !== false
  };
}

function renderChargeCard(item, adminUnlocked, avatar) {
  const paymentDate = item.payment?.paymentDate || item.payment?.date || '';
  const statusLabel = item.paid ? 'Paga' : 'Em aberto';
  const paymentDetail = item.paid
    ? `Recebida em ${escapeHtml(formatDate(paymentDate))}`
    : `Falecimento em ${escapeHtml(formatDate(item.event.deathDate))}`;
  return `<article class="membership-member mutual-charge-card ${item.paid ? 'is-paid' : 'is-pending'} ${item.selected ? 'is-selected' : ''}" data-mutual-key="${escapeHtml(item.key)}" data-mutual-search="${escapeHtml(normalize(`${item.member.name || ''} ${item.member.memberNumber || ''} ${item.group.name || ''} ${item.event.deceasedName || ''}`))}" data-mutual-status="${item.paid ? 'paid' : 'pending'}" data-mutual-amount="${item.amount}" data-mutual-group-id="${escapeHtml(item.group.id)}" data-mutual-event-id="${escapeHtml(item.event.id)}" ${item.visible ? '' : 'hidden'}>
    <label class="membership-member-main mutual-charge-main">
      <span class="mutual-charge-choice">${adminUnlocked && !item.paid ? `<input class="mutual-charge-checkbox" type="checkbox" value="${escapeHtml(item.key)}" ${item.selected ? 'checked' : ''} aria-label="Selecionar cobrança de mútua de ${escapeHtml(item.member.name)} pelo falecimento de ${escapeHtml(item.event.deceasedName)}"><i aria-hidden="true">✓</i>` : '<i class="is-readonly" aria-hidden="true">✓</i>'}</span>
      <span class="membership-avatar-shell">${avatar(item.member)}<span class="membership-avatar-state" aria-hidden="true"></span></span>
      <span class="membership-member-copy"><span class="membership-member-heading"><strong>${escapeHtml(item.member.name)}</strong><span class="membership-state-pill"><i aria-hidden="true"></i>${statusLabel}</span></span><span class="membership-member-meta"><small>${item.member.memberNumber ? `Nº ${escapeHtml(item.member.memberNumber)}` : 'Sem número informado'}</small><span class="membership-family-chip">🤲 ${escapeHtml(item.group.name)}</span></span></span>
      <span class="membership-progress-panel mutual-charge-summary"><span class="membership-progress-heading"><b class="sensitive-money">${money.format(item.displayAmount)}</b><small>${paymentDetail}</small></span><small class="membership-progress-note">${item.paid ? 'Cobrança do evento quitada' : 'Selecione para registrar o recebimento'}</small></span>
    </label>
  </article>`;
}

function renderEventSection(section, adminUnlocked, avatar, empty) {
  const { event } = section;
  const content = section.charges.length
    ? section.charges.map(item => renderChargeCard(item, adminUnlocked, avatar)).join('')
    : empty('👥', 'Nenhum participante foi incluído neste evento.');
  const deceasedDetails = [event.deceasedMemberNumber ? `Nº ${event.deceasedMemberNumber}` : '', event.deceasedClub]
    .filter(Boolean)
    .join(' · ');
  return `<section class="mutual-month-section mutual-event-section" data-mutual-event-section="${escapeHtml(event.id)}">
    <div class="mutual-month-heading"><div><span aria-hidden="true">🕊️</span><div><strong>Falecimento de ${escapeHtml(event.deceasedName)}</strong><small>${escapeHtml(formatDate(event.deathDate))}${deceasedDetails ? ` · ${escapeHtml(deceasedDetails)}` : ''} · ${section.charges.length} cobrança(s)</small></div></div><div><small>Recebido / previsto</small><strong class="sensitive-money">${money.format(section.receivedTotal)} / ${money.format(section.expectedTotal)}</strong></div></div>
    ${event.notes ? `<p class="family-group-notes">${escapeHtml(event.notes)}</p>` : ''}
    <div class="membership-list mutual-charge-list">${content}</div>
    <div class="membership-filter-empty mutual-event-empty" ${section.visibleCharges.length || !section.charges.length ? 'hidden' : ''}>🔎 Nenhum participante deste evento corresponde aos filtros.</div>
  </section>`;
}

function renderGroupAccordion(section, allGroupsMode, adminUnlocked, avatar, empty) {
  const { group } = section;
  const contentId = `mutual-group-content-${String(group.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return `<article class="mutual-group-accordion ${section.expanded ? 'is-expanded' : 'is-collapsed'}" data-mutual-group-section="${escapeHtml(group.id)}">
    <button class="mutual-group-accordion-toggle" type="button" data-mutual-group-toggle="${escapeHtml(group.id)}" aria-expanded="${section.expanded}" aria-controls="${escapeHtml(contentId)}">
      <span class="mutual-group-accordion-icon" aria-hidden="true">🤲</span>
      <span class="mutual-group-accordion-copy"><small>Grupo de mutuários · ${section.active ? 'Ativo' : 'Baixado'}</small><strong>${escapeHtml(group.name)}</strong><span>${section.eventSections.length} evento(s) no período · criado em ${escapeHtml(formatDate(group.createdDate))}</span></span>
      <span class="mutual-group-accordion-metrics"><span><small>Cobranças</small><strong>${section.charges.length}</strong></span><span><small>Em aberto</small><strong>${section.pendingCharges.length}</strong></span><span><small>Previsto</small><strong class="sensitive-money">${money.format(section.expectedTotal)}</strong></span></span>
      <span class="mutual-group-accordion-chevron" aria-hidden="true"></span>
    </button>
    <div class="mutual-group-accordion-content" id="${escapeHtml(contentId)}" ${section.expanded ? '' : 'hidden'}>
      <div class="mutual-group-period-summary"><span><strong>${section.visibleCharges.length}</strong> resultado(s) com os filtros atuais</span>${allGroupsMode ? '<small>Expanda somente os grupos que deseja analisar.</small>' : '<small>As cobranças são organizadas por evento de falecimento.</small>'}</div>
      ${section.eventSections.length ? section.eventSections.map(eventSection => renderEventSection(eventSection, adminUnlocked, avatar, empty)).join('') : empty('🕊️', 'Nenhum falecimento registrado para este grupo no período selecionado.')}
      <div class="membership-filter-empty mutual-group-empty" ${section.visibleCharges.length || !section.charges.length ? 'hidden' : ''}>🔎 Nenhuma cobrança deste grupo corresponde aos filtros selecionados.</div>
    </div>
  </article>`;
}

export function renderMutualSection({
  model,
  adminUnlocked,
  avatar,
  empty
}) {
  const {
    groups,
    selectedStart,
    selectedEnd,
    periodLabel: selectedPeriodLabel,
    groupFilter,
    groupSections,
    charges,
    visibleCharges,
    paidCharges,
    pendingCharges,
    expectedTotal,
    receivedTotal,
    selectedCharges,
    eventCount,
    search,
    statusFilter,
    expanded,
    allGroupsMode
  } = model;
  const selectedTotal = selectedCharges.reduce((sum, item) => sum + item.amount, 0);
  const activeGroups = groups.filter(group => !group.closedDate);

  return `<section class="card membership-control-card mutual-control-card mutual-control-card-v2 ${expanded ? 'is-expanded' : 'is-collapsed'}">
    <button class="membership-control-toggle mutual-control-header" id="mutualControlToggle" type="button" aria-expanded="${expanded}">
      <span class="mutual-control-heading"><span aria-hidden="true">🤲</span><span><strong>Mútuas por evento de falecimento</strong><small>Grupos não possuem mensalidade fixa. Cada falecimento gera uma cobrança única para os participantes daquele evento.</small></span></span><span class="membership-toggle-chevron" aria-hidden="true"></span>
    </button>
    <div class="membership-control-content mutual-control-content" ${expanded ? '' : 'hidden'}>
      <div class="mutual-filter-panel" aria-label="Filtros das mútuas">
        <div class="mutual-filter-panel-heading"><div><span class="section-eyebrow">Cobranças por evento</span><h3>Consulte falecimentos, grupos e participantes</h3><p>Sem recorrência mensal: as cobranças só aparecem após o registro de um falecimento.</p></div>${adminUnlocked ? '<div class="card-header-actions"><button class="btn btn-primary" id="createMutualEvent" type="button">🕊️ Registrar falecimento</button><button class="btn btn-ghost" id="manageMutualGroups" type="button">⚙ Gerenciar grupos</button></div>' : ''}</div>
        <div class="membership-toolbar membership-toolbar-v2 mutual-toolbar mutual-toolbar-v2">
          <label><span>Grupo de mutuários</span><select id="mutualGroupFilter" ${groups.length ? '' : 'disabled'}><option value="all" ${groupFilter === 'all' ? 'selected' : ''}>Todos os grupos</option>${groups.map(group => `<option value="${escapeHtml(group.id)}" ${groupFilter === group.id ? 'selected' : ''}>${escapeHtml(group.name)}${group.closedDate ? ' · Baixado' : ''}</option>`).join('')}</select></label>
          <label><span>Data inicial</span><input id="mutualStartFilter" type="date" value="${escapeHtml(selectedStart)}" ${groups.length ? '' : 'disabled'}></label>
          <label><span>Data final</span><input id="mutualEndFilter" type="date" value="${escapeHtml(selectedEnd)}" min="${escapeHtml(selectedStart)}" ${groups.length ? '' : 'disabled'}></label>
          <label class="membership-search-filter"><span>Pesquisar</span><input id="mutualSearch" type="search" value="${escapeHtml(search)}" placeholder="Falecido, participante ou grupo" ${groups.length ? '' : 'disabled'}></label>
          <label><span>Situação</span><select id="mutualStatusFilter" ${groups.length ? '' : 'disabled'}><option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>Em aberto</option><option value="paid" ${statusFilter === 'paid' ? 'selected' : ''}>Pagas</option><option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Todas</option></select></label>
        </div>
      </div>
      <div class="mutual-period-banner"><div><span aria-hidden="true">🕊️</span><div><small>Período dos falecimentos</small><strong>${escapeHtml(selectedPeriodLabel)}</strong><p>${eventCount} evento(s) · ${activeGroups.length} grupo(s) ativo(s)</p></div></div><div><small>Resultados filtrados</small><strong id="mutualVisibleCount">${visibleCharges.length}</strong></div></div>
      <div class="membership-kpis mutual-kpis mutual-kpis-v2"><div><small>Grupos ativos</small><strong>${activeGroups.length}</strong></div><div><small>Eventos</small><strong>${eventCount}</strong></div><div><small>Cobranças</small><strong>${charges.length}</strong></div><div><small>Em aberto</small><strong>${pendingCharges.length}</strong></div><div><small>Recebido</small><strong class="sensitive-money">${money.format(receivedTotal)}</strong></div><div><small>Previsto</small><strong class="sensitive-money">${money.format(expectedTotal)}</strong></div></div>
      ${adminUnlocked && groups.length ? `<div class="mutual-selection-bar ${selectedCharges.length ? 'has-selection' : ''}" id="mutualSelectionBar" role="status" aria-live="polite">
        <div><span aria-hidden="true">✓</span><div><small>Selecionadas para baixa</small><strong><b id="mutualSelectedCount">${selectedCharges.length}</b> cobrança(s) · <span class="sensitive-money" id="mutualSelectedTotal">${money.format(selectedTotal)}</span></strong></div></div>
        <div class="mutual-selection-actions"><button class="btn btn-ghost btn-sm" id="mutualSelectVisible" type="button" ${visibleCharges.some(item => !item.paid) ? '' : 'disabled'}>Selecionar pendentes filtradas</button><button class="btn btn-ghost btn-sm" id="mutualClearSelection" type="button" ${selectedCharges.length ? '' : 'disabled'}>Limpar seleção</button><button class="btn btn-primary" id="mutualPaymentButton" type="button" ${selectedCharges.length ? '' : 'disabled'}>Dar baixa selecionadas</button></div>
      </div>` : ''}
      <div class="mutual-groups-list" id="mutualChargeList">${!groups.length
        ? empty('🤲', 'Cadastre um grupo de mutuários. Nenhuma cobrança será criada até que um falecimento seja registrado.')
        : groupSections.map(section => renderGroupAccordion(section, allGroupsMode, adminUnlocked, avatar, empty)).join('')}</div>
      <div id="mutualFilterEmpty" class="membership-filter-empty mutual-filter-empty-global" ${visibleCharges.length || !charges.length ? 'hidden' : ''}>🔎 Nenhuma cobrança encontrada com os filtros selecionados.</div>
    </div>
  </section>`;
}
