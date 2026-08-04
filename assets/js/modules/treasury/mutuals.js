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

function periodLabel(treasury, start, end) {
  if (!start) return 'Período não informado';
  if (!end || start === end) return treasury.monthLabel(start);
  return `${treasury.monthLabel(start)} até ${treasury.monthLabel(end)}`;
}

export function buildMutualViewModel(state, treasury) {
  const groups = [...treasury.mutualGroups()]
    .sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR'));
  const selectedStart = treasury.mutualStart || treasury.mutualMonth || treasury.currentMonth();
  const requestedEnd = treasury.mutualEnd || selectedStart;
  const selectedEnd = requestedEnd < selectedStart ? selectedStart : requestedEnd;
  const months = treasury.monthRange(selectedStart, selectedEnd);
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
    const monthSections = months.map(month => {
      const amount = treasury.mutualAmountForMonth(group, month);
      const members = treasury.mutualMembersForMonth(group.id, month)
        .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
      const charges = members.map(member => {
        const key = treasury.mutualChargeKey(group.id, member.id, month);
        const payment = latestPayment(treasury.mutualPaymentsFor(group.id, member.id, month));
        const paid = Boolean(payment);
        const item = {
          key,
          group,
          member,
          month,
          monthLabel: treasury.monthLabel(month),
          amount,
          displayAmount: paid ? Number(payment?.entry || amount) : amount,
          payment,
          paid,
          selected: !paid && selectedKeys.has(key)
        };
        const matchesSearch = !search || normalize(
          `${member.name || ''} ${member.memberNumber || ''} ${group.name || ''} ${treasury.monthLabel(month)}`
        ).includes(normalize(search));
        const matchesStatus = statusFilter === 'all'
          || (statusFilter === 'paid' ? paid : !paid);
        return { ...item, visible: matchesSearch && matchesStatus };
      });
      const visibleCharges = charges.filter(item => item.visible);
      const paidCharges = charges.filter(item => item.paid);
      const pendingCharges = charges.filter(item => !item.paid);
      return {
        month,
        label: treasury.monthLabel(month),
        amount,
        charges,
        visibleCharges,
        paidCharges,
        pendingCharges,
        expectedTotal: charges.reduce((sum, item) => sum + item.amount, 0),
        receivedTotal: paidCharges.reduce((sum, item) => sum + Number(item.payment?.entry || item.amount), 0),
        beforeGroupStart: Boolean(group.startedMonth && month < group.startedMonth)
      };
    });
    const charges = monthSections.flatMap(section => section.charges);
    const visibleCharges = charges.filter(item => item.visible);
    const paidCharges = charges.filter(item => item.paid);
    const pendingCharges = charges.filter(item => !item.paid);
    return {
      group,
      startedMonthLabel: treasury.monthLabel(group.startedMonth),
      expanded: allGroupsMode ? treasury.isMutualGroupExpanded(group.id) : true,
      monthSections,
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
  const selectedGroup = groupFilter === 'all' ? null : selectedGroups[0] || null;
  const expectedTotal = charges.reduce((sum, item) => sum + item.amount, 0);
  const receivedTotal = paidCharges.reduce((sum, item) => sum + Number(item.payment?.entry || item.amount), 0);

  return {
    groups,
    selectedGroups,
    selectedGroup,
    selectedStart,
    selectedEnd,
    selectedMonth: selectedStart,
    selectedMonthLabel: treasury.monthLabel(selectedStart),
    periodLabel: periodLabel(treasury, selectedStart, selectedEnd),
    months,
    monthlyAmount: selectedGroup ? treasury.mutualAmountForMonth(selectedGroup, selectedStart) : 0,
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
    search,
    statusFilter,
    expanded: treasury.mutualExpanded !== false,
    beforeGroupStart: Boolean(selectedGroup?.startedMonth && selectedEnd < selectedGroup.startedMonth)
  };
}

function renderChargeCard(item, adminUnlocked, avatar) {
  const paymentDate = item.payment?.paymentDate || item.payment?.date || '';
  const statusLabel = item.paid ? 'Paga' : 'Em aberto';
  const paymentDetail = item.paid
    ? `Recebida em ${escapeHtml(formatDate(paymentDate))}`
    : `Competência: ${escapeHtml(item.monthLabel)}`;
  return `<article class="membership-member mutual-charge-card ${item.paid ? 'is-paid' : 'is-pending'} ${item.selected ? 'is-selected' : ''}" data-mutual-key="${escapeHtml(item.key)}" data-mutual-search="${escapeHtml(normalize(`${item.member.name || ''} ${item.member.memberNumber || ''} ${item.group.name || ''} ${item.monthLabel}`))}" data-mutual-status="${item.paid ? 'paid' : 'pending'}" data-mutual-amount="${item.amount}" data-mutual-group-id="${escapeHtml(item.group.id)}" data-mutual-month="${escapeHtml(item.month)}" ${item.visible ? '' : 'hidden'}>
    <label class="membership-member-main mutual-charge-main">
      <span class="mutual-charge-choice">${adminUnlocked && !item.paid ? `<input class="mutual-charge-checkbox" type="checkbox" value="${escapeHtml(item.key)}" ${item.selected ? 'checked' : ''} aria-label="Selecionar mútua de ${escapeHtml(item.member.name)} em ${escapeHtml(item.monthLabel)}"><i aria-hidden="true">✓</i>` : '<i class="is-readonly" aria-hidden="true">✓</i>'}</span>
      <span class="membership-avatar-shell">${avatar(item.member)}<span class="membership-avatar-state" aria-hidden="true"></span></span>
      <span class="membership-member-copy"><span class="membership-member-heading"><strong>${escapeHtml(item.member.name)}</strong><span class="membership-state-pill"><i aria-hidden="true"></i>${statusLabel}</span></span><span class="membership-member-meta"><small>${item.member.memberNumber ? `Nº ${escapeHtml(item.member.memberNumber)}` : 'Sem número informado'}</small><span class="membership-family-chip">🤲 ${escapeHtml(item.group.name)}</span></span></span>
      <span class="membership-progress-panel mutual-charge-summary"><span class="membership-progress-heading"><b class="sensitive-money">${money.format(item.displayAmount)}</b><small>${paymentDetail}</small></span><small class="membership-progress-note">${item.paid ? 'Cobrança mensal quitada' : 'Selecione para registrar o recebimento'}</small></span>
    </label>
  </article>`;
}

function renderMonthSection(section, adminUnlocked, avatar, empty) {
  const content = section.beforeGroupStart
    ? empty('📆', 'O grupo ainda não existia nesta competência.')
    : section.charges.length
      ? section.charges.map(item => renderChargeCard(item, adminUnlocked, avatar)).join('')
      : empty('👥', 'Nenhum participante integrava o grupo nesta competência.');
  return `<section class="mutual-month-section" data-mutual-month-section="${escapeHtml(section.month)}">
    <div class="mutual-month-heading"><div><span aria-hidden="true">🗓️</span><div><strong>${escapeHtml(section.label)}</strong><small>${section.charges.length} cobrança(s) · ${section.pendingCharges.length} em aberto</small></div></div><div><small>Recebido / previsto</small><strong class="sensitive-money">${money.format(section.receivedTotal)} / ${money.format(section.expectedTotal)}</strong></div></div>
    <div class="membership-list mutual-charge-list">${content}</div>
    <div class="membership-filter-empty mutual-month-empty" ${section.visibleCharges.length || !section.charges.length ? 'hidden' : ''}>🔎 Nenhum participante desta competência corresponde aos filtros.</div>
  </section>`;
}

function renderGroupAccordion(section, allGroupsMode, adminUnlocked, avatar, empty) {
  const { group } = section;
  const contentId = `mutual-group-content-${String(group.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return `<article class="mutual-group-accordion ${section.expanded ? 'is-expanded' : 'is-collapsed'}" data-mutual-group-section="${escapeHtml(group.id)}">
    <button class="mutual-group-accordion-toggle" type="button" data-mutual-group-toggle="${escapeHtml(group.id)}" aria-expanded="${section.expanded}" aria-controls="${escapeHtml(contentId)}">
      <span class="mutual-group-accordion-icon" aria-hidden="true">🤲</span>
      <span class="mutual-group-accordion-copy"><small>Grupo de mútua</small><strong>${escapeHtml(group.name)}</strong><span>Cobranças desde ${escapeHtml(section.startedMonthLabel)} · ${section.monthSections.length} competência(s) no período</span></span>
      <span class="mutual-group-accordion-metrics"><span><small>Cobranças</small><strong>${section.charges.length}</strong></span><span><small>Em aberto</small><strong>${section.pendingCharges.length}</strong></span><span><small>Previsto</small><strong class="sensitive-money">${money.format(section.expectedTotal)}</strong></span></span>
      <span class="mutual-group-accordion-chevron" aria-hidden="true"></span>
    </button>
    <div class="mutual-group-accordion-content" id="${escapeHtml(contentId)}" ${section.expanded ? '' : 'hidden'}>
      <div class="mutual-group-period-summary"><span><strong id="mutualGroupVisible-${escapeHtml(group.id)}">${section.visibleCharges.length}</strong> resultado(s) com os filtros atuais</span>${allGroupsMode ? '<small>Expanda somente os grupos que deseja analisar.</small>' : '<small>As competências são apresentadas em ordem cronológica.</small>'}</div>
      ${section.monthSections.map(monthSection => renderMonthSection(monthSection, adminUnlocked, avatar, empty)).join('')}
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
    search,
    statusFilter,
    expanded,
    allGroupsMode,
    months
  } = model;
  const selectedTotal = selectedCharges.reduce((sum, item) => sum + item.amount, 0);

  return `<section class="card membership-control-card mutual-control-card mutual-control-card-v2 ${expanded ? 'is-expanded' : 'is-collapsed'}">
    <button class="membership-control-toggle mutual-control-header" id="mutualControlToggle" type="button" aria-expanded="${expanded}">
      <span class="mutual-control-heading"><span aria-hidden="true">🤲</span><span><strong>Controle mensal de mútuas</strong><small>Consulte grupos e competências, selecione cobranças e registre baixas individuais.</small></span></span><span class="membership-toggle-chevron" aria-hidden="true"></span>
    </button>
    <div class="membership-control-content mutual-control-content" ${expanded ? '' : 'hidden'}>
      <div class="mutual-filter-panel" aria-label="Filtros das mútuas">
        <div class="mutual-filter-panel-heading"><div><span class="section-eyebrow">Filtros de cobrança</span><h3>Localize grupos, competências e participantes</h3><p>Use um único mês ou informe um intervalo para consultar cobranças retroativas.</p></div>${adminUnlocked ? '<button class="btn btn-ghost" id="manageMutualGroups" type="button">⚙ Gerenciar grupos</button>' : ''}</div>
        <div class="membership-toolbar membership-toolbar-v2 mutual-toolbar mutual-toolbar-v2">
          <label><span>Grupo de mútua</span><select id="mutualGroupFilter" ${groups.length ? '' : 'disabled'}><option value="all" ${groupFilter === 'all' ? 'selected' : ''}>Todos os grupos</option>${groups.map(group => `<option value="${escapeHtml(group.id)}" ${groupFilter === group.id ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}</select></label>
          <label><span>Mês/Ano inicial</span><input id="mutualStartFilter" type="month" value="${escapeHtml(selectedStart)}" ${groups.length ? '' : 'disabled'}></label>
          <label><span>Mês/Ano final</span><input id="mutualEndFilter" type="month" value="${escapeHtml(selectedEnd)}" min="${escapeHtml(selectedStart)}" ${groups.length ? '' : 'disabled'}></label>
          <label class="membership-search-filter"><span>Pesquisar participante</span><input id="mutualSearch" type="search" value="${escapeHtml(search)}" placeholder="Nome, número ou grupo" ${groups.length ? '' : 'disabled'}></label>
          <label><span>Situação</span><select id="mutualStatusFilter" ${groups.length ? '' : 'disabled'}><option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>Em aberto</option><option value="paid" ${statusFilter === 'paid' ? 'selected' : ''}>Pagas</option><option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Todas</option></select></label>
        </div>
      </div>
      <div class="mutual-period-banner"><div><span aria-hidden="true">📅</span><div><small>Período de referência</small><strong>${escapeHtml(selectedPeriodLabel)}</strong><p>${months.length} competência(s) selecionada(s) · ${groupFilter === 'all' ? `${groupSections.length} grupo(s)` : escapeHtml(groupSections[0]?.group.name || 'Grupo não encontrado')}</p></div></div><div><small>Resultados filtrados</small><strong id="mutualVisibleCount">${visibleCharges.length}</strong></div></div>
      <div class="membership-kpis mutual-kpis mutual-kpis-v2"><div><small>Grupos exibidos</small><strong>${groupSections.length}</strong></div><div><small>Cobranças</small><strong>${charges.length}</strong></div><div><small>Pagas</small><strong>${paidCharges.length}</strong></div><div><small>Em aberto</small><strong>${pendingCharges.length}</strong></div><div><small>Recebido</small><strong class="sensitive-money">${money.format(receivedTotal)}</strong></div><div><small>Previsto</small><strong class="sensitive-money">${money.format(expectedTotal)}</strong></div></div>
      ${adminUnlocked && groups.length ? `<div class="mutual-selection-bar ${selectedCharges.length ? 'has-selection' : ''}" id="mutualSelectionBar" role="status" aria-live="polite">
        <div><span aria-hidden="true">✓</span><div><small>Selecionadas para baixa</small><strong><b id="mutualSelectedCount">${selectedCharges.length}</b> cobrança(s) · <span class="sensitive-money" id="mutualSelectedTotal">${money.format(selectedTotal)}</span></strong></div></div>
        <div class="mutual-selection-actions"><button class="btn btn-ghost btn-sm" id="mutualSelectVisible" type="button" ${visibleCharges.some(item => !item.paid) ? '' : 'disabled'}>Selecionar pendentes filtradas</button><button class="btn btn-ghost btn-sm" id="mutualClearSelection" type="button" ${selectedCharges.length ? '' : 'disabled'}>Limpar seleção</button><button class="btn btn-primary" id="mutualPaymentButton" type="button" ${selectedCharges.length ? '' : 'disabled'}>Dar baixa selecionadas</button></div>
      </div>` : ''}
      <div class="mutual-groups-list" id="mutualChargeList">${!groups.length
        ? empty('🤲', 'Cadastre um grupo de mútua para iniciar as cobranças mensais.')
        : groupSections.map(section => renderGroupAccordion(section, allGroupsMode, adminUnlocked, avatar, empty)).join('')}</div>
      <div id="mutualFilterEmpty" class="membership-filter-empty mutual-filter-empty-global" ${visibleCharges.length || !charges.length ? 'hidden' : ''}>🔎 Nenhuma cobrança encontrada com os filtros selecionados.</div>
    </div>
  </section>`;
}
