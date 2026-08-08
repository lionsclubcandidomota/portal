import {
  daysUntil,
  escapeHtml,
  greeting,
  money,
  nextBirthdayDate,
  parseLocalDate
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
import { memberIsActive } from '../core/portal-members.js?v=6.44.1';
import { buildTreasuryDashboardSummary } from './treasury/dashboard-summary.js?v=6.44.1';
import { uiIcon } from './visual-helpers.js';
import { resolveDisplayLogo } from './settings-appearance.js?v=6.44.1';

export function renderDashboard(state, helpers) {
  const {
    root,
    adminUnlocked,
    latestCommitInfo,
    lastSyncInfo,
    kpi,
    avatar,
    empty,
    financePrivacy,
    setTreasurySection,
    setView
  } = helpers;

  const treasurySummary = adminUnlocked ? buildTreasuryDashboardSummary(state) : null;
  const finance = treasurySummary?.finance || null;
  const activeMemberCount = treasurySummary?.activeMembersCount || 0;
  const membershipPaidCount = treasurySummary?.membershipPaidCount || 0;
  const membershipTotal = treasurySummary?.membershipTotal || 0;
  const mutualEventCount = treasurySummary?.mutualEventCount || 0;
  const mutualPaidCount = treasurySummary?.mutualPaidCount || 0;
  const mutualChargeCount = treasurySummary?.mutualChargeCount || 0;
  const mutualExpectedTotal = treasurySummary?.mutualExpectedTotal || 0;
  const mutualReceivedTotal = treasurySummary?.mutualReceivedTotal || 0;
  const mutualActiveGroupCount = treasurySummary?.mutualActiveGroupCount || 0;
  const overdueMovements = treasurySummary?.overdueMovementCount || 0;
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
  const heroLogo = resolveDisplayLogo(state.settings?.logo);
  const heroClubName = String(state.settings?.clubName || 'Lions Clube').trim() || 'Lions Clube';
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
        <span class="dashboard-hero-eyebrow">Portal do clube</span>
        <h2>${greeting()}!</h2>
        <p>${adminUnlocked ? 'Veja o que precisa da sua atenção hoje.' : `Acompanhe as novidades do ${escapeHtml(heroClubName)}.`}</p>
        <div class="hero-meta"><span class="pill update-pill">${uiIcon('refresh')} ${lastUpdateText}</span></div>
      </div>
      <div class="dashboard-hero-visual">
        <div class="dashboard-hero-logo-wrap">
          <img class="dashboard-hero-logo" src="${escapeHtml(heroLogo)}" alt="Logo do ${escapeHtml(heroClubName)}" width="150" height="150" decoding="async">
        </div>
      </div>
    </section>
    <section class="grid grid-kpis dashboard-kpis ${adminUnlocked ? 'is-admin-compact' : 'visitor-kpis'}">
      ${adminUnlocked ? kpi(uiIcon('wallet'), 'Saldo atual', money.format(finance.balance), 'treasury') : ''}
      ${kpi(uiIcon('calendar'), 'Agenda', nextAppointments.length, 'agenda')}
      ${kpi(uiIcon('megaphone'), 'Avisos ativos', state.notices.filter(notice => noticeIsActive(notice)).length, 'notices')}
    </section>
    <section class="grid grid-main dashboard-main-grid ${adminUnlocked ? 'is-admin-compact' : 'is-visitor'}">
      <article class="card ${adminUnlocked ? 'col-3 dashboard-summary-card dashboard-birthdays-card' : 'col-12'}"><div class="card-header"><div><h3>${uiIcon('cake', 'dashboard-title-icon')}<span>Aniversários</span></h3><div class="card-subtitle">Próximas datas</div></div><button class="btn btn-ghost btn-sm" data-go="birthdays" type="button">Ver todos</button></div>
      <div class="list">${birthdays.length ? birthdays.map(member => {
        const status = birthdayStatus(daysUntil(member.next));
        return `<div class="list-item dashboard-birthday-item">${avatar(member)}<div class="list-item-main"><strong>${escapeHtml(member.name)}</strong><small>${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(member.next)}</small></div><span class="birthday-status ${status.className}">${status.icon} ${status.text}</span></div>`;
      }).join('') : empty('🎂', 'Nenhum aniversariante cadastrado.')}</div></article>
      ${adminUnlocked ? `<article class="card col-3 dashboard-summary-card dashboard-treasury-card"><div class="card-header"><div><h3>${uiIcon('wallet', 'dashboard-title-icon')}<span>Finanças</span></h3><div class="card-subtitle">Resumo do período</div></div><div class="card-header-actions">${financePrivacy.buttonHtml({ compact: true })}<button class="btn btn-ghost btn-sm" data-go="treasury" type="button">Detalhes</button></div></div>
        <div class="dashboard-finance-summary">
          <div class="is-primary"><small>Saldo atual</small><strong class="sensitive-money">${money.format(finance.balance)}</strong></div>
          <div><small>Saldo futuro</small><strong class="sensitive-money">${money.format(finance.projectedBalance)}</strong></div>
          <div class="${overdueMovements ? 'is-warning' : ''}"><small>Vencidas</small><strong>${overdueMovements}</strong></div>
          <div><small>Contas ativas</small><strong>${treasurySummary.activeAccountCount}</strong></div>
        </div>
      </article><article class="card col-3 dashboard-summary-card dashboard-membership-card"><div class="card-header"><div><h3>${uiIcon('receipt', 'dashboard-title-icon')}<span>Mensalidades</span></h3><div class="card-subtitle">${escapeHtml(treasurySummary.currentMembershipLabel)}</div></div><button class="btn btn-ghost btn-sm" type="button" data-open-memberships>Ver controle</button></div><div class="dashboard-membership-summary"><div><small>Associados ativos</small><strong>${activeMemberCount}</strong></div><div class="is-paid"><small>Em dia</small><strong>${membershipPaidCount}</strong></div><div class="is-pending"><small>Pendentes</small><strong>${Math.max(0, activeMemberCount - membershipPaidCount)}</strong></div><div class="is-total"><small>Total recebido</small><strong class="sensitive-money">${money.format(membershipTotal)}</strong></div></div><div class="dashboard-membership-progress"><span style="width:${activeMemberCount ? Math.min(100, (membershipPaidCount / activeMemberCount) * 100) : 0}%"></span></div></article>
      <article class="card col-3 dashboard-summary-card dashboard-mutual-card"><div class="card-header"><div><h3>${uiIcon('heart', 'dashboard-title-icon')}<span>Mútuas</span></h3><div class="card-subtitle">Cobranças por ocorrência</div></div><button class="btn btn-ghost btn-sm" type="button" data-open-mutuals>Ver controle</button></div><div class="dashboard-membership-summary dashboard-mutual-summary"><div><small>Ocorrências</small><strong>${mutualEventCount}</strong></div><div class="is-paid"><small>Pagas</small><strong>${mutualPaidCount}</strong></div><div class="is-pending"><small>Pendentes</small><strong>${Math.max(0, mutualChargeCount - mutualPaidCount)}</strong></div><div class="is-total"><small>Total recebido</small><strong class="sensitive-money">${money.format(mutualReceivedTotal)}</strong></div></div><div class="dashboard-membership-progress dashboard-mutual-progress" title="Grupos ativos: ${mutualActiveGroupCount} · Previsto: ${money.format(mutualExpectedTotal)}"><span style="width:${mutualChargeCount ? Math.min(100, (mutualPaidCount / mutualChargeCount) * 100) : 0}%"></span></div></article>` : ''}
      <article class="card ${adminUnlocked ? 'col-6' : 'col-12'} dashboard-agenda-card"><div class="card-header"><div><h3>${uiIcon('calendar', 'dashboard-title-icon')}<span>Agenda</span></h3><div class="card-subtitle">Próximos eventos e reuniões</div></div><button class="btn btn-ghost btn-sm" data-go="agenda" type="button">Ver agenda</button></div><div class="dashboard-appointments-grid">${nextAppointments.length ? nextAppointments.map(appointmentListItem).join('') : empty('🗓️', 'Nenhum compromisso próximo.')}</div></article>
      <article class="card ${adminUnlocked ? 'col-6' : 'col-12'} dashboard-notices-card"><div class="card-header"><div><h3>${uiIcon('megaphone', 'dashboard-title-icon')}<span>Avisos</span></h3><div class="card-subtitle">Comunicados em destaque</div></div><button class="btn btn-ghost btn-sm" data-go="notices" type="button">Ver avisos</button></div><div class="dashboard-notices-grid">${notices.length ? notices.map(notice => `<div class="notice ${notice.priority.toLowerCase()}"><h4>${escapeHtml(notice.title)}</h4><div class="markdown-body markdown-compact">${markdownToHtml(notice.text)}</div><small>${escapeHtml(noticePeriodText(notice))} · Prioridade ${escapeHtml(notice.priority)}</small></div>`).join('') : empty('📢', 'Nenhum aviso cadastrado.')}</div></article>
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
