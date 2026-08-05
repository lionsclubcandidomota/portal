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
  const mutualCharges = adminUnlocked
    ? mutualGroups.flatMap(group => (Array.isArray(group.events) ? group.events : []).flatMap(event => (
        treasury.mutualMembersForEvent(group.id, event.id).map(member => {
          const payments = treasury.mutualPaymentsFor(group.id, event.id, member.id);
          const payment = [...payments].sort((first, second) => String(second.paymentDate || second.date || '')
            .localeCompare(String(first.paymentDate || first.date || '')))[0] || null;
          return {
            group,
            event,
            member,
            expected: Number(event.amountPerParticipant || 0),
            payment
          };
        })
      )))
    : [];
  const mutualPaidCharges = mutualCharges.filter(charge => charge.payment);
  const mutualExpectedTotal = mutualCharges.reduce((sum, charge) => sum + charge.expected, 0);
  const mutualReceivedTotal = mutualPaidCharges.reduce(
    (sum, charge) => sum + Number(charge.payment?.entry || charge.expected || 0),
    0
  );
  const mutualActiveGroupCount = mutualGroups.filter(group => !group.closedDate).length;
  const mutualEventCount = mutualGroups.reduce(
    (sum, group) => sum + (Array.isArray(group.events) ? group.events.filter(event => !event.cancelledAt).length : 0),
    0
  );
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
  const activeNotices = [...state.notices]
    .filter(notice => noticeIsActive(notice))
    .sort((first, second) => parseLocalDate(second.date) - parseLocalDate(first.date));
  const notices = activeNotices.slice(0, adminUnlocked ? 2 : 3);
  const lastUpdateValue = latestCommitInfo?.date
    || state.updatedAt
    || lastSyncInfo?.updatedAt
    || lastSyncInfo?.publishedAt
    || '';
  const lastUpdateText = lastUpdateValue
    ? `Últimas atualizações recebidas no dia ${new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(lastUpdateValue))} às ${new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(lastUpdateValue))} horas`
    : 'Informações do portal carregadas';

  root.innerHTML = `
    <section class="hero dashboard-hero ${adminUnlocked ? 'is-admin-compact' : ''}">
      <div class="hero-content">
        <h2>${greeting()}, seja bem-vindo(a)!</h2>
        <p>Informações atualizadas do ${escapeHtml(state.settings.clubName)}.</p>
        <div class="hero-meta"><span class="pill update-pill"><span aria-hidden="true">↻</span> ${lastUpdateText}</span></div>
      </div>
    </section>
    <section class="grid grid-kpis dashboard-kpis ${adminUnlocked ? 'is-admin-compact' : 'visitor-kpis'}">
      ${adminUnlocked ? kpi('💳', 'Saldo atual', money.format(finance.balance), 'treasury') : ''}
      ${kpi('🗓️', 'Próximos compromissos', nextAppointments.length, 'agenda')}
      ${kpi('📢', 'Avisos ativos', activeNotices.length, 'notices')}
    </section>
    <section class="grid grid-main dashboard-main-grid ${adminUnlocked ? 'is-admin-compact is-authenticated' : 'is-visitor'}">
      <article class="card ${adminUnlocked ? 'col-3 dashboard-summary-card dashboard-birthdays-card' : 'col-12'}">
        <div class="card-header">
          <div><h3>🎂 Próximos aniversariantes</h3><div class="card-subtitle">Datas mais próximas</div></div>
          <button class="btn btn-ghost btn-sm" data-go="birthdays" type="button">Ver todos</button>
        </div>
        <div class="list dashboard-birthday-list">${birthdays.length ? birthdays.map(member => {
          const status = birthdayStatus(daysUntil(member.next));
          return `<div class="list-item dashboard-birthday-item">${avatar(member)}<div class="list-item-main"><strong>${escapeHtml(member.name)}</strong><small>${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(member.next)}</small></div><span class="birthday-status ${status.className}">${status.icon} ${status.text}</span></div>`;
        }).join('') : empty('🎂', 'Nenhum aniversariante cadastrado.')}</div>
        ${adminUnlocked ? `<div class="dashboard-summary-foot"><span>${birthdays.length}</span> cadastro(s) em destaque</div>` : ''}
      </article>
      ${adminUnlocked ? `<article class="card col-3 dashboard-summary-card dashboard-treasury-card">
        <div class="card-header">
          <div><h3>💰 Tesouraria</h3><div class="card-subtitle">Resumo financeiro</div></div>
          <div class="card-header-actions">${financePrivacy.buttonHtml({ compact: true })}<button class="btn btn-ghost btn-sm" data-go="treasury" type="button">Detalhes</button></div>
        </div>
        <div class="dashboard-finance-summary">
          <div class="is-primary"><small>Saldo atual</small><strong class="sensitive-money">${money.format(finance.balance)}</strong></div>
          <div><small>Saldo futuro</small><strong class="sensitive-money">${money.format(finance.projectedBalance)}</strong></div>
          <div class="${overdueMovements ? 'is-warning' : ''}"><small>Vencidas</small><strong>${overdueMovements}</strong></div>
          <div><small>Contas ativas</small><strong>${treasuryAccountSummaries().filter(account => account.active !== false).length}</strong></div>
        </div>
        <div class="dashboard-summary-foot ${overdueMovements ? 'is-warning' : 'is-success'}"><span>${overdueMovements ? '!' : '✓'}</span>${overdueMovements ? `${overdueMovements} movimentação(ões) vencida(s)` : 'Nenhuma movimentação vencida'}</div>
      </article>
      <article class="card col-3 dashboard-summary-card dashboard-membership-card">
        <div class="card-header">
          <div><h3>🧾 Mensalidades</h3><div class="card-subtitle">${escapeHtml(treasury.monthLabel(currentMembershipMonth))}</div></div>
          <button class="btn btn-ghost btn-sm" type="button" data-open-memberships>Ver controle</button>
        </div>
        <div class="dashboard-membership-summary">
          <div><small>Associados ativos</small><strong>${activeMembers.length}</strong></div>
          <div class="is-paid"><small>Em dia</small><strong>${membershipPaidIds.size}</strong></div>
          <div class="is-pending"><small>Pendentes</small><strong>${Math.max(0, activeMembers.length - membershipPaidIds.size)}</strong></div>
          <div class="is-total"><small>Total recebido</small><strong class="sensitive-money">${money.format(membershipTotal)}</strong></div>
        </div>
        <div class="dashboard-membership-progress" role="progressbar" aria-label="Mensalidades em dia" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${activeMembers.length ? Math.round((membershipPaidIds.size / activeMembers.length) * 100) : 0}"><span style="width:${activeMembers.length ? Math.min(100, (membershipPaidIds.size / activeMembers.length) * 100) : 0}%"></span></div>
        <div class="dashboard-summary-foot"><span>${membershipPaidIds.size}/${activeMembers.length}</span> associados em dia</div>
      </article>
      <article class="card col-3 dashboard-summary-card dashboard-mutual-card">
        <div class="card-header">
          <div><h3>🤲 Mútuas</h3><div class="card-subtitle">Cobranças por falecimento</div></div>
          <button class="btn btn-ghost btn-sm" type="button" data-open-mutuals>Ver controle</button>
        </div>
        <div class="dashboard-membership-summary dashboard-mutual-summary">
          <div><small>Grupos ativos</small><strong>${mutualActiveGroupCount}</strong></div>
          <div><small>Eventos</small><strong>${mutualEventCount}</strong></div>
          <div class="is-pending"><small>Pendentes</small><strong>${Math.max(0, mutualCharges.length - mutualPaidCharges.length)}</strong></div>
          <div class="is-total"><small>Total recebido</small><strong class="sensitive-money">${money.format(mutualReceivedTotal)}</strong></div>
        </div>
        <div class="dashboard-membership-progress dashboard-mutual-progress" role="progressbar" aria-label="Mútuas pagas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${mutualCharges.length ? Math.round((mutualPaidCharges.length / mutualCharges.length) * 100) : 0}" title="Previsto: ${money.format(mutualExpectedTotal)}"><span style="width:${mutualCharges.length ? Math.min(100, (mutualPaidCharges.length / mutualCharges.length) * 100) : 0}%"></span></div>
        <div class="dashboard-summary-foot"><span>${mutualPaidCharges.length}/${mutualCharges.length}</span> cobranças de eventos pagas</div>
      </article>` : ''}
      <article class="card ${adminUnlocked ? 'col-7' : 'col-12'} dashboard-feed-card dashboard-agenda-card">
        <div class="card-header">
          <div><h3>🗓️ Próximos compromissos</h3><div class="card-subtitle">${nextAppointments.length} compromisso(s) futuro(s)</div></div>
          <button class="btn btn-ghost btn-sm" data-go="agenda" type="button">Abrir agenda</button>
        </div>
        <div class="dashboard-appointments-grid">${nextAppointments.length ? nextAppointments.map(appointmentListItem).join('') : empty('🗓️', 'Nenhum compromisso próximo.')}</div>
      </article>
      <article class="card ${adminUnlocked ? 'col-5' : 'col-12'} dashboard-feed-card dashboard-notices-card">
        <div class="card-header">
          <div><h3>📢 Avisos importantes</h3><div class="card-subtitle">${activeNotices.length} comunicado(s) ativo(s)</div></div>
          <button class="btn btn-ghost btn-sm" data-go="notices" type="button">Ver avisos</button>
        </div>
        <div class="dashboard-notices-grid">${notices.length ? notices.map(notice => `<article class="notice ${notice.priority.toLowerCase()} dashboard-notice-item"><h4>${escapeHtml(notice.title)}</h4><div class="markdown-body markdown-compact dashboard-notice-copy">${markdownToHtml(notice.text)}</div><small>${escapeHtml(noticePeriodText(notice))} · Prioridade ${escapeHtml(notice.priority)}</small></article>`).join('') : empty('📢', 'Nenhum aviso cadastrado.')}</div>
      </article>
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
