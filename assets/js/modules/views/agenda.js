import {
  state, els, icon, normalize, escapeHtml, formatDate, parseLocalDate, dateKey,
  todayStart, safeUrl, simpleMarkdown, empty, openModal, lastUpdateText
} from '../core.js';
import { appointments } from '../model.js';

function appointmentLocation(item) {
  const online = safeUrl(item.onlineUrl);
  const location = String(item.location || '').trim();
  if (online && normalize(item.locationType) === 'online') return `<a href="${escapeHtml(online)}" target="_blank" rel="noopener noreferrer">Acessar encontro on-line</a>`;
  if (location) return escapeHtml(location);
  if (online) return `<a href="${escapeHtml(online)}" target="_blank" rel="noopener noreferrer">Link do encontro</a>`;
  return 'Não informado';
}

function downloadIcs(item) {
  const safe = value => String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const start = parseLocalDate(item.date);
  const [hours = '00', minutes = '00'] = String(item.time || '00:00').split(':');
  start.setHours(Number(hours), Number(minutes), 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const format = date => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}00`;
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Portal Lions Publico//PT-BR', 'BEGIN:VEVENT',
    `UID:${safe(item.id)}@portal-lions`, `DTSTART:${format(start)}`, `DTEND:${format(end)}`,
    `SUMMARY:${safe(item.title)}`, `LOCATION:${safe(item.location)}`, `DESCRIPTION:${safe(item.details)}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agenda-${normalize(item.title).replace(/\s+/g, '-') || 'lions'}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openAppointment(type, id) {
  const item = appointments().find(candidate => candidate.type === type && String(candidate.id) === String(id));
  if (!item) return;
  openModal(item.title, `<div>
    <span class="agenda-type">${item.type === 'meeting' ? `${icon('handshake')} Reunião` : `${icon('calendar')} Evento`}</span>
    <div class="detail-grid">
      <div><small>Data</small><strong>${formatDate(item.date)}</strong></div>
      <div><small>Horário</small><strong>${escapeHtml(item.time || 'Não informado')}</strong></div>
      <div><small>Local</small><strong>${appointmentLocation(item)}</strong></div>
      <div><small>Status</small><strong>${escapeHtml(item.status || 'Confirmado')}</strong></div>
    </div>
    <div class="markdown">${simpleMarkdown(item.details || '')}</div>
    <div class="modal-actions"><button class="btn btn-primary" type="button" id="addCalendar">${icon('calendar')} Adicionar ao calendário</button></div>
  </div>`);
  document.getElementById('addCalendar')?.addEventListener('click', () => downloadIcs(item));
}

export function renderAgenda() {
  const items = appointments();
  const meetings = items.filter(item => item.type === 'meeting').length;
  const events = items.filter(item => item.type === 'event').length;
  const logo = escapeHtml(state.data?.settings?.logo || './public/logo.png');

  els.root.innerHTML = `
    <section class="hero hero-impact hero-impact-clean section-hero-home agenda-hero-home">
      <div class="hero-watermark" aria-hidden="true"><img src="${logo}" alt=""></div>
      <div class="hero-content">
        <span class="hero-eyebrow">Agenda do clube</span>
        <div class="hero-kicker">Compromissos públicos</div>
        <h2>Agenda pública</h2>
        <p>Eventos e reuniões publicados pelo clube para consulta pública.</p>
        <div class="hero-meta"><span class="pill">${icon('refresh')} ${escapeHtml(lastUpdateText())}</span></div>
        <div class="hero-chip-row" aria-label="Resumo da agenda">
          <span class="hero-chip">${icon('calendar')} ${items.length} compromisso${items.length === 1 ? '' : 's'}</span>
          <span class="hero-chip">${icon('handshake')} ${meetings} reuni${meetings === 1 ? 'ão' : 'ões'}</span>
          <span class="hero-chip">${icon('list')} ${events} evento${events === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="hero-badge hero-badge-impact section-hero-badge" aria-hidden="true">
        <div class="hero-logo-wrap"><img src="${logo}" alt=""></div>
        <div class="hero-seal-copy"><strong>Nós Servimos</strong><small>Distrito LB 1</small></div>
      </div>
    </section>
    <section class="section-banner agenda-toolbar agenda-toolbar-home">
      <div><h2>${icon('calendar')} Visualização da agenda</h2><p>Escolha como deseja consultar os compromissos.</p></div>
      <div class="segmented">
        <button type="button" data-agenda-mode="list" class="${state.agendaMode === 'list' ? 'active' : ''}">${icon('list')} Lista</button>
        <button type="button" data-agenda-mode="calendar" class="${state.agendaMode === 'calendar' ? 'active' : ''}">${icon('calendar')} Calendário</button>
      </div>
    </section>
    <div id="agendaContent"></div>`;

  document.querySelectorAll('[data-agenda-mode]').forEach(button => button.addEventListener('click', () => {
    state.agendaMode = button.dataset.agendaMode;
    renderAgenda();
  }));
  if (state.agendaMode === 'calendar') renderCalendar();
  else renderAgendaList();
}

function renderAgendaList() {
  const items = appointments();
  const today = dateKey(todayStart());
  const upcoming = items.filter(item => item.date >= today);
  const past = items.filter(item => item.date < today).reverse();
  const shown = [...upcoming, ...past.slice(0, 8)];
  document.getElementById('agendaContent').innerHTML = shown.length
    ? `<div class="agenda-list">${shown.map(item => {
      const date = parseLocalDate(item.date);
      return `<article class="agenda-item ${item.date < today ? 'agenda-item-past' : ''}">
        <div class="agenda-date"><strong>${String(date.getDate()).padStart(2, '0')}</strong><span>${new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '')}</span></div>
        <div class="agenda-main"><span class="agenda-type">${item.type === 'meeting' ? icon('handshake') + ' Reunião' : icon('calendar') + ' Evento'}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.time || 'Horário não informado')} · ${appointmentLocation(item)}</p><small>${escapeHtml(item.status || 'Confirmado')}</small></div>
        <button class="btn btn-ghost" type="button" data-appt="${escapeHtml(item.type)}:${escapeHtml(item.id)}">Ver detalhes</button>
      </article>`;
    }).join('')}</div>`
    : empty('Nenhum compromisso publicado.');
}

function renderCalendar() {
  const cursor = state.calendarCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const map = new Map();
  for (const item of appointments()) {
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
  }

  document.getElementById('agendaContent').innerHTML = `
    <div class="calendar-shell">
      <div class="calendar-headbar"><button class="icon-btn" id="prevMonth" type="button" aria-label="Mês anterior">‹</button><h3>${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor)}</h3><button class="icon-btn" id="nextMonth" type="button" aria-label="Próximo mês">›</button></div>
      <div class="calendar-grid">
        ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(label => `<div class="calendar-weekday">${label}</div>`).join('')}
        ${days.map(date => {
          const key = dateKey(date);
          const dayItems = map.get(key) || [];
          return `<div class="calendar-day ${date.getMonth() !== month ? 'outside' : ''} ${key === dateKey(new Date()) ? 'today' : ''}"><div class="calendar-number">${date.getDate()}</div><div class="calendar-events">${dayItems.slice(0, 3).map(item => `<button class="calendar-event" type="button" data-appt="${escapeHtml(item.type)}:${escapeHtml(item.id)}" title="${escapeHtml(item.title)}">${escapeHtml(item.time || '')} ${escapeHtml(item.title)}</button>`).join('')}</div>${dayItems.length > 3 ? `<small class="calendar-more">+${dayItems.length - 3}</small>` : ''}</div>`;
        }).join('')}
      </div>
    </div>`;

  document.getElementById('prevMonth').addEventListener('click', () => {
    state.calendarCursor = new Date(year, month - 1, 1);
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    state.calendarCursor = new Date(year, month + 1, 1);
    renderCalendar();
  });
}
