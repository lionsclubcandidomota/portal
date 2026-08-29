import {
  state, els, icon, escapeHtml, avatar, empty, formatDate, greeting, lastUpdateText
} from '../core.js';
import {
  currentMonthBirthdays, birthdayStatus, birthdayDateText, upcomingAppointments,
  publicNotices, historicalNotices, noticeExpired
} from '../model.js';

function noticePreview(value = '', limit = 190) {
  const plain = String(value)
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > limit ? `${plain.slice(0, limit).trimEnd()}…` : plain;
}

export function renderDashboard() {
  const birthdays = currentMonthBirthdays();
  const upcoming = upcomingAppointments(4);
  const notices = publicNotices().slice(0, 3);
  const recentNoticeHistory = historicalNotices().slice(0, 2);
  const settings = state.data.settings;
  const upcomingCount = upcomingAppointments().length;
  const noticeCount = publicNotices().length;
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
  const visibleNotices = notices.length ? notices : recentNoticeHistory;

  els.root.innerHTML = `
    <section class="hero hero-impact hero-impact-clean">
      <div class="hero-watermark" aria-hidden="true"><img src="${escapeHtml(settings.logo || './public/logo.png')}" alt=""></div>
      <div class="hero-content">
        <span class="hero-eyebrow">Portal do clube</span>
        <div class="hero-kicker">${escapeHtml(settings.clubName)}</div>
        <h2>${greeting()}!</h2>
        <div class="hero-meta"><span class="pill">${icon('refresh')} ${escapeHtml(lastUpdateText())}</span></div>
        <div class="hero-actions">
          <button class="hero-action primary" type="button" data-go="agenda">${icon('calendar')} Ver agenda</button>
          <button class="hero-action" type="button" data-go="notices">${icon('megaphone')} Ver avisos</button>
        </div>
      </div>
      <div class="hero-badge hero-badge-impact" aria-hidden="true">
        <div class="hero-logo-wrap"><img src="${escapeHtml(settings.logo || './public/logo.png')}" alt=""></div>
        <div class="hero-seal-copy"><strong>Nós Servimos</strong><small>Distrito LB 1</small></div>
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

    <section class="dashboard-layout" aria-label="Destaques do portal">
      <article class="card dashboard-card dashboard-birthdays-card">
        <div class="card-header">
          <div><h3>${icon('cake')} Aniversários</h3><div class="card-subtitle">Aniversariantes do mês atual</div></div>
          <button class="btn btn-ghost" type="button" data-go="birthdays">Ver todos</button>
        </div>
        <div class="list dashboard-birthday-list">${birthdays.length ? birthdays.slice(0, 5).map(person => {
          const status = birthdayStatus(person);
          return `<div class="list-item dashboard-birthday-item">${avatar(person)}<div class="list-item-main"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(birthdayDateText(person))}</small></div><span class="birthday-status ${status.cls}">${escapeHtml(status.text)}</span></div>`;
        }).join('') : empty('Nenhum aniversariante neste mês.')}</div>
      </article>

      <div class="dashboard-side-stack">
        <article class="card dashboard-card dashboard-agenda-card">
          <div class="card-header">
            <div><h3>${icon('calendar')} Agenda</h3><div class="card-subtitle">Próximos eventos e reuniões</div></div>
            <button class="btn btn-ghost" type="button" data-go="agenda">Ver agenda</button>
          </div>
          <div class="list dashboard-agenda-list">${upcoming.length ? upcoming.map(item => `<button class="list-item dashboard-agenda-item" type="button" data-appt="${escapeHtml(item.type)}:${escapeHtml(item.id)}"><span class="kpi-icon">${icon(item.type === 'meeting' ? 'handshake' : 'calendar')}</span><span class="list-item-main"><strong>${escapeHtml(item.title)}</strong><small>${formatDate(item.date, { day: '2-digit', month: '2-digit' })} · ${escapeHtml(item.time || 'Horário não informado')}</small></span></button>`).join('') : empty('Nenhum compromisso próximo.')}</div>
        </article>

        <article class="card dashboard-card dashboard-notices-card">
          <div class="card-header">
            <div><h3>${icon('megaphone')} Avisos</h3><div class="card-subtitle">${noticeCount ? 'Comunicados em destaque' : 'Últimos comunicados publicados'}</div></div>
            <button class="btn btn-ghost" type="button" data-go="notices">Ver avisos</button>
          </div>
          <div class="dashboard-notice-list">${visibleNotices.length ? visibleNotices.slice(0, 2).map(notice => `<article class="dashboard-notice"><div class="dashboard-notice-title"><span class="notice-icon">${icon('megaphone')}</span><div><h4>${escapeHtml(notice.title)}</h4><small>${formatDate(notice.date)}${noticeExpired(notice) ? ' · histórico' : ''}</small></div></div><p>${escapeHtml(noticePreview(notice.text))}</p></article>`).join('') : empty('Nenhum aviso disponível.')}</div>
        </article>
      </div>
    </section>`;
}
