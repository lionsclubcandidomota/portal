import {
  escapeHtml,
  money,
  normalize,
  toInputDate
} from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.7';

export function buildMembershipViewModel(state, treasury, now = new Date()) {
  const currentMembershipMonth = toInputDate(now).slice(0, 7);
  const membershipStart = treasury.membershipStart || treasury.membershipMonth || currentMembershipMonth;
  const membershipEnd = treasury.membershipEnd || membershipStart;
  const membershipMonths = treasury.monthRange(membershipStart, membershipEnd);
  const membershipEntries = state.treasury.filter(item => (
    treasury.isMembershipEntry(item)
    && treasury.coveredMonths(item).some(month => membershipMonths.includes(month))
    && !treasury.isProgrammed(item)
  ));
  const membershipMembers = [...state.birthdays]
    .filter(treasury.memberIsActive)
    .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
  const membershipProgress = new Map(membershipMembers.map(member => {
    const monthDetails = membershipMonths.map(month => {
      const expected = treasury.membershipExpectedAmountForMember(member.id);
      const paid = treasury.membershipPaidAmountForMonth(member.id, month);
      const outstanding = treasury.membershipOutstandingForMonth(member.id, month);
      return { month, expected, paid, outstanding, paidInFull: outstanding <= 0.005, partial: paid > 0.005 && outstanding > 0.005 };
    });
    const paidMonths = monthDetails.filter(item => item.paidInFull).map(item => item.month);
    const partialMonths = monthDetails.filter(item => item.partial).map(item => item.month);
    const pendingMonths = monthDetails.filter(item => !item.paidInFull).map(item => item.month);
    const openingDebt = treasury.membershipOpeningDebtForMember(member.id);
    const openingDebtPaid = treasury.membershipOpeningDebtPaidAmount(member.id);
    const openingDebtOutstanding = treasury.membershipOpeningDebtOutstanding(member.id);
    const openingDebtPartial = treasury.membershipOpeningDebtIsPartial(member.id);
    const monthlyExpectedTotal = monthDetails.reduce((sum, item) => sum + item.expected, 0);
    const monthlyPaidTotal = monthDetails.reduce((sum, item) => sum + Math.min(item.expected, item.paid), 0);
    const monthlyReceivedTotal = monthDetails.reduce((sum, item) => sum + item.paid, 0);
    const monthlyOutstandingTotal = monthDetails.reduce((sum, item) => sum + item.outstanding, 0);
    return [member.id, {
      monthDetails,
      paidMonths,
      partialMonths,
      pendingMonths,
      openingDebt,
      openingDebtPaid,
      openingDebtOutstanding,
      openingDebtPartial,
      expectedTotal: monthlyExpectedTotal + openingDebt,
      paidTotal: monthlyPaidTotal + Math.min(openingDebt, openingDebtPaid),
      receivedTotal: monthlyReceivedTotal + openingDebtPaid,
      monthlyOutstandingTotal,
      outstandingTotal: monthlyOutstandingTotal + openingDebtOutstanding
    }];
  }));
  const membershipPaidIds = new Set(
    membershipMembers
      .filter(member => {
        const progress = membershipProgress.get(member.id);
        return progress?.pendingMonths.length === 0 && Number(progress?.openingDebtOutstanding || 0) <= 0.005;
      })
      .map(member => member.id)
  );
  const membershipPaidUnits = [...membershipProgress.values()]
    .reduce((sum, progress) => sum + progress.paidMonths.length, 0);
  const membershipExpectedUnits = membershipMembers.length * membershipMonths.length;
  const membershipTotal = membershipMembers.reduce((sum, member) => (
    sum + membershipMonths.reduce((monthSum, month) => monthSum + treasury.membershipPaidAmountForMonth(member.id, month), 0)
  ), 0);
  const membershipOpeningDebtOutstandingTotal = membershipMembers.reduce(
    (sum, member) => sum + treasury.membershipOpeningDebtOutstanding(member.id),
    0
  );
  const membershipExpanded = treasury.membershipExpanded !== false;
  const membershipSearch = String(treasury.membershipSearch || '').trim();
  const membershipFamily = String(treasury.membershipFamily || 'all');
  const membershipStatus = String(treasury.membershipStatus || 'all');
  const membershipVisibleMembers = membershipMembers.filter(member => {
    const group = treasury.familyGroupForMember(member.id);
    const matchesSearch = !membershipSearch || normalize(
      `${member.name || ''} ${member.memberNumber || ''} ${group?.name || ''}`
    ).includes(normalize(membershipSearch));
    const matchesFamily = membershipFamily === 'all'
      || (membershipFamily === 'none' ? !group : group?.id === membershipFamily);
    const progress = membershipProgress.get(member.id);
    const paid = membershipPaidIds.has(member.id);
    const partial = Boolean(progress?.partialMonths?.length || progress?.openingDebtPartial);
    const matchesStatus = membershipStatus === 'all'
      || (membershipStatus === 'paid' ? paid : membershipStatus === 'partial' ? partial : !paid);

    return matchesSearch && matchesFamily && matchesStatus;
  });

  return {
    currentMembershipMonth,
    membershipStart,
    membershipEnd,
    membershipMonths,
    membershipMembers,
    membershipProgress,
    membershipPaidIds,
    membershipPaidUnits,
    membershipExpectedUnits,
    membershipTotal,
    membershipOpeningDebtOutstandingTotal,
    membershipExpanded,
    membershipSearch,
    membershipFamily,
    membershipStatus,
    membershipVisibleMembers
  };
}

export function renderMembershipSection({
  model,
  treasury,
  adminUnlocked,
  avatar,
  empty
}) {
  const {
    currentMembershipMonth,
    membershipStart,
    membershipEnd,
    membershipMonths,
    membershipMembers,
    membershipProgress,
    membershipPaidUnits,
    membershipExpectedUnits,
    membershipTotal,
    membershipOpeningDebtOutstandingTotal,
    membershipExpanded,
    membershipSearch,
    membershipFamily,
    membershipStatus,
    membershipVisibleMembers
  } = model;

  return `<section class="card membership-control-card ${membershipExpanded ? 'is-expanded' : 'is-collapsed'}">
    <button class="membership-control-toggle" id="membershipControlToggle" type="button" aria-expanded="${membershipExpanded}">
      <span><strong>${uiIcon('receipt')} Controle de mensalidades</strong><small>Baixas individuais e familiares com controle mensal.</small></span><span class="membership-toggle-chevron" aria-hidden="true"></span>
    </button>
    <div class="membership-control-content" ${membershipExpanded ? '' : 'hidden'}>
      <div class="membership-toolbar membership-toolbar-v2 membership-period-toolbar">
        <div class="membership-period-filter"><span>Período de referência</span><div class="membership-period-fields"><label><small>De</small><input id="membershipStart" type="month" value="${membershipStart}" aria-label="Mês inicial"></label><span>até</span><label><small>Até</small><input id="membershipEnd" type="month" value="${membershipEnd}" aria-label="Mês final"></label></div></div>
        <label class="membership-search-filter"><span>Pesquisar</span><input id="membershipSearch" type="search" value="${escapeHtml(membershipSearch)}" placeholder="Nome, número ou família"></label>
        <label><span>Família</span><select id="membershipFamilyFilter"><option value="all">Todas as famílias</option><option value="none" ${membershipFamily === 'none' ? 'selected' : ''}>Sem grupo familiar</option>${treasury.familyGroups().map(group => `<option value="${escapeHtml(group.id)}" ${membershipFamily === group.id ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}</select></label>
        <label><span>Situação</span><select id="membershipStatusFilter"><option value="all" ${membershipStatus === 'all' ? 'selected' : ''}>Todos</option><option value="pending" ${membershipStatus === 'pending' ? 'selected' : ''}>Pendentes</option><option value="partial" ${membershipStatus === 'partial' ? 'selected' : ''}>Parciais</option><option value="paid" ${membershipStatus === 'paid' ? 'selected' : ''}>Pagos</option></select></label>
        ${adminUnlocked ? '<div class="membership-toolbar-actions"><button class="btn btn-ghost btn-sm" id="manageFamilyGroups" type="button">Gerenciar famílias</button></div>' : ''}
      </div>
      <div class="membership-period-summary"><span>${uiIcon('calendar')}</span><div><small>Período selecionado</small><strong>${membershipMonths.length === 1 ? treasury.monthLabel(membershipMonths[0]) : `${treasury.monthLabel(membershipMonths[0])} até ${treasury.monthLabel(membershipMonths.at(-1))}`}</strong></div></div>
      <div class="membership-kpis"><div><small>Meses</small><strong>${membershipMonths.length}</strong></div><div><small>Associados</small><strong>${membershipMembers.length}</strong></div><div><small>Mensalidades quitadas</small><strong>${membershipPaidUnits}</strong></div><div><small>Pendentes</small><strong>${Math.max(0, membershipExpectedUnits - membershipPaidUnits)}</strong></div><div><small>Total recebido</small><strong class="sensitive-money">${money.format(membershipTotal)}</strong></div><div><small>Saldo anterior em aberto</small><strong class="sensitive-money">${money.format(membershipOpeningDebtOutstandingTotal)}</strong></div></div>
      <div class="membership-results-summary"><strong id="membershipVisibleCount">${membershipVisibleMembers.length}</strong> associado(s) exibido(s)</div>
      <div class="membership-list" id="membershipMemberList">${membershipMembers.length ? membershipMembers.map(member => {
        const progress = membershipProgress.get(member.id) || { paidMonths: [], partialMonths: [], pendingMonths: membershipMonths, expectedTotal: 0, paidTotal: 0, receivedTotal: 0, monthlyOutstandingTotal: 0, outstandingTotal: 0, openingDebt: 0, openingDebtPaid: 0, openingDebtOutstanding: 0, openingDebtPartial: false };
        const paid = progress.pendingMonths.length === 0 && progress.openingDebtOutstanding <= 0.005;
        const partial = !paid && (progress.partialMonths.length > 0 || progress.openingDebtPartial);
        const group = treasury.familyGroupForMember(member.id);
        const visible = membershipVisibleMembers.some(item => item.id === member.id);
        const referenceMonth = progress.pendingMonths[0] || membershipMonths.at(-1) || currentMembershipMonth;
        const membershipActionLabel = paid
          ? `Consultar mensalidade de ${member.name}`
          : `Abrir baixa da mensalidade de ${member.name}`;
        const paidPercent = progress.expectedTotal > 0
          ? Math.min(100, Math.round((progress.paidTotal / progress.expectedTotal) * 100))
          : 0;
        const pendingCount = progress.pendingMonths.length;
        const stateLabel = paid ? 'Em dia' : partial ? 'Parcial' : 'Pendente';
        const progressLabel = `${progress.paidMonths.length}/${membershipMonths.length} ${membershipMonths.length === 1 ? 'mês quitado' : 'meses quitados'}`;
        const openingDebtText = progress.openingDebtOutstanding > 0.005
          ? ` · saldo anterior <span class="sensitive-money membership-outstanding-value">${money.format(progress.openingDebtOutstanding)}</span>`
          : '';
        const monthlyOutstandingText = progress.monthlyOutstandingTotal > 0.005
          ? `<span class="sensitive-money membership-outstanding-value">${money.format(progress.monthlyOutstandingTotal)}</span>`
          : '';
        const progressDetail = paid
          ? `<span class="sensitive-money membership-paid-value">${money.format(progress.receivedTotal)}</span>`
          : partial
            ? `${progress.partialMonths.length} parcial(is)${monthlyOutstandingText ? ` · ${monthlyOutstandingText} em aberto` : ''}${openingDebtText}`
            : `${pendingCount} em aberto${monthlyOutstandingText ? ` · ${monthlyOutstandingText}` : ''}${openingDebtText}`;
        const progressNote = paid
          ? 'Período e saldo anterior totalmente quitados'
          : progress.openingDebtOutstanding > 0.005 && !pendingCount
            ? 'Há saldo anterior em aberto; clique para registrar recebimento'
            : partial
              ? 'Há pagamento parcial; clique para complementar ou ratear outro valor'
              : 'Clique no card para registrar a baixa';
        return `<article class="membership-member ${paid ? 'is-paid' : 'is-pending'} ${partial ? 'is-partial' : ''}" data-membership-search="${escapeHtml(normalize(`${member.name || ''} ${member.memberNumber || ''} ${group?.name || ''}`))}" data-membership-family="${escapeHtml(group?.id || 'none')}" data-membership-status="${paid ? 'paid' : partial ? 'partial' : 'pending'}" ${visible ? '' : 'hidden'} style="${visible ? '' : 'display:none'}">
          <button type="button" class="membership-member-main ${adminUnlocked ? '' : 'is-readonly'}" ${adminUnlocked ? '' : 'disabled'} data-membership-member="${escapeHtml(member.id)}" data-membership-reference="${escapeHtml(referenceMonth)}" aria-label="${escapeHtml(membershipActionLabel)}">
            <span class="membership-avatar-shell">${avatar(member)}<span class="membership-avatar-state" aria-hidden="true"></span></span>
            <span class="membership-member-copy">
              <span class="membership-member-heading"><strong>${escapeHtml(member.name)}</strong><span class="membership-state-pill"><i aria-hidden="true"></i>${stateLabel}</span></span>
              <span class="membership-member-meta"><small>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número informado'}</small>${group ? `<span class="membership-family-chip">${uiIcon('family')} ${escapeHtml(group.name)}</span>` : ''}</span>
            </span>
            <span class="membership-progress-panel">
              <span class="membership-progress-heading"><b>${progressLabel}</b><small>${progressDetail}</small></span>
              <span class="membership-progress-bar" aria-hidden="true"><i style="width:${paidPercent}%"></i></span>
              <small class="membership-progress-note">${progressNote}</small>
            </span>
          </button>
          ${adminUnlocked ? `<div class="membership-member-actions"><div class="membership-actions-menu"><button type="button" class="membership-more-toggle" data-membership-menu-toggle aria-expanded="false" aria-haspopup="menu" aria-label="Mais ações para ${escapeHtml(member.name)}">•••</button><div class="membership-more-menu" data-membership-menu role="menu" hidden>${!paid ? `<button type="button" class="membership-menu-item" role="menuitem" data-membership-charge="${escapeHtml(member.id)}" data-membership-months="${escapeHtml(progress.pendingMonths.join(','))}"><span aria-hidden="true">${uiIcon('message')}</span><span><strong>Enviar cobrança</strong><small>Escolher associado ou família; inclui mensalidades e saldo anterior</small></span></button>` : ''}<button type="button" class="membership-menu-item" role="menuitem" data-membership-opening-debt="${escapeHtml(member.id)}"><span aria-hidden="true">${uiIcon('history')}</span><span><strong>Saldo anterior</strong><small>${progress.openingDebt > 0.005 ? 'Débito anterior configurado' : 'Informar débito anterior ao início do controle'}</small></span></button></div></div></div>` : ''}
        </article>`;
      }).join('') : empty('search', 'Nenhum associado cadastrado.')}</div>
      <div id="membershipFilterEmpty" class="membership-filter-empty" ${membershipVisibleMembers.length ? 'hidden' : ''}>${uiIcon('search')}<span>Nenhum associado encontrado com os filtros selecionados.</span></div>
    </div>
  </section>`;
}
