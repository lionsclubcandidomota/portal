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

function activeGroupMembers(state, treasury, group) {
  const ids = [...new Set((Array.isArray(group?.memberships) ? group.memberships : [])
    .filter(membership => !membership?.endedDate)
    .map(membership => String(membership?.memberId || ''))
    .filter(Boolean))];
  return ids
    .map(id => state.birthdays.find(member => String(member?.id || '') === id))
    .filter(Boolean)
    .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))
    .map(member => ({
      member,
      type: treasury.memberIsMutual(member) ? 'Mutuário' : 'Associado'
    }));
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
    const members = activeGroupMembers(state, treasury, group);
    const eventSections = [...(Array.isArray(group.events) ? group.events : [])]
      .filter(event => !event.cancelledAt && eventInsideRange(event, selectedStart, selectedEnd))
      .sort((first, second) => String(second.deathDate || '').localeCompare(String(first.deathDate || '')))
      .map(event => {
        const eventMembers = treasury.mutualMembersForEvent(group.id, event.id)
          .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
        const amount = Math.max(0, Number(event.amountPerParticipant || 0));
        const charges = eventMembers.map(member => {
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
      view: treasury.mutualGroupView(group.id, eventSections.length > 0),
      members,
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
    expanded: treasury.mutualExpanded !== false,
    summary: {
      groups: groups.filter(group => !group.closedDate).length,
      events: eventCount, charges: charges.length, visibleCharges: visibleCharges.length,
      paid: paidCharges.length, pending: pendingCharges.length, expectedTotal, receivedTotal
    },
    source: 'local', page: 1, pages: 1, total: eventCount, queryDurationMs: 0
  };
}


export function buildOperationalMutualViewModel(state, treasury, remote) {
  const groups = Array.isArray(remote?.groups) ? remote.groups : [];
  const pageGroups = Array.isArray(remote?.pageGroups) ? remote.pageGroups : [];
  const remoteEvents = Array.isArray(remote?.events) ? remote.events : [];
  const selectedKeys = treasury.mutualSelectedCharges;
  const requestedGroup = String(treasury.mutualGroup || 'all');
  const groupFilter = requestedGroup === 'all' || !groups.some(group => String(group.id) === requestedGroup)
    ? 'all'
    : requestedGroup;
  const allGroupsMode = groupFilter === 'all';
  const eventsByGroup = new Map();
  remoteEvents.forEach(section => {
    const groupId = String(section?.group?.id || '');
    if (!eventsByGroup.has(groupId)) eventsByGroup.set(groupId, []);
    const group = section.group;
    const event = section.event;
    const charges = (Array.isArray(section.charges) ? section.charges : []).map(item => ({
      ...item,
      group,
      event,
      selected: !item.paid && selectedKeys.has(item.key),
      visible: item.visible !== false
    }));
    eventsByGroup.get(groupId).push({
      event,
      amount: Number(event?.amountPerParticipant || 0),
      charges,
      visibleCharges: charges.filter(item => item.visible),
      paidCharges: charges.filter(item => item.paid),
      pendingCharges: charges.filter(item => !item.paid),
      expectedTotal: Number(section.expectedTotal || 0),
      receivedTotal: Number(section.receivedTotal || 0)
    });
  });
  const groupSections = pageGroups.map(group => {
    const eventSections = eventsByGroup.get(String(group.id)) || [];
    const charges = eventSections.flatMap(section => section.charges);
    const currentMembers = Array.isArray(group.currentMembers) ? group.currentMembers : [];
    return {
      group,
      active: !group.closedDate,
      expanded: allGroupsMode ? treasury.isMutualGroupExpanded(group.id) : true,
      view: treasury.mutualGroupView(group.id, eventSections.length > 0),
      members: currentMembers.map(member => ({ member, type: treasury.memberIsMutual(member) ? 'Mutuário' : 'Associado' })),
      eventSections,
      charges,
      visibleCharges: charges.filter(item => item.visible),
      paidCharges: charges.filter(item => item.paid),
      pendingCharges: charges.filter(item => !item.paid),
      expectedTotal: eventSections.reduce((sum, item) => sum + Number(item.expectedTotal || 0), 0),
      receivedTotal: eventSections.reduce((sum, item) => sum + Number(item.receivedTotal || 0), 0)
    };
  });
  const charges = groupSections.flatMap(section => section.charges);
  const selectedCharges = charges.filter(item => !item.paid && selectedKeys.has(item.key));
  const summary = remote?.summary || {};
  return {
    groups,
    selectedGroups: groupFilter === 'all' ? groups : groups.filter(group => String(group.id) === groupFilter),
    selectedStart: treasury.mutualStart || '',
    selectedEnd: treasury.mutualEnd || '',
    periodLabel: periodLabel(treasury.mutualStart || '', treasury.mutualEnd || ''),
    groupFilter,
    allGroupsMode,
    groupSections,
    charges,
    visibleCharges: charges.filter(item => item.visible),
    paidCharges: charges.filter(item => item.paid),
    pendingCharges: charges.filter(item => !item.paid),
    expectedTotal: Number(summary.expectedTotal || 0),
    receivedTotal: Number(summary.receivedTotal || 0),
    selectedCharges,
    eventCount: Number(summary.events || 0),
    search: String(treasury.mutualSearch || ''),
    statusFilter: String(treasury.mutualStatus || 'pending'),
    expanded: treasury.mutualExpanded !== false,
    summary,
    source: String(remote?.source || ''),
    page: Math.max(1, Number(remote?.page || 1)),
    pages: Math.max(1, Number(remote?.pages || 1)),
    total: Math.max(0, Number(remote?.total || 0)),
    queryDurationMs: Math.max(0, Number(remote?.queryDurationMs || 0))
  };
}

function renderChargeRow(item, adminUnlocked, avatar) {
  const paymentDate = item.payment?.paymentDate || item.payment?.date || '';
  const statusLabel = item.paid ? 'Paga' : 'Em aberto';
  const paymentDetail = item.paid
    ? `Recebida em ${escapeHtml(formatDate(paymentDate))}`
    : 'Aguardando recebimento';
  const choice = adminUnlocked && !item.paid
    ? `<input class="mutual-charge-checkbox" type="checkbox" value="${escapeHtml(item.key)}" ${item.selected ? 'checked' : ''} aria-label="Selecionar cobrança de ${escapeHtml(item.member.name)}"><i aria-hidden="true">✓</i>`
    : '<i class="is-readonly" aria-hidden="true">✓</i>';

  return `<label class="mutual-charge-row mutual-charge-card ${item.paid ? 'is-paid' : 'is-pending'} ${item.selected ? 'is-selected' : ''}" data-mutual-key="${escapeHtml(item.key)}" data-mutual-search="${escapeHtml(normalize(`${item.member.name || ''} ${item.member.memberNumber || ''} ${item.group.name || ''} ${item.event.deceasedName || ''}`))}" data-mutual-status="${item.paid ? 'paid' : 'pending'}" data-mutual-amount="${item.amount}" data-mutual-group-id="${escapeHtml(item.group.id)}" data-mutual-event-id="${escapeHtml(item.event.id)}" ${item.visible ? '' : 'hidden'}>
    <span class="mutual-charge-choice">${choice}</span>
    <span class="mutual-charge-avatar">${avatar(item.member)}</span>
    <span class="mutual-charge-person"><strong>${escapeHtml(item.member.name)}</strong><small>${item.member.memberNumber ? `Nº ${escapeHtml(item.member.memberNumber)}` : 'Sem número informado'}</small></span>
    <span class="mutual-charge-state ${item.paid ? 'is-paid' : 'is-pending'}"><i aria-hidden="true"></i>${statusLabel}</span>
    <span class="mutual-charge-value"><strong class="sensitive-money">${money.format(item.displayAmount)}</strong><small>${paymentDetail}</small></span>
  </label>`;
}

function renderEventSection(section, adminUnlocked, avatar, empty, expanded) {
  const { event } = section;
  const content = section.charges.length
    ? section.charges.map(item => renderChargeRow(item, adminUnlocked, avatar)).join('')
    : empty('👥', 'Nenhum participante foi incluído neste evento.');
  const deceasedDetails = [
    event.deceasedMemberNumber ? `Nº ${event.deceasedMemberNumber}` : '',
    event.deceasedClub
  ].filter(Boolean).join(' · ');

  return `<details class="mutual-event-card" data-mutual-event-section="${escapeHtml(event.id)}" ${expanded ? 'open' : ''}>
    <summary class="mutual-event-summary">
      <span class="mutual-event-icon" aria-hidden="true">🕊️</span>
      <span class="mutual-event-copy"><small>Falecimento registrado</small><strong>${escapeHtml(event.deceasedName)}</strong><span>${escapeHtml(formatDate(event.deathDate))}${deceasedDetails ? ` · ${escapeHtml(deceasedDetails)}` : ''}</span></span>
      <span class="mutual-event-status"><span><small>Em aberto</small><strong>${section.pendingCharges.length}</strong></span><span><small>Pagas</small><strong>${section.paidCharges.length}</strong></span><span><small>Previsto</small><strong class="sensitive-money">${money.format(section.expectedTotal)}</strong></span></span>
      <span class="mutual-event-chevron" aria-hidden="true"></span>
    </summary>
    <div class="mutual-event-content">
      ${event.notes ? `<p class="mutual-event-notes">${escapeHtml(event.notes)}</p>` : ''}
      <div class="mutual-event-toolbar"><div><strong>Cobranças deste falecimento</strong><small><b class="mutual-event-visible-count">${section.visibleCharges.length}</b> de ${section.charges.length} participante(s) exibido(s)</small></div>${adminUnlocked && section.pendingCharges.length ? `<button class="btn btn-ghost btn-sm" type="button" data-mutual-select-event="${escapeHtml(event.id)}">Selecionar pendentes deste evento</button>` : ''}</div>
      <div class="mutual-charge-table" role="table" aria-label="Cobranças pelo falecimento de ${escapeHtml(event.deceasedName)}">
        <div class="mutual-charge-table-head" role="row"><span></span><span>Participante</span><span>Situação</span><span>Valor</span></div>
        <div class="mutual-charge-table-body">${content}</div>
      </div>
      <div class="membership-filter-empty mutual-event-empty" ${section.visibleCharges.length || !section.charges.length ? 'hidden' : ''}>🔎 Nenhuma cobrança deste evento corresponde aos filtros.</div>
      <div class="mutual-event-totals"><span><small>Recebido</small><strong class="sensitive-money">${money.format(section.receivedTotal)}</strong></span><span><small>Em aberto</small><strong class="sensitive-money">${money.format(section.expectedTotal - section.receivedTotal)}</strong></span><span><small>Total do evento</small><strong class="sensitive-money">${money.format(section.expectedTotal)}</strong></span></div>
    </div>
  </details>`;
}

function renderGroupMembers(section, avatar, empty) {
  const content = section.members.length
    ? section.members.map(({ member, type }) => `<article class="mutual-group-member-card" data-mutual-group-member="${escapeHtml(member.id)}">${avatar(member)}<span class="mutual-group-member-copy"><strong>${escapeHtml(member.name)}</strong><small>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número informado'}</small></span><span class="mutual-group-member-type">${escapeHtml(type)}</span></article>`).join('')
    : empty('👥', 'Nenhum participante ativo vinculado a este grupo.');

  return `<section class="mutual-group-members" aria-label="Participantes atuais de ${escapeHtml(section.group.name)}">
    <div class="mutual-group-members-heading"><div><small>Composição atual do grupo</small><strong>Associados e mutuários ativos</strong><p>Esta lista define quem participará de novos eventos. Eventos anteriores preservam a composição original.</p></div><span>${section.members.length} participante(s)</span></div>
    <div class="mutual-group-member-grid">${content}</div>
  </section>`;
}

function renderGroupAccordion(section, allGroupsMode, adminUnlocked, avatar, empty) {
  const { group } = section;
  const safeGroupId = String(group.id).replace(/[^a-zA-Z0-9_-]/g, '-');
  const contentId = `mutual-group-content-${safeGroupId}`;
  const chargesPanelId = `mutual-group-charges-${safeGroupId}`;
  const participantsPanelId = `mutual-group-participants-${safeGroupId}`;
  const chargesActive = section.view === 'charges';

  return `<article class="mutual-group-accordion ${section.expanded ? 'is-expanded' : 'is-collapsed'}" data-mutual-group-section="${escapeHtml(group.id)}">
    <button class="mutual-group-accordion-toggle" type="button" data-mutual-group-toggle="${escapeHtml(group.id)}" aria-expanded="${section.expanded}" aria-controls="${escapeHtml(contentId)}">
      <span class="mutual-group-accordion-icon" aria-hidden="true">🤲</span>
      <span class="mutual-group-accordion-copy"><small>Grupo de mutuários · ${section.active ? 'Ativo' : 'Baixado'}</small><strong>${escapeHtml(group.name)}</strong><span>${section.members.length} participante(s) · ${section.eventSections.length} evento(s) no período · criado em ${escapeHtml(formatDate(group.createdDate))}</span></span>
      <span class="mutual-group-accordion-metrics"><span><small>Cobranças</small><strong>${section.charges.length}</strong></span><span><small>Em aberto</small><strong>${section.pendingCharges.length}</strong></span><span><small>Previsto</small><strong class="sensitive-money">${money.format(section.expectedTotal)}</strong></span></span>
      <span class="mutual-group-accordion-chevron" aria-hidden="true"></span>
    </button>
    <div class="mutual-group-accordion-content" id="${escapeHtml(contentId)}" ${section.expanded ? '' : 'hidden'}>
      <div class="mutual-group-view-tabs" role="tablist" aria-label="Informações de ${escapeHtml(group.name)}">
        <button type="button" role="tab" class="${chargesActive ? 'is-active' : ''}" data-mutual-group-view="charges" data-mutual-group-id="${escapeHtml(group.id)}" aria-selected="${chargesActive}" aria-controls="${escapeHtml(chargesPanelId)}"><span aria-hidden="true">🧾</span><strong>Cobranças</strong><small>${section.charges.length} lançamento(s)</small></button>
        <button type="button" role="tab" class="${chargesActive ? '' : 'is-active'}" data-mutual-group-view="participants" data-mutual-group-id="${escapeHtml(group.id)}" aria-selected="${!chargesActive}" aria-controls="${escapeHtml(participantsPanelId)}"><span aria-hidden="true">👥</span><strong>Participantes</strong><small>${section.members.length} pessoa(s)</small></button>
      </div>
      <section class="mutual-group-view-panel" id="${escapeHtml(chargesPanelId)}" data-mutual-group-panel="charges" role="tabpanel" ${chargesActive ? '' : 'hidden'}>
        <div class="mutual-group-period-summary"><span><strong>${section.visibleCharges.length}</strong> cobrança(s) com os filtros atuais</span>${allGroupsMode ? '<small>Os participantes do grupo ficam disponíveis na aba ao lado.</small>' : '<small>As cobranças são agrupadas por falecimento.</small>'}</div>
        <div class="mutual-event-list">${section.eventSections.length
          ? section.eventSections.map((eventSection, index) => renderEventSection(eventSection, adminUnlocked, avatar, empty, index === 0)).join('')
          : empty('🕊️', 'Nenhum falecimento registrado para este grupo no período selecionado.')}</div>
        <div class="membership-filter-empty mutual-group-empty" ${section.visibleCharges.length || !section.charges.length ? 'hidden' : ''}>🔎 Nenhuma cobrança deste grupo corresponde aos filtros selecionados.</div>
      </section>
      <section class="mutual-group-view-panel" id="${escapeHtml(participantsPanelId)}" data-mutual-group-panel="participants" role="tabpanel" ${chargesActive ? 'hidden' : ''}>
        ${renderGroupMembers(section, avatar, empty)}
      </section>
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
    pendingCharges,
    expectedTotal,
    receivedTotal,
    selectedCharges,
    eventCount,
    search,
    statusFilter,
    expanded,
    allGroupsMode,
    summary,
    source,
    page,
    pages,
    total,
    queryDurationMs
  } = model;
  const selectedTotal = selectedCharges.reduce((sum, item) => sum + item.amount, 0);
  const activeGroups = groups.filter(group => !group.closedDate);
  const summaryGroups = Number(summary?.groups ?? activeGroups.length);
  const summaryEvents = Number(summary?.events ?? eventCount);
  const summaryCharges = Number(summary?.charges ?? charges.length);
  const summaryPending = Number(summary?.pending ?? pendingCharges.length);
  const summaryVisible = Number(summary?.visibleCharges ?? visibleCharges.length);

  return `<section class="card membership-control-card mutual-control-card mutual-control-card-v2 ${expanded ? 'is-expanded' : 'is-collapsed'}">
    <button class="membership-control-toggle mutual-control-header" id="mutualControlToggle" type="button" aria-expanded="${expanded}">
      <span class="mutual-control-heading"><span aria-hidden="true">🤲</span><span><strong>Mútuas por evento de falecimento</strong><small>O grupo define os participantes. Cada falecimento cria uma cobrança única, acompanhada separadamente.</small></span></span><span class="membership-toggle-chevron" aria-hidden="true"></span>
    </button>
    <div class="membership-control-content mutual-control-content" ${expanded ? '' : 'hidden'}>
      <div class="mutual-filter-panel" aria-label="Filtros das mútuas">
        <div class="mutual-filter-panel-heading"><div><span class="section-eyebrow">Fluxo por evento</span><h3>Grupos, falecimentos e cobranças</h3><p>Consulte as cobranças por falecimento ou abra a aba Participantes de cada grupo para conferir sua composição.</p></div>${adminUnlocked ? '<div class="card-header-actions"><button class="btn btn-primary" id="createMutualEvent" type="button">🕊️ Registrar falecimento</button><button class="btn btn-ghost" id="manageMutualGroups" type="button">⚙ Gerenciar grupos</button></div>' : ''}</div>
        <div class="membership-toolbar membership-toolbar-v2 mutual-toolbar mutual-toolbar-v2">
          <label><span>Grupo de mutuários</span><select id="mutualGroupFilter" ${groups.length ? '' : 'disabled'}><option value="all" ${groupFilter === 'all' ? 'selected' : ''}>Todos os grupos</option>${groups.map(group => `<option value="${escapeHtml(group.id)}" ${groupFilter === group.id ? 'selected' : ''}>${escapeHtml(group.name)}${group.closedDate ? ' · Baixado' : ''}</option>`).join('')}</select></label>
          <label><span>Data inicial</span><input id="mutualStartFilter" type="date" value="${escapeHtml(selectedStart)}" ${groups.length ? '' : 'disabled'}></label>
          <label><span>Data final</span><input id="mutualEndFilter" type="date" value="${escapeHtml(selectedEnd)}" min="${escapeHtml(selectedStart)}" ${groups.length ? '' : 'disabled'}></label>
          <label class="membership-search-filter"><span>Pesquisar cobranças</span><input id="mutualSearch" type="search" value="${escapeHtml(search)}" placeholder="Falecido ou participante cobrado" ${groups.length ? '' : 'disabled'}></label>
          <label><span>Situação</span><select id="mutualStatusFilter" ${groups.length ? '' : 'disabled'}><option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>Em aberto</option><option value="paid" ${statusFilter === 'paid' ? 'selected' : ''}>Pagas</option><option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Todas</option></select></label>
        </div>
      </div>
      <div class="mutual-period-banner"><div><span aria-hidden="true">🕊️</span><div><small>Período dos falecimentos</small><strong>${escapeHtml(selectedPeriodLabel)}</strong><p>${summaryEvents} evento(s) · ${summaryGroups} grupo(s) ativo(s)</p></div></div><div><small>Cobranças filtradas</small><strong id="mutualVisibleCount">${summaryVisible}</strong></div></div>
      <div class="mutual-operational-source"><span class="badge ${String(source).startsWith('d1') ? 'badge-success' : 'badge-warning'}">${String(source).startsWith('d1') ? `D1 · eventos paginados${queryDurationMs ? ` · ${queryDurationMs} ms` : ''}` : 'Modo local de contingência'}</span></div>
      <div class="membership-kpis mutual-kpis mutual-kpis-v2"><div><small>Grupos ativos</small><strong>${summaryGroups}</strong></div><div><small>Eventos</small><strong>${summaryEvents}</strong></div><div><small>Cobranças</small><strong>${summaryCharges}</strong></div><div><small>Em aberto</small><strong>${summaryPending}</strong></div><div><small>Recebido</small><strong class="sensitive-money">${money.format(receivedTotal)}</strong></div><div><small>Previsto</small><strong class="sensitive-money">${money.format(expectedTotal)}</strong></div></div>
      ${adminUnlocked && charges.length ? `<div class="mutual-selection-bar ${selectedCharges.length ? 'has-selection' : 'is-empty'}" id="mutualSelectionBar" role="status" aria-live="polite">
        <div><span aria-hidden="true">✓</span><div><small>Baixa de cobranças</small><strong><b id="mutualSelectedCount">${selectedCharges.length}</b> selecionada(s) · <span class="sensitive-money" id="mutualSelectedTotal">${money.format(selectedTotal)}</span></strong><p>${selectedCharges.length ? 'Revise a seleção antes de registrar os recebimentos.' : 'Selecione cobranças em aberto dentro de um evento.'}</p></div></div>
        <div class="mutual-selection-actions"><button class="btn btn-ghost btn-sm" id="mutualSelectVisible" type="button" ${visibleCharges.some(item => !item.paid) ? '' : 'disabled'}>Selecionar pendentes filtradas</button><button class="btn btn-ghost btn-sm" id="mutualClearSelection" type="button" ${selectedCharges.length ? '' : 'disabled'}>Limpar seleção</button><button class="btn btn-primary" id="mutualPaymentButton" type="button" ${selectedCharges.length ? '' : 'disabled'}>Registrar baixa</button></div>
      </div>` : ''}
      <div class="mutual-groups-list" id="mutualChargeList">${!groups.length
        ? empty('🤲', 'Cadastre um grupo de mutuários. Nenhuma cobrança será criada até que um falecimento seja registrado.')
        : groupSections.map(section => renderGroupAccordion(section, allGroupsMode, adminUnlocked, avatar, empty)).join('')}</div>
      ${pages > 1 ? `<nav class="list-pagination mutual-events-pagination" aria-label="Paginação dos eventos de Mútuas"><button class="btn btn-ghost btn-sm" type="button" data-mutual-event-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>← Anterior</button><span>Eventos · página <strong>${page}</strong> de ${pages} · ${total} resultado(s)</span><button class="btn btn-ghost btn-sm" type="button" data-mutual-event-page="${page + 1}" ${page === pages ? 'disabled' : ''}>Próxima →</button></nav>` : ''}
      <div id="mutualFilterEmpty" class="membership-filter-empty mutual-filter-empty-global" ${visibleCharges.length || !charges.length ? 'hidden' : ''}>🔎 Nenhuma cobrança encontrada com os filtros selecionados.</div>
    </div>
  </section>`;
}
