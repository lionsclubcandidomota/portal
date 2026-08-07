import {
  daysUntil,
  escapeHtml,
  greeting,
  money,
  nextBirthdayDate,
  parseLocalDate,
  sumTreasury
} from '../utils.js';
import { birthdayStatus } from './birthdays.js';
import {
  appointmentListItem,
  compareAppointments,
  getAppointments
} from './appointments.js';
import { markdownToHtml } from './markdown.js';
import { noticeIsActive, noticePeriodText } from './notices.js';
import { todayStart } from './timeline.js';

export function renderDashboard(state, helpers) {
  const {
    root,
    adminUnlocked,
    latestCommitInfo,
    lastSyncInfo,
    memberIsActive,
    kpi,
    avatar,
    empty,
    financePrivacy,
    treasuryAccountSummaries,
    accountTypeIcon,
    treasury,
    setTreasurySection,
    setView
  } = helpers;

  const finance = adminUnlocked ? sumTreasury(state.treasury) : null;
  const currentMembershipMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const activeMembers = adminUnlocked
    ? state.birthdays.filter(memberIsActive)
    : [];
  const membershipEntries = adminUnlocked
    ? state.treasury.filter(item =>
        treasury.isMembershipEntry(item)
        && !treasury.isProgrammed(item)
        && treasury.coveredMonths(item).includes(currentMembershipMonth)
      )
    : [];
  const membershipPaidIds = new Set(
    membershipEntries
      .flatMap(item => treasury.memberIds(item))
      .filter(id => activeMembers.some(member => member.id === id))
  );
  const membershipTotal = membershipEntries.reduce(
    (sum, item) => sum + Number(item.entry || 0),
    0
  );
  const mutualGroups = adminUnlocked ? treasury.mutualGroups() : [];
  const mutualEvents = adminUnlocked ? treasury.mutualEvents() : [];
  const mutualCharges = adminUnlocked
    ? mutualEvents.flatMap(({ group, event }) => treasury.mutualMembersForEvent(group.id, event.id).map(member => {
        const payments = treasury.mutualPaymentsFor(group.id, member.id, event.id);
        const payment = [...payments].sort((first, second) => String(second.paymentDate || second.date || '')
          .localeCompare(String(first.paymentDate || first.date || '')))[0] || null;
        return {
          group,
          event,
          member,
          expected: Number(event.amount || 0),
          payment
        };
      }))
    : [];
  const mutualPaidCharges = mutualCharges.filter(charge => charge.payment);
  const mutualExpectedTotal = mutualCharges.reduce((sum, charge) => sum + charge.expected, 0);
  const mutualReceivedTotal = mutualPaidCharges.reduce(
    (sum, charge) => sum + Number(charge.payment?.entry || charge.expected || 0),
    0
  );
  const mutualActiveGroupCount = mutualGroups.filter(group => treasury.mutualActiveMembers(group.id).length > 0).length;
  const overdueMovements = adminUnlocked
    ? state.treasury.filter(item => treasury.isOverdue(item)).length
    : 0;
  const birthdays = [...state.birthdays]
    .filter(memberIsActive)
    .map(member => ({
      ...member,
      next: nextBirthdayDate(member.birthDate)
    }))
    .sort((first, second) => first.next - second.next)
    .slice(0, adminUnlocked ? 3 : 5);
  const nextAppointments = getAppointments(state)
    .filter(item => parseLocalDate(item.date) >= todayStart() && item.status !== 'Cancelado')
    .sort(compareAppointments)
    .slice(0, adminUnlocked ? 4 : 5);
  const notices = [...state.notices]
    .filter(notice => noticeIsActive(notice))
    .sort((first, second) => parseLocalDate(second.date) - parseLocalDate(first.date))
    .slice(0, adminUnlocked ? 2 : 3);
  const lastUpdateValue = latestCommitInfo?.date
    || state.updatedAt
    || lastSyncInfo?.updatedAt
    || lastSyncInfo?.publishedAt
    || '';
  const lastUpdateText = lastUpdateValue
    ? `Atualizado em ${new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(lastUpdateValue))}, ${new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(lastUpdateValue))}`
    : 'Informações atualizadas';

  root.innerHTML = `
    <section class="hero dashboard-hero ${adminUnlocked ? 'is-admin-compact' : ''}">
      <div class="hero-content">
        <h2>${greeting()}!</h2>
        <p>${adminUnlocked ? 'Veja o que precisa da sua atenção hoje.' : `Acompanhe as novidades do ${escapeHtml(state.settings.clubName)}.`}</p>
        <div class="hero-meta"><span class="pill update-pill"><span aria-hidden="true">↻</span> ${lastUpdateText}</span></div>
      </div>
    </section>
    <section class="grid grid-kpis dashboard-kpis ${adminUnlocked ? 'is-admin-compact' : 'visitor-kpis'}">
      ${adminUnlocked ? kpi('💳', 'Saldo atual', money.format(finance.balance), 'treasury') : ''}
      ${kpi('🗓️', 'Agenda', nextAppointments.length, 'agenda')}
      ${kpi('📢', 'Avisos ativos', state.notices.filter(notice => noticeIsActive(notice)).length, 'notices')}
    </section>
    <section class="grid grid-main dashboard-main-grid ${adminUnlocked ? 'is-admin-compact' : 'is-visitor'}">
      <article class="card ${adminUnlocked ? 'col-3 dashboard-summary-card dashboard-birthdays-card' : 'col-12'}"><div class="card-header"><div><h3>🎂 Aniversários</h3><div class="card-subtitle">Próximas datas</div></div><button class="btn btn-ghost btn-sm" data-go="birthdays" type="button">Ver todos</button></div>
      <div class="list">${birthdays.length ? birthdays.map(member => {
        const status = birthdayStatus(daysUntil(member.next));
        return `<div class="list-item dashboard-birthday-item">${avatar(member)}<div class="list-item-main"><strong>${escapeHtml(member.name)}</strong><small>${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(member.next)}</small></div><span class="birthday-status ${status.className}">${status.icon} ${status.text}</span></div>`;
      }).join('') : empty('🎂', 'Nenhum aniversariante cadastrado.')}</div></article>
      ${adminUnlocked ? `<article class="card col-3 dashboard-summary-card dashboard-treasury-card"><div class="card-header"><div><h3>💰 Finanças</h3><div class="card-subtitle">Resumo do período</div></div><div class="card-header-actions">${financePrivacy.buttonHtml({ compact: true })}<button class="btn btn-ghost btn-sm" data-go="treasury" type="button">Detalhes</button></div></div>
        <div class="dashboard-finance-summary">
          <div class="is-primary"><small>Saldo atual</small><strong class="sensitive-money">${money.format(finance.balance)}</strong></div>
          <div><small>Saldo futuro</small><strong class="sensitive-money">${money.format(finance.projectedBalance)}</strong></div>
          <div class="${overdueMovements ? 'is-warning' : ''}"><small>Vencidas</small><strong>${overdueMovements}</strong></div>
          <div><small>Contas ativas</small><strong>${treasuryAccountSummaries().filter(account => account.active !== false).length}</strong></div>
        </div>
      </article><article class="card col-3 dashboard-summary-card dashboard-membership-card"><div class="card-header"><div><h3>🧾 Mensalidades</h3><div class="card-subtitle">${escapeHtml(treasury.monthLabel(currentMembershipMonth))}</div></div><button class="btn btn-ghost btn-sm" type="button" data-open-memberships>Ver controle</button></div><div class="dashboard-membership-summary"><div><small>Associados ativos</small><strong>${activeMembers.length}</strong></div><div class="is-paid"><small>Em dia</small><strong>${membershipPaidIds.size}</strong></div><div class="is-pending"><small>Pendentes</small><strong>${Math.max(0, activeMembers.length - membershipPaidIds.size)}</strong></div><div class="is-total"><small>Total recebido</small><strong class="sensitive-money">${money.format(membershipTotal)}</strong></div></div><div class="dashboard-membership-progress"><span style="width:${activeMembers.length ? Math.min(100, (membershipPaidIds.size / activeMembers.length) * 100) : 0}%"></span></div></article>
      <article class="card col-3 dashboard-summary-card dashboard-mutual-card"><div class="card-header"><div><h3>🤲 Mútuas</h3><div class="card-subtitle">Cobranças por ocorrência</div></div><button class="btn btn-ghost btn-sm" type="button" data-open-mutuals>Ver controle</button></div><div class="dashboard-membership-summary dashboard-mutual-summary"><div><small>Ocorrências</small><strong>${mutualEvents.length}</strong></div><div class="is-paid"><small>Pagas</small><strong>${mutualPaidCharges.length}</strong></div><div class="is-pending"><small>Pendentes</small><strong>${Math.max(0, mutualCharges.length - mutualPaidCharges.length)}</strong></div><div class="is-total"><small>Total recebido</small><strong class="sensitive-money">${money.format(mutualReceivedTotal)}</strong></div></div><div class="dashboard-membership-progress dashboard-mutual-progress" title="Grupos ativos: ${mutualActiveGroupCount} · Previsto: ${money.format(mutualExpectedTotal)}"><span style="width:${mutualCharges.length ? Math.min(100, (mutualPaidCharges.length / mutualCharges.length) * 100) : 0}%"></span></div></article>` : ''}
      <article class="card ${adminUnlocked ? 'col-6' : 'col-12'} dashboard-agenda-card"><div class="card-header"><div><h3>🗓️ Agenda</h3><div class="card-subtitle">Próximos eventos e reuniões</div></div><button class="btn btn-ghost btn-sm" data-go="agenda" type="button">Ver agenda</button></div><div class="dashboard-appointments-grid">${nextAppointments.length ? nextAppointments.map(appointmentListItem).join('') : empty('🗓️', 'Nenhum compromisso próximo.')}</div></article>
      <article class="card ${adminUnlocked ? 'col-6' : 'col-12'} dashboard-notices-card"><div class="card-header"><div><h3>📢 Avisos</h3><div class="card-subtitle">Comunicados em destaque</div></div><button class="btn btn-ghost btn-sm" data-go="notices" type="button">Ver avisos</button></div><div class="dashboard-notices-grid">${notices.length ? notices.map(notice => `<div class="notice ${notice.priority.toLowerCase()}"><h4>${escapeHtml(notice.title)}</h4><div class="markdown-body markdown-compact">${markdownToHtml(notice.text)}</div><small>${escapeHtml(noticePeriodText(notice))} · Prioridade ${escapeHtml(notice.priority)}</small></div>`).join('') : empty('📢', 'Nenhum aviso cadastrado.')}</div></article>
    </section>`;

  root.querySelectorAll('.treasury-dashboard-summary > .list-item > strong')
    .forEach(element => element.classList.add('sensitive-money'));

  if (adminUnlocked) {
    const firstFinanceKpi = root.querySelector('.grid-kpis .kpi-card:first-child .kpi-value');
    firstFinanceKpi?.classList.add('sensitive-money');
    financePrivacy.bind(root);
  }

  root.querySelectorAll('[data-go]').forEach(element => {
    element.addEventListener('click', () => setView(element.dataset.go));
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setView(element.dataset.go);
      }
    });
  });

  root.querySelector('[data-open-memberships]')?.addEventListener('click', () => {
    setTreasurySection('memberships');
  });

  root.querySelector('[data-open-mutuals]')?.addEventListener('click', () => {
    setTreasurySection('mutuals');
  });
}
