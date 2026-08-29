import {
  state, els, icon, escapeHtml, avatar, empty, formatDate, simpleMarkdown, greeting, lastUpdateText
} from '../core.js';
import {
  currentMonthBirthdays, birthdayStatus, birthdayDateText, upcomingAppointments,
  publicNotices, historicalNotices, noticeExpired
} from '../model.js';

export function renderDashboard() {
  const birthdays = currentMonthBirthdays();
  const upcoming = upcomingAppointments(5);
  const notices = publicNotices().slice(0, 3);
  const recentNoticeHistory = historicalNotices().slice(0, 2);
  const settings = state.data.settings;
  const upcomingCount = upcomingAppointments().length;
  const noticeCount = publicNotices().length;
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
  const visibleNotices = notices.length ? notices : recentNoticeHistory;

  els.root.innerHTML = `
    <section class="hero hero-minimal">
      <div class="hero-brand-mark" aria-hidden="true"><img src="${escapeHtml(settings.logo || './public/logo.png')}" alt=""></div>
      <div class="hero-content">
        <span class="hero-eyebrow">Portal do clube</span>
        <div class="hero-kicker">${escapeHtml(settings.clubName)}</div>
        <h2>${greeting()}!</h2>
        <p>Acompanhe a agenda, os aniversários e os comunicados do clube de forma simples, moderna e acolhedora.</p>
        <div class="hero-meta"><span class="pill">${icon('refresh')} ${escapeHtml(lastUpdateText())}</span></div>
        <div class="hero-chip-row" aria-label="Destaques do portal">
          <span class="hero-chip">${icon('calendar')} Agenda</span>
          <span class="hero-chip">${icon('cake')} Aniversários</span>
          <span class="hero-chip">${icon('megaphone')} Avisos</span>
        </div>
        <div class="hero-actions">
          <button class="hero-action primary" type="button" data-go="agenda">${icon('calendar')} Ver agenda</button>
          <button class="hero-action" type="button" data-go="notices">${icon('megaphone')} Ver avisos</button>
        </div>
      </div>
      <div class="hero-badge" aria-hidden="true">
        <div class="hero-logo-wrap"><img src="${escapeHtml(settings.logo || './public/logo.png')}" alt=""></div>
        <div class="hero-seal-copy"><strong>We Serve</strong><small>Distrito LB 1</small></div>
      </div>
    </section>

    <section class="grid grid-kpis" aria-label="Resumo do portal">
      <button class="kpi-card" type="button" data-go="agenda" aria-label="Abrir agenda: ${upcomingCount} compromissos publicados">
        <span class="kpi-icon">${icon('calendar')}</span>
        <span class="kpi-copy"><small>Agenda</small><strong>${upcomingCount}</strong><span class="kpi-caption">compromissos publicados</span></span>
      </button>
      <button class="kpi-card" type="button" data-go="birthdays" aria-label="Abrir aniversários: ${birthdays.length} aniversariantes em ${month}">
        <span class="kpi-icon">${icon('cake')}</span>
        <span class="kpi-copy"><small>Aniversários</small><strong>${birthdays.length}</strong><span class="kpi-caption">em ${escapeHtml(month)}</span></span>
      </button>
      <button class="kpi-card" type="button" data-go="notices" aria-label="Abrir avisos: ${noticeCount} avisos ativos">
        <span class="kpi-icon">${icon('megaphone')}</span>
        <span class="kpi-copy"><small>Avisos</small><strong>${noticeCount}</strong><span class="kpi-caption">ativos no momento</span></span>
      </button>
    </section>

    <section class="dashboard-grid" aria-label="Destaques do portal">
      <article class="card full dashboard-card dashboard-birthdays-card">
        <div class="card-header">
          <div><h3>${icon('cake')} Aniversários</h3><div class="card-subtitle">Aniversariantes do mês atual</div></div>
          <button class="btn btn-ghost" type="button" data-go="birthdays">Ver todos</button>
        </div>
        <div class="list dashboard-birthday-list">${birthdays.length ? birthdays.slice(0, 6).map(person => {
          const status = birthdayStatus(person);
          return `<div class="list-item dashboard-birthday-item">${avatar(person)}<div class="list-item-main"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(birthdayDateText(person))}</small></div><span class="birthday-status ${status.cls}">${escapeHtml(status.text)}</span></div>`;
        }).join('') : empty('Nenhum aniversariante neste mês.')}</div>
      </article>

      <article class="card dashboard-card">
        <div class="card-header">
          <div><h3>${icon('calendar')} Agenda</h3><div class="card-subtitle">Próximos eventos e reuniões</div></div>
          <button class="btn btn-ghost" type="button" data-go="agenda">Ver agenda</button>
        </div>
        <div class="list">${upcoming.length ? upcoming.map(item => `<button class="list-item" type="button" data-appt="${escapeHtml(item.type)}:${escapeHtml(item.id)}"><span class="kpi-icon">${icon(item.type === 'meeting' ? 'handshake' : 'calendar')}</span><span class="list-item-main"><strong>${escapeHtml(item.title)}</strong><small>${formatDate(item.date, { day: '2-digit', month: '2-digit' })} · ${escapeHtml(item.time || 'Horário não informado')}</small></span></button>`).join('') : empty('Nenhum compromisso próximo.')}</div>
      </article>

      <article class="card dashboard-card">
        <div class="card-header">
          <div><h3>${icon('megaphone')} Avisos</h3><div class="card-subtitle">${noticeCount ? 'Comunicados em destaque' : 'Últimos comunicados publicados'}</div></div>
          <button class="btn btn-ghost" type="button" data-go="notices">Ver avisos</button>
        </div>
        <div class="list">${visibleNotices.length ? visibleNotices.map(notice => `<div class="notice"><h4>${escapeHtml(notice.title)}</h4><div class="markdown">${simpleMarkdown(notice.text)}</div><small>${formatDate(notice.date)}${notice.endDate ? ` até ${formatDate(notice.endDate)}` : ''}${noticeExpired(notice) ? ' · histórico' : ''}</small></div>`).join('') : empty('Nenhum aviso disponível.')}</div>
      </article>
    </section>`;
}
