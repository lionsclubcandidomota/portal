export function createAgendaController() {
  let mode = 'list';
  let filter = 'all';
  let quickFilter = 'all';
  let calendarCursor = new Date();

  const reset = () => {
    mode = 'list';
    filter = 'all';
    quickFilter = 'all';
    calendarCursor = new Date();
  };

  return {
    reset,
    get mode() {
      return mode;
    },

    set mode(value) {
      mode = value;
    },

    get filter() {
      return filter;
    },

    set filter(value) {
      filter = value;
    },

    get quickFilter() {
      return quickFilter;
    },

    set quickFilter(value) {
      quickFilter = value;
    },

    get calendarCursor() {
      return calendarCursor;
    },

    set calendarCursor(value) {
      calendarCursor = value;
    }
  };
}

export function renderAgenda(agenda, helpers) {
  if (!helpers?.modalController || typeof helpers.modalController.open !== 'function') {
    throw new TypeError('renderAgenda requer modalController.');
  }
  const {
    root,
    getAppointments,
    todayStart,
    toInputDate,
    parseLocalDate,
    locationInfo,
    pageToolbar,
    bindToolbar
  } = helpers;

  const all = getAppointments();
  const today = todayStart();
  const upcoming = all.filter(item => parseLocalDate(item.date) >= today);
  const todayKey = toInputDate(new Date());
  const todayCount = all.filter(item => item.date === todayKey).length;
  const virtualCount = upcoming.filter(item => locationInfo(item).type === 'virtual').length;
  const rerender = () => renderAgenda(agenda, helpers);

  root.innerHTML = `
    <section class="agenda-overview" aria-label="Atalhos da agenda"><p class="agenda-overview-hint">Clique para filtrar. Clique novamente no card selecionado para mostrar toda a agenda.</p>
      <button type="button" class="agenda-overview-card ${agenda.quickFilter === 'upcoming' ? 'is-active' : ''}" data-agenda-quick="upcoming" aria-pressed="${agenda.quickFilter === 'upcoming'}"><span class="agenda-overview-icon">🗓️</span><div><small>Próximos</small><strong>${upcoming.length}</strong><span>compromissos</span></div><span class="agenda-overview-arrow" aria-hidden="true">›</span></button>
      <button type="button" class="agenda-overview-card ${agenda.quickFilter === 'today' ? 'is-active' : ''}" data-agenda-quick="today" aria-pressed="${agenda.quickFilter === 'today'}"><span class="agenda-overview-icon">☀️</span><div><small>Hoje</small><strong>${todayCount}</strong><span>programados</span></div><span class="agenda-overview-arrow" aria-hidden="true">›</span></button>
      <button type="button" class="agenda-overview-card ${agenda.quickFilter === 'virtual' ? 'is-active' : ''}" data-agenda-quick="virtual" aria-pressed="${agenda.quickFilter === 'virtual'}"><span class="agenda-overview-icon">🎥</span><div><small>Virtuais</small><strong>${virtualCount}</strong><span>com acesso online</span></div><span class="agenda-overview-arrow" aria-hidden="true">›</span></button>
    </section>
    <section class="agenda-command-card">
      ${pageToolbar('Buscar na agenda...', 'Adicionar compromisso', 'appointment')}
      <div class="toolbar agenda-toolbar"><div class="toolbar-group agenda-view-switch"><button class="btn ${agenda.mode === 'list' ? 'btn-primary' : 'btn-ghost'}" id="listMode" type="button">☷ Lista</button><button class="btn ${agenda.mode === 'calendar' ? 'btn-primary' : 'btn-ghost'}" id="calendarMode" type="button">▦ Calendário</button></div><div class="toolbar-group agenda-filters" aria-label="Filtrar agenda"><button class="btn ${agenda.filter === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-agenda-filter="all" type="button">Todos</button><button class="btn ${agenda.filter === 'event' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-agenda-filter="event" type="button">📅 Eventos</button><button class="btn ${agenda.filter === 'meeting' ? 'btn-primary' : 'btn-ghost'} btn-sm" data-agenda-filter="meeting" type="button">🤝 Reuniões</button></div></div>
    </section>
    <div id="agendaContent"></div>`;

  root.querySelector('#listMode').onclick = () => {
    agenda.mode = 'list';
    rerender();
  };

  root.querySelector('#calendarMode').onclick = () => {
    agenda.mode = 'calendar';
    rerender();
  };

  root.querySelectorAll('[data-agenda-filter]').forEach(button => {
    button.onclick = () => {
      agenda.filter = button.dataset.agendaFilter;
      rerender();
    };
  });

  root.querySelectorAll('[data-agenda-quick]').forEach(button => {
    button.onclick = () => {
      const selected = button.dataset.agendaQuick;
      agenda.quickFilter = agenda.quickFilter === selected ? 'all' : selected;
      agenda.mode = 'list';
      rerender();
      requestAnimationFrame(() => {
        root.querySelector('#agendaContent')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    };
  });

  const draw = (query = '') => {
    if (agenda.mode === 'calendar') {
      renderAgendaCalendar(agenda, query, helpers);
      return;
    }

    renderAgendaList(agenda, query, helpers);
  };

  bindToolbar(draw);
  draw();
}

function agendaTable(items, emptyText, helpers) {
  const {
    toInputDate,
    parseLocalDate,
    todayStart,
    appointmentTypeBadge,
    escapeHtml,
    formatDate,
    statusBadge,
    renderLocation,
    markdownToHtml,
    rowActions,
    empty
  } = helpers;

  const cards = items.length
    ? items.map(item => {
        const isToday = toInputDate(parseLocalDate(item.date)) === toInputDate(new Date());
        const details = String(item.details || '').trim();
        const isPast = parseLocalDate(item.date) < todayStart();

        return `<article class="expandable-record-card agenda-record-card ${item.appointmentType} ${isPast ? 'is-past' : ''}" data-expandable-card>
          <button class="expandable-record-summary" type="button" data-card-toggle aria-expanded="false">
            <span class="record-icon">${item.appointmentType === 'meeting' ? '🤝' : '📅'}</span><span class="record-summary-main">${appointmentTypeBadge(item)}<strong>${escapeHtml(item.title)}</strong><small>📅 ${formatDate(item.date)}${isToday ? ' · Hoje' : ''} &nbsp; 🕒 ${escapeHtml(item.time || 'Sem horário')}</small></span><span class="badge ${isPast ? 'badge-muted' : statusBadge(item.status)}">${isPast ? 'Realizado' : escapeHtml(item.status)}</span><span class="record-chevron" aria-hidden="true"></span>
          </button>
          <div class="expandable-record-details" hidden>
            <div class="record-detail-grid"><div><small>Data</small><strong>${formatDate(item.date)}</strong></div><div><small>Horário</small><strong>${escapeHtml(item.time || 'Não informado')}</strong></div><div><small>Local</small><strong>${renderLocation(item, { compact: true })}</strong></div><div><small>Status</small><strong>${isPast ? 'Realizado' : escapeHtml(item.status)}</strong></div></div>
            <div class="record-notes markdown-body">${details ? markdownToHtml(details) : '<p>Nenhuma descrição informada.</p>'}</div>
            <div class="record-actions"><button class="btn btn-ghost btn-sm" type="button" data-open-appointment="${item.appointmentType}" data-id="${item.id}">Visualizar detalhes</button>${rowActions(item.appointmentType, item.id)}</div>
          </div>
        </article>`;
      }).join('')
    : `<div class="agenda-mobile-empty">${empty('🗓️', emptyText)}</div>`;

  return `<div class="expandable-record-list agenda-record-list">${cards}</div>`;
}

function bindAgendaDescriptionToggles(root) {
  root.querySelectorAll('[data-agenda-more]').forEach(button => {
    button.onclick = () => {
      const box = button.closest('[data-description]');
      if (!box) return;

      const expanded = box.classList.toggle('expanded');
      button.textContent = expanded ? 'Ver menos' : 'Ver mais';
      button.setAttribute('aria-expanded', String(expanded));
    };
  });
}

function bindStructuredTextToggles(root) {
  root.querySelectorAll('[data-structured-text]').forEach(box => {
    const button = box.querySelector('[data-structured-toggle]');
    if (!button) return;

    requestAnimationFrame(() => {
      const text = (box.textContent || '').replace(button.textContent || '', '').trim();
      const needsToggle = text.length > 115 || box.scrollHeight > box.clientHeight + 1;

      button.hidden = !needsToggle;
      box.classList.toggle('has-overflow', needsToggle);

      if (!needsToggle) {
        box.classList.remove('expanded');
        button.setAttribute('aria-expanded', 'false');
        button.textContent = 'Ver mais';
      }
    });
  });
}

function filteredAppointments(agenda, query, helpers) {
  const {
    getAppointments,
    todayStart,
    toInputDate,
    normalize,
    parseLocalDate,
    locationInfo
  } = helpers;

  const today = todayStart();
  const todayKey = toInputDate(new Date());

  return getAppointments().filter(item => {
    const matchesType = agenda.filter === 'all' || item.appointmentType === agenda.filter;
    const matchesSearch = normalize(`${item.title} ${item.details} ${item.location} ${item.onlineUrl || ''}`).includes(normalize(query));
    const date = parseLocalDate(item.date);
    const matchesQuick = agenda.quickFilter === 'today'
      ? item.date === todayKey
      : agenda.quickFilter === 'virtual'
        ? date >= today && locationInfo(item).type === 'virtual'
        : agenda.quickFilter === 'upcoming'
          ? date >= today
          : true;

    return matchesType && matchesSearch && matchesQuick;
  });
}

function renderAgendaList(agenda, query, helpers) {
  const {
    root,
    todayStart,
    parseLocalDate,
    compareAppointments,
    timelineHeading,
    bindRowActions
  } = helpers;

  const filtered = filteredAppointments(agenda, query, helpers);
  const today = todayStart();
  const active = filtered
    .filter(item => parseLocalDate(item.date) >= today)
    .sort(compareAppointments);
  const history = filtered
    .filter(item => parseLocalDate(item.date) < today)
    .sort((a, b) => -compareAppointments(a, b));
  const quickLabels = {
    all: ['🗓️', 'Agenda atual', 'Eventos e reuniões de hoje em diante.'],
    upcoming: ['🗓️', 'Próximos', 'Eventos e reuniões em ordem de data.'],
    today: ['☀️', 'Hoje', 'Compromissos programados para hoje.'],
    virtual: ['🎥', 'Online', 'Compromissos com acesso virtual.']
  };
  const [icon, title, subtitle] = quickLabels[agenda.quickFilter] || quickLabels.all;
  const showHistory = agenda.quickFilter === 'all';
  const content = root.querySelector('#agendaContent');

  if (!content) return;

  content.innerHTML = `
    <section class="timeline-section agenda-results-section agenda-active-section">${timelineHeading(icon, title, subtitle, active.length)}${agendaTable(active, 'Nenhum compromisso ativo encontrado.', helpers)}</section>
    ${showHistory ? `<section class="timeline-section agenda-results-section agenda-history-section is-history">${timelineHeading('🕘', 'Histórico', 'Compromissos já realizados.', history.length, true)}${agendaTable(history, 'Nenhum compromisso realizado no histórico.', helpers)}</section>` : ''}`;

  bindRowActions();
  bindAgendaDescriptionToggles(root);
  bindStructuredTextToggles(root);

  root.querySelectorAll('[data-open-appointment]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      openAppointmentDetails(
        button.dataset.openAppointment,
        button.dataset.id,
        helpers
      );
    });
  });
}

function appointmentKey(item) {
  return `${item.appointmentType}:${item.id}`;
}

function openCalendarDayDetails(date, appointments, helpers) {
  const {
    parseLocalDate,
    modalController,
    escapeHtml,
    todayStart,
    appointmentLocationText
  } = helpers;

  if (!appointments.length) return;

  const dayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(parseLocalDate(date));

  const modalBody = modalController.open('Compromissos do dia', `<section class="calendar-day-details"><p class="calendar-day-label">${escapeHtml(dayLabel)}</p><div class="calendar-day-list">${appointments.map(item => {
    const past = parseLocalDate(item.date) < todayStart();
    return `<button type="button" class="calendar-day-item ${item.appointmentType} ${past ? 'is-past' : ''}" data-day-appointment="${appointmentKey(item)}"><span class="calendar-day-item-icon">${item.appointmentType === 'meeting' ? '🤝' : '📅'}</span><span class="calendar-day-item-content"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.time || 'Horário não informado')} · ${escapeHtml(appointmentLocationText(item))}</small></span><span class="calendar-day-item-arrow" aria-hidden="true">›</span></button>`;
  }).join('')}</div><div class="form-actions"><button class="btn btn-primary" type="button" data-close-modal>Fechar</button></div></section>`);

  modalBody.querySelectorAll('[data-day-appointment]').forEach(button => {
    button.addEventListener('click', () => {
      const [type, id] = button.dataset.dayAppointment.split(':');
      openAppointmentDetails(type, id, helpers);
    });
  });
}

function openAppointmentDetails(type, id, helpers) {
  const {
    getAppointments,
    parseLocalDate,
    todayStart,
    modalController,
    appointmentTypeBadge,
    escapeHtml,
    formatDate,
    toInputDate,
    renderLocation,
    statusBadge,
    markdownToHtml,
    isAdminUnlocked,
    closeModal,
    openForm,
    downloadAppointmentCalendar
  } = helpers;

  const item = getAppointments().find(appointment =>
    appointment.appointmentType === type && appointment.id === id
  );

  if (!item) return;

  const isPast = parseLocalDate(item.date) < todayStart();
  const icon = item.appointmentType === 'meeting' ? '🤝' : '📅';
  const adminUnlocked = isAdminUnlocked();

  const modalBody = modalController.open('Detalhes do compromisso', `<article class="appointment-details ${isPast ? 'is-past' : ''}">
    <div class="appointment-details-head"><div class="appointment-details-icon">${icon}</div><div>${appointmentTypeBadge(item)}<h3>${escapeHtml(item.title)}</h3></div></div>
    <div class="appointment-details-grid">
      <div class="appointment-detail"><small>Data</small><strong>${formatDate(item.date)}${toInputDate(parseLocalDate(item.date)) === toInputDate(new Date()) ? ' · Hoje' : ''}</strong></div>
      <div class="appointment-detail"><small>Horário</small><strong>${escapeHtml(item.time || 'Não informado')}</strong></div>
      <div class="appointment-detail"><small>Local</small><strong>${renderLocation(item)}</strong></div>
      <div class="appointment-detail"><small>Status</small><span class="badge ${isPast ? 'badge-muted' : statusBadge(item.status)}">${isPast ? 'Realizado' : escapeHtml(item.status || 'Confirmado')}</span></div>
    </div>
    <div><small style="display:block;color:var(--muted);margin-bottom:7px">Descrição ou observações</small><div class="appointment-description markdown-body">${markdownToHtml(item.details || 'Nenhuma informação adicional cadastrada.')}</div></div>
    <div class="form-actions appointment-detail-actions"><button class="btn btn-ghost" type="button" data-add-calendar>📅 Adicionar ao calendário</button>${adminUnlocked ? `<button class="btn btn-ghost" type="button" data-detail-edit="${item.appointmentType}" data-id="${item.id}">Editar compromisso</button>` : ''}<button class="btn btn-primary" type="button" data-close-modal>Fechar</button></div>
  </article>`);

  modalBody.querySelector('[data-detail-edit]')?.addEventListener('click', event => {
    const button = event.currentTarget;
    closeModal();
    openForm(button.dataset.detailEdit, button.dataset.id);
  });

  modalBody.querySelector('[data-add-calendar]')?.addEventListener('click', () => {
    downloadAppointmentCalendar(item);
  });
}

function renderAgendaCalendar(agenda, query, helpers) {
  const {
    root,
    toInputDate,
    compareAppointments,
    formatDate,
    parseLocalDate,
    todayStart,
    escapeHtml
  } = helpers;

  const year = agenda.calendarCursor.getFullYear();
  const month = agenda.calendarCursor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const days = [];

  for (let index = 0; index < 42; index += 1) {
    days.push(new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index
    ));
  }

  const monthName = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric'
  }).format(agenda.calendarCursor);
  const appointments = filteredAppointments(agenda, query, helpers);
  const content = root.querySelector('#agendaContent');

  if (!content) return;

  content.innerHTML = `<div class="card calendar-card"><div class="card-header calendar-card-header"><button class="icon-btn" id="prevMonth" aria-label="Mês anterior" type="button">‹</button><div class="calendar-title"><h3>${monthName}</h3><div class="card-subtitle">📅 Evento &nbsp; · &nbsp; 🤝 Reunião</div></div><button class="icon-btn" id="nextMonth" aria-label="Próximo mês" type="button">›</button></div><div class="calendar">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => `<div class="calendar-head">${day}</div>`).join('')}${days.map(day => {
    const iso = toInputDate(day);
    const items = appointments
      .filter(item => item.date === iso)
      .sort(compareAppointments);
    const isToday = toInputDate(new Date()) === iso;

    return `<div class="calendar-day ${day.getMonth() !== month ? 'muted' : ''} ${isToday ? 'today' : ''} ${items.length ? 'has-items' : ''}" data-calendar-date="${iso}" ${items.length ? `tabindex="0" role="button" aria-label="Abrir ${items.length} compromisso(s) de ${formatDate(iso)}"` : ''}><div class="calendar-number">${day.getDate()}</div><div class="calendar-events">${items.slice(0, 4).map(item => {
      const past = parseLocalDate(item.date) < todayStart();
      return `<button type="button" class="calendar-event calendar-event-button ${item.appointmentType} ${past ? 'is-past' : ''}" data-calendar-type="${item.appointmentType}" data-calendar-id="${item.id}" title="Abrir: ${escapeHtml(item.title)}" aria-label="Abrir detalhes de ${escapeHtml(item.title)}"><span class="calendar-event-icon">${item.appointmentType === 'meeting' ? '🤝' : '📅'}</span><span class="calendar-event-text">${escapeHtml(item.time)} ${escapeHtml(item.title)}</span></button>`;
    }).join('')}</div>${items.length > 4 ? `<small class="calendar-more">+${items.length - 4}</small>` : ''}</div>`;
  }).join('')}</div></div>`;

  content.querySelector('#prevMonth').onclick = () => {
    agenda.calendarCursor = new Date(year, month - 1, 1);
    renderAgendaCalendar(agenda, query, helpers);
  };

  content.querySelector('#nextMonth').onclick = () => {
    agenda.calendarCursor = new Date(year, month + 1, 1);
    renderAgendaCalendar(agenda, query, helpers);
  };

  content.querySelectorAll('[data-calendar-id]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openAppointmentDetails(
        button.dataset.calendarType,
        button.dataset.calendarId,
        helpers
      );
    });
  });

  content.querySelectorAll('.calendar-day.has-items').forEach(day => {
    const openDay = () => openCalendarDayDetails(
      day.dataset.calendarDate,
      appointments
        .filter(item => item.date === day.dataset.calendarDate)
        .sort(compareAppointments),
      helpers
    );

    day.addEventListener('click', openDay);
    day.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDay();
      }
    });
  });
}
