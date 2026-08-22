import {
  escapeHtml,
  formatDate,
  money,
  normalize
} from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.52.0';

function latestPayment(payments = []) {
  return [...payments]
    .sort((first, second) => String(second.paymentDate || second.date || '')
      .localeCompare(String(first.paymentDate || first.date || '')))[0] || null;
}

function dateWithinRange(value, start, end) {
  if (!value) return false;
  return (!start || value >= start) && (!end || value <= end);
}

function periodLabel(start, end) {
  if (!start && !end) return 'Todas as ocorrências';
  if (start && end) return `${formatDate(start)} até ${formatDate(end)}`;
  if (start) return `A partir de ${formatDate(start)}`;
  return `Até ${formatDate(end)}`;
}

function mutualChargeCreatedDate(event = {}) {
  const createdDate = String(event.createdDate || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(createdDate)) return createdDate;

  const createdAt = String(event.createdAt || '');
  if (createdAt) {
    const date = new Date(createdAt);
    if (!Number.isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  return String(event.occurrenceDate || '');
}

export function buildMutualViewModel(state, treasury) {
  const groups = [...treasury.mutualGroups()]
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR'));
  const selectedStart = String(treasury.mutualStart || '');
  const selectedEnd = String(treasury.mutualEnd || '');
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
    const activeParticipants = treasury.mutualActiveMembers(group.id)
      .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))
      .map(member => ({
        member,
        kind: treasury.memberIsMutual(member) ? 'mutual' : 'associate',
        label: treasury.memberIsMutual(member) ? 'Mutuário' : 'Associado'
      }));
    const associateCount = activeParticipants.filter(item => item.kind === 'associate').length;
    const mutualCount = activeParticipants.filter(item => item.kind === 'mutual').length;
    const eventSections = [...(group.events || [])]
      .filter(event => dateWithinRange(event.occurrenceDate, selectedStart, selectedEnd))
      .sort((first, second) => String(second.occurrenceDate || '').localeCompare(String(first.occurrenceDate || '')))
      .map(event => {
        const members = treasury.mutualMembersForEvent(group.id, event.id)
          .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
        const charges = members.map(member => {
          const key = treasury.mutualChargeKey(group.id, event.id, member.id);
          const payment = latestPayment(treasury.mutualPaymentsFor(group.id, member.id, event.id));
          const paid = Boolean(payment);
          const amount = Math.max(0, Number(event.amount || 0));
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
            `${member.name || ''} ${member.memberNumber || ''} ${group.name || ''} ${event.deceasedName || ''} ${event.occurrenceDate || ''}`
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
      expanded: allGroupsMode ? treasury.isMutualGroupExpanded(group.id) : true,
      activeParticipants,
      associateCount,
      mutualCount,
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
  const events = groupSections.flatMap(section => section.eventSections);

  return {
    groups,
    selectedGroups,
    selectedGroup: groupFilter === 'all' ? null : selectedGroups[0] || null,
    selectedStart,
    selectedEnd,
    periodLabel: periodLabel(selectedStart, selectedEnd),
    groupFilter,
    allGroupsMode,
    groupSections,
    events,
    charges,
    visibleCharges,
    paidCharges,
    pendingCharges,
    expectedTotal,
    receivedTotal,
    selectedCharges,
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
    : `Cobrança gerada em ${escapeHtml(formatDate(mutualChargeCreatedDate(item.event)))}`;
  return `<article class="membership-member mutual-charge-card ${item.paid ? 'is-paid' : 'is-pending'} ${item.selected ? 'is-selected' : ''}" data-mutual-key="${escapeHtml(item.key)}" data-mutual-search="${escapeHtml(normalize(`${item.member.name || ''} ${item.member.memberNumber || ''} ${item.group.name || ''} ${item.event.deceasedName || ''}`))}" data-mutual-status="${item.paid ? 'paid' : 'pending'}" data-mutual-amount="${item.amount}" data-mutual-group-id="${escapeHtml(item.group.id)}" data-mutual-event-id="${escapeHtml(item.event.id)}" ${item.visible ? '' : 'hidden'}>
    <label class="membership-member-main mutual-charge-main">
      <span class="mutual-charge-choice">${adminUnlocked && !item.paid ? `<input class="mutual-charge-checkbox" type="checkbox" value="${escapeHtml(item.key)}" ${item.selected ? 'checked' : ''} aria-label="Selecionar cobrança de ${escapeHtml(item.member.name)} referente ao falecimento de ${escapeHtml(item.event.deceasedName)}"><i aria-hidden="true">${uiIcon('check')}</i>` : `<i class="is-readonly" aria-hidden="true">${uiIcon('check')}</i>`}</span>
      <span class="membership-avatar-shell">${avatar(item.member)}<span class="membership-avatar-state" aria-hidden="true"></span></span>
      <span class="membership-member-copy"><span class="membership-member-heading"><strong>${escapeHtml(item.member.name)}</strong><span class="membership-state-pill"><i aria-hidden="true"></i>${statusLabel}</span></span><span class="membership-member-meta"><small>${item.member.memberNumber ? `Nº ${escapeHtml(item.member.memberNumber)}` : 'Sem número informado'}</small><span class="membership-family-chip">${uiIcon('heart')} ${escapeHtml(item.group.name)}</span></span></span>
      <span class="membership-progress-panel mutual-charge-summary"><span class="membership-progress-heading"><b class="sensitive-money">${money.format(item.displayAmount)}</b><small>${paymentDetail}</small></span><small class="membership-progress-note">${item.paid ? 'Cobrança quitada' : 'Selecione para registrar o recebimento'}</small></span>
    </label>
  </article>`;
}

function renderEventSection(section, adminUnlocked, avatar, empty) {
  const { event } = section;
  const content = section.charges.length
    ? section.charges.map(item => renderChargeCard(item, adminUnlocked, avatar)).join('')
    : empty('users', 'Nenhum participante foi incluído nesta ocorrência.');
  return `<section class="mutual-month-section mutual-event-section" data-mutual-event-section="${escapeHtml(event.id)}">
    <div class="mutual-month-heading mutual-event-heading"><div><span aria-hidden="true">${uiIcon('heart')}</span><div><strong>Falecimento de ${escapeHtml(event.deceasedName)}</strong><small>${escapeHtml(formatDate(event.occurrenceDate))} · ${section.charges.length} cobrança(s) · ${section.pendingCharges.length} em aberto</small>${event.notes ? `<p>${escapeHtml(event.notes)}</p>` : ''}</div></div><div><small>Recebido / previsto</small><strong class="sensitive-money">${money.format(section.receivedTotal)} / ${money.format(section.expectedTotal)}</strong></div></div>
    <div class="membership-list mutual-charge-list">${content}</div>
    <div class="membership-filter-empty mutual-event-empty" ${section.visibleCharges.length || !section.charges.length ? 'hidden' : ''}>${uiIcon('search')} Nenhum participante desta ocorrência corresponde aos filtros.</div>
  </section>`;
}

function renderActiveParticipants(section, avatar, empty) {
  const content = section.activeParticipants.length
    ? section.activeParticipants.map(({ member, kind, label }) => `<article class="mutual-participant-card is-${kind}">
      <span class="mutual-participant-avatar">${avatar(member)}</span>
      <span class="mutual-participant-copy"><strong>${escapeHtml(member.name)}</strong><small>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número de associado'}</small></span>
      <span class="mutual-participant-type is-${kind}">${label}</span>
    </article>`).join('')
    : empty('users', 'Nenhum participante ativo neste grupo.');

  return `<section class="mutual-participants-panel" aria-label="Participantes atuais de ${escapeHtml(section.group.name)}">
    <div class="mutual-participants-heading"><div><span class="section-eyebrow">Participantes atuais</span><h4>Quem participa das próximas cobranças</h4><p>Associados e mutuários aparecem separados por identificação visual.</p></div><div class="mutual-participant-counts"><span><strong>${section.activeParticipants.length}</strong><small>Total</small></span><span class="is-associate"><strong>${section.associateCount}</strong><small>Associados</small></span><span class="is-mutual"><strong>${section.mutualCount}</strong><small>Mutuários</small></span></div></div>
    <div class="mutual-participants-list">${content}</div>
  </section>`;
}

function renderGroupAccordion(section, allGroupsMode, adminUnlocked, avatar, empty) {
  const { group } = section;
  const contentId = `mutual-group-content-${String(group.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return `<article class="mutual-group-accordion ${section.expanded ? 'is-expanded' : 'is-collapsed'}" data-mutual-group-section="${escapeHtml(group.id)}">
    <button class="mutual-group-accordion-toggle" type="button" data-mutual-group-toggle="${escapeHtml(group.id)}" aria-expanded="${section.expanded}" aria-controls="${escapeHtml(contentId)}">
      <span class="mutual-group-accordion-icon" aria-hidden="true">${uiIcon('heart')}</span>
      <span class="mutual-group-accordion-copy"><small>Grupo de mútua</small><strong>${escapeHtml(group.name)}</strong><span>${section.activeParticipants.length} participante(s): ${section.associateCount} associado(s) · ${section.mutualCount} mutuário(s)</span></span>
      <span class="mutual-group-accordion-metrics"><span><small>Cobranças</small><strong>${section.charges.length}</strong></span><span><small>Em aberto</small><strong>${section.pendingCharges.length}</strong></span><span><small>Previsto</small><strong class="sensitive-money">${money.format(section.expectedTotal)}</strong></span></span>
      <span class="mutual-group-accordion-chevron" aria-hidden="true"></span>
    </button>
    <div class="mutual-group-accordion-content" id="${escapeHtml(contentId)}" ${section.expanded ? '' : 'hidden'}>
      ${renderActiveParticipants(section, avatar, empty)}
      <div class="mutual-group-period-summary"><span><strong>${section.visibleCharges.length}</strong> resultado(s) com os filtros atuais</span>${allGroupsMode ? '<small>Expanda somente os grupos que deseja analisar.</small>' : '<small>Cada ocorrência preserva os participantes incluídos no momento do registro.</small>'}</div>
      ${section.eventSections.length ? section.eventSections.map(eventSection => renderEventSection(eventSection, adminUnlocked, avatar, empty)).join('') : empty('heart', 'Nenhum falecimento foi registrado para este grupo no período selecionado.')}
      <div class="membership-filter-empty mutual-group-empty" ${section.visibleCharges.length || !section.charges.length ? 'hidden' : ''}>${uiIcon('search')} Nenhuma cobrança deste grupo corresponde aos filtros selecionados.</div>
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
    events,
    charges,
    visibleCharges,
    paidCharges,
    pendingCharges,
    expectedTotal,
    receivedTotal,
    selectedCharges,
    search,
    statusFilter,
    expanded,
    allGroupsMode
  } = model;
  const selectedTotal = selectedCharges.reduce((sum, item) => sum + item.amount, 0);

  return `<section class="card membership-control-card mutual-control-card mutual-control-card-v2 ${expanded ? 'is-expanded' : 'is-collapsed'}">
    <button class="membership-control-toggle mutual-control-header" id="mutualControlToggle" type="button" aria-expanded="${expanded}">
      <span class="mutual-control-heading"><span aria-hidden="true">${uiIcon('heart')}</span><span><strong>Controle de mútuas por falecimento</strong><small>Nenhuma cobrança é criada mensalmente. As cobranças surgem somente quando um falecimento é registrado.</small></span></span><span class="membership-toggle-chevron" aria-hidden="true"></span>
    </button>
    <div class="membership-control-content mutual-control-content" ${expanded ? '' : 'hidden'}>
      <div class="mutual-filter-panel" aria-label="Filtros das mútuas">
        <div class="mutual-filter-panel-heading"><div><span class="section-eyebrow">Cobranças eventuais</span><h3>Falecimentos registrados no Distrito</h3><p>Cadastre uma ocorrência somente quando houver falecimento. O Portal gera uma cobrança individual para cada participante do grupo.</p></div>${adminUnlocked ? `<div class="card-header-actions"><button class="btn btn-ghost" id="manageMutualGroups" type="button">${uiIcon('settings')} Gerenciar grupos</button><button class="btn btn-primary" id="registerMutualEvent" type="button">${uiIcon('heart')} Registrar falecimento</button></div>` : ''}</div>
        <div class="membership-toolbar membership-toolbar-v2 mutual-toolbar mutual-toolbar-v2">
          <label><span>Grupo de mútua</span><select id="mutualGroupFilter" ${groups.length ? '' : 'disabled'}><option value="all" ${groupFilter === 'all' ? 'selected' : ''}>Todos os grupos</option>${groups.map(group => `<option value="${escapeHtml(group.id)}" ${groupFilter === group.id ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}</select></label>
          <label><span>Data inicial</span><input id="mutualStartFilter" type="date" value="${escapeHtml(selectedStart)}" ${groups.length ? '' : 'disabled'}></label>
          <label><span>Data final</span><input id="mutualEndFilter" type="date" value="${escapeHtml(selectedEnd)}" min="${escapeHtml(selectedStart)}" ${groups.length ? '' : 'disabled'}></label>
          <label class="membership-search-filter"><span>Pesquisar</span><input id="mutualSearch" type="search" value="${escapeHtml(search)}" placeholder="Mutuário, falecido ou grupo" ${groups.length ? '' : 'disabled'}></label>
          <label><span>Situação</span><select id="mutualStatusFilter" ${groups.length ? '' : 'disabled'}><option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>Em aberto</option><option value="paid" ${statusFilter === 'paid' ? 'selected' : ''}>Pagas</option><option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Todas</option></select></label>
        </div>
      </div>
      <div class="mutual-period-banner"><div><span aria-hidden="true">${uiIcon('heart')}</span><div><small>Período das ocorrências</small><strong>${escapeHtml(selectedPeriodLabel)}</strong><p>${events.length} ocorrência(s) · ${groupFilter === 'all' ? `${groupSections.length} grupo(s)` : escapeHtml(groupSections[0]?.group.name || 'Grupo não encontrado')}</p></div></div><div><small>Resultados filtrados</small><strong id="mutualVisibleCount">${visibleCharges.length}</strong></div></div>
      <div class="membership-kpis mutual-kpis mutual-kpis-v2"><div><small>Grupos exibidos</small><strong>${groupSections.length}</strong></div><div><small>Falecimentos</small><strong>${events.length}</strong></div><div><small>Cobranças</small><strong>${charges.length}</strong></div><div><small>Pagas</small><strong>${paidCharges.length}</strong></div><div><small>Em aberto</small><strong>${pendingCharges.length}</strong></div><div><small>Recebido</small><strong class="sensitive-money">${money.format(receivedTotal)}</strong></div><div><small>Previsto</small><strong class="sensitive-money">${money.format(expectedTotal)}</strong></div></div>
      ${adminUnlocked && groups.length ? `<div class="mutual-selection-bar ${selectedCharges.length ? 'has-selection' : ''}" id="mutualSelectionBar" role="status" aria-live="polite">
        <div><span aria-hidden="true">${uiIcon('check')}</span><div><small>Selecionadas para baixa</small><strong><b id="mutualSelectedCount">${selectedCharges.length}</b> cobrança(s) · <span class="sensitive-money" id="mutualSelectedTotal">${money.format(selectedTotal)}</span></strong></div></div>
        <div class="mutual-selection-actions"><button class="btn btn-ghost btn-sm" id="mutualSelectVisible" type="button" ${visibleCharges.some(item => !item.paid) ? '' : 'disabled'}>Selecionar pendentes filtradas</button><button class="btn btn-ghost btn-sm" id="mutualClearSelection" type="button" ${selectedCharges.length ? '' : 'disabled'}>Limpar seleção</button><button class="btn btn-primary" id="mutualPaymentButton" type="button" ${selectedCharges.length ? '' : 'disabled'}>Dar baixa selecionadas</button></div>
      </div>` : ''}
      <div class="mutual-groups-list" id="mutualChargeList">${!groups.length
        ? empty('heart', 'Cadastre um grupo de mútua. As cobranças serão criadas somente após o registro de um falecimento.')
        : groupSections.map(section => renderGroupAccordion(section, allGroupsMode, adminUnlocked, avatar, empty)).join('')}</div>
      <div id="mutualFilterEmpty" class="membership-filter-empty mutual-filter-empty-global" ${visibleCharges.length || !charges.length ? 'hidden' : ''}>${uiIcon('search')} Nenhuma cobrança encontrada com os filtros selecionados.</div>
    </div>
  </section>`;
}
