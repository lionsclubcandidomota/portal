import { memberIsActive as isActiveMember, memberStatusKey, memberStatusLabel } from '../core/portal-members.js?v=6.43.0';

export function createBirthdaysController() {
  let monthFilter = 'all';
  let periodFilter = 'all';
  let activeFilter = 'active';

  const reset = () => {
    monthFilter = 'all';
    periodFilter = 'all';
    activeFilter = 'active';
  };

  return {
    reset,
    get monthFilter() {
      return monthFilter;
    },

    set monthFilter(value) {
      monthFilter = value;
    },

    get periodFilter() {
      return periodFilter;
    },

    set periodFilter(value) {
      periodFilter = value;
    },

    get activeFilter() {
      return activeFilter;
    },

    set activeFilter(value) {
      activeFilter = value;
    }
  };
}

export function birthdayDisplayDate(birthDate, parseLocalDate) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long'
  }).format(parseLocalDate(birthDate));
}

export function birthdayShareButton(person, until) {
  return until === 0
    ? `<button class="btn btn-primary btn-sm birthday-wish-btn" type="button" data-birthday-share="${person.id}">🎉 Desejar parabéns</button>`
    : '';
}

export function createBirthdayActions(rowActions) {
  if (typeof rowActions !== 'function') {
    throw new TypeError('createBirthdayActions requer rowActions().');
  }

  return (person, until) =>
    `<div class="birthday-actions">${birthdayShareButton(person, until)}${rowActions('birthday', person.id)}</div>`;
}

export function birthdayStatus(until) {
  if (until === 0) {
    return {
      text: 'Hoje',
      icon: '🎉',
      className: 'birthday-status-today'
    };
  }

  if (until === 1) {
    return {
      text: 'Amanhã',
      icon: '🎂',
      className: 'birthday-status-tomorrow'
    };
  }

  if (until <= 7) {
    return {
      text: `Daqui a ${until} dias`,
      icon: '🎂',
      className: 'birthday-status-week'
    };
  }

  return {
    text: `Daqui a ${until} dias`,
    icon: '📅',
    className: 'birthday-status-later'
  };
}

export function birthdayMatchesPeriod(member, controller, helpers) {
  const {
    memberIsActive,
    parseLocalDate,
    nextBirthdayDate,
    daysUntil
  } = helpers;

  const situation = memberStatusKey(member);
  if (controller.activeFilter !== 'all' && controller.activeFilter !== situation) {
    return false;
  }

  if (controller.monthFilter !== 'all') {
    const month = parseLocalDate(member.birthDate).getMonth();

    if (month !== Number(controller.monthFilter)) {
      return false;
    }
  }

  if (controller.periodFilter !== 'all') {
    const until = daysUntil(nextBirthdayDate(member.birthDate));

    if (until > Number(controller.periodFilter)) {
      return false;
    }
  }

  return true;
}

export function birthdayRows(items, helpers){
  const {
    daysUntil,
    nextBirthdayDate,
    birthdayStatus,
    birthdayDisplayDate,
    parseLocalDate,
    memberIsActive,
    avatar,
    escapeHtml,
    birthdayActions,
    showMemberStatus = true,
    showMemberNumber = true
} = helpers;
  return items.map(x=>{
    const until=daysUntil(nextBirthdayDate(x.birthDate));
    const status=birthdayStatus(until);
    const situation = memberStatusKey(x);
    const memberStatusText = showMemberStatus
      ? (situation === 'mutual'
          ? '🤲 Mútua'
          : situation === 'inactive'
            ? '⏸ Associado inativo'
            : (until <= 7 ? '🎉 Aniversário próximo' : 'Associado ativo'))
      : (until <= 7 ? '🎉 Aniversário próximo' : '');
    const memberNumberCell = showMemberNumber ? `<td><strong>${escapeHtml(x.memberNumber || '—')}</strong></td>` : '';
    return `<tr>${memberNumberCell}<td><div class="list-item">${avatar(x)}<div class="list-item-main"><strong>${escapeHtml(x.name)}</strong>${memberStatusText ? `<small>${memberStatusText}</small>` : ''}</div></div></td><td>${birthdayDisplayDate(x.birthDate, parseLocalDate)}</td><td><span class="birthday-status ${status.className}">${status.icon} ${status.text}</span></td><td>${birthdayActions(x,until)}</td></tr>`;
  }).join('');
}

export function birthdayCards(items, helpers){
  const {
    daysUntil,
    nextBirthdayDate,
    birthdayStatus,
    birthdayDisplayDate,
    parseLocalDate,
    memberIsActive,
    avatar,
    escapeHtml,
    birthdayActions,
    empty,
    showMemberStatus = true,
    showMemberNumber = true
} = helpers;
  return items.length?items.map(x=>{
    const until=daysUntil(nextBirthdayDate(x.birthDate));
    const status=birthdayStatus(until);
    const memberMeta = showMemberNumber
      ? (x.memberNumber ? `Associado nº ${escapeHtml(x.memberNumber)}` : 'Número não informado')
      : '';
    const statusMeta = showMemberStatus ? `${memberMeta ? ' · ' : ''}${memberStatusLabel(x)}` : '';
    const meta = `${memberMeta}${statusMeta}`;
    return `<article class="birthday-mobile-card ${until===0?'is-today':until<=7?'is-soon':''}">
      <div class="birthday-mobile-person">${avatar(x)}<div><h4>${escapeHtml(x.name)}</h4>${meta ? `<small>${meta}</small>` : ''}</div></div>
      <div class="birthday-mobile-grid"><div><span>Aniversário</span><strong>${birthdayDisplayDate(x.birthDate, parseLocalDate)}</strong></div></div>
      <div class="birthday-mobile-next ${status.className}"><span>${status.icon} ${status.text}</span></div>
      <div class="birthday-mobile-actions">${birthdayActions(x,until)}</div>
    </article>`;
  }).join(''):`<div class="mobile-card-empty">${empty('🎂','Nenhum registro encontrado.')}</div>`;
}

export function renderBirthdays(state, helpers) {
  const {
    root,
    birthdays,
    normalize,
    memberIsActive,
    parseLocalDate,
    nextBirthdayDate,
    daysUntil,
    birthdayRows,
    birthdayCards,
    birthdayStatus,
    birthdayDisplayDate,
    avatar,
    escapeHtml,
    birthdayActions,
    empty,
    bindRowActions,
    ensureAdmin,
    openForm,
    adminUnlocked = false
  } = helpers;

  if (!adminUnlocked) birthdays.activeFilter = 'active';

  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];

  const visitorSearchCopy = adminUnlocked ? 'Pesquise por nome ou número' : 'Pesquise pelo nome';
  const visitorSearchPlaceholder = adminUnlocked ? 'Pesquisar por nome ou número...' : 'Pesquisar por nome...';
  const memberNumberHeader = adminUnlocked ? '<th>Nº do associado</th>' : '';
  const emptyColspan = adminUnlocked ? 5 : 4;

  root.innerHTML = `<section class="birthday-filter-card card"><div class="birthday-filter-copy"><span>🎂</span><div><strong>Localizar aniversariantes</strong><small>${visitorSearchCopy} e filtre por mês ou proximidade.</small></div></div><div class="birthday-filter-controls"><div class="search"><input id="searchInput" placeholder="${visitorSearchPlaceholder}" aria-label="Pesquisar aniversariantes"></div><select id="birthdayMonth" aria-label="Filtrar por mês"><option value="all">Todos os meses</option>${months.map((month,index)=>`<option value="${index}" ${birthdays.monthFilter===String(index)?'selected':''}>${month}</option>`).join('')}</select><select id="birthdayPeriod" aria-label="Filtrar por período"><option value="all" ${birthdays.periodFilter==='all'?'selected':''}>Todo o período</option><option value="30" ${birthdays.periodFilter==='30'?'selected':''}>Próximos 30 dias</option><option value="60" ${birthdays.periodFilter==='60'?'selected':''}>Próximos 60 dias</option><option value="90" ${birthdays.periodFilter==='90'?'selected':''}>Próximos 90 dias</option></select>${adminUnlocked ? `<select id="birthdayActive" aria-label="Filtrar por situação"><option value="active" ${birthdays.activeFilter==='active'?'selected':''}>Associados ativos</option><option value="mutual" ${birthdays.activeFilter==='mutual'?'selected':''}>Mutuários</option><option value="inactive" ${birthdays.activeFilter==='inactive'?'selected':''}>Associados inativos</option><option value="all" ${birthdays.activeFilter==='all'?'selected':''}>Todos</option></select>` : ''}<button class="btn btn-primary admin-only write-only" data-new="birthday" type="button">＋ Novo aniversariante</button></div></section><div class="birthday-filter-summary" id="birthdayFilterSummary"></div><div class="card birthdays-desktop-table"><div class="table-wrap"><table><thead><tr>${memberNumberHeader}<th>Pessoa</th><th>Aniversário</th><th>Próximo aniversário</th><th>Ações</th></tr></thead><tbody id="birthdaysBody"></tbody></table></div></div><div class="birthdays-mobile-list" id="birthdaysCards"></div>`;

  const search = document.getElementById('searchInput');

  const draw = () => {
    const q = search?.value || '';

    const filtered = state.birthdays
      .filter(x =>
        birthdayMatchesPeriod(x, birthdays, {
          memberIsActive,
          parseLocalDate,
          nextBirthdayDate,
          daysUntil
        })
      )
      .filter(x =>
        normalize(adminUnlocked ? `${x.name} ${x.memberNumber || ''}` : x.name).includes(normalize(q))
      )
      .sort(
        (a, b) =>
          nextBirthdayDate(a.birthDate) -
          nextBirthdayDate(b.birthDate)
      );

    document.getElementById('birthdaysBody').innerHTML =
      filtered.length
        ? birthdayRows(filtered, {
            daysUntil,
            nextBirthdayDate,
            birthdayStatus,
            birthdayDisplayDate,
            parseLocalDate,
            memberIsActive,
            avatar,
            escapeHtml,
            birthdayActions,
            showMemberStatus: adminUnlocked,
            showMemberNumber: adminUnlocked
          })
        : `<tr><td colspan="${emptyColspan}">${empty('🎂', 'Nenhum registro encontrado.')}</td></tr>`;

    document.getElementById('birthdaysCards').innerHTML =
      birthdayCards(filtered, {
        daysUntil,
        nextBirthdayDate,
        birthdayStatus,
        birthdayDisplayDate,
        parseLocalDate,
        memberIsActive,
        avatar,
        escapeHtml,
        birthdayActions,
        empty,
        showMemberStatus: adminUnlocked,
        showMemberNumber: adminUnlocked
      });

    const totalAvailable = adminUnlocked
      ? state.birthdays.length
      : state.birthdays.filter(isActiveMember).length;
    document.getElementById('birthdayFilterSummary').innerHTML =
      `Exibindo <strong>${filtered.length}</strong> de ${totalAvailable} aniversariante(s).`;

    bindRowActions();
  };

  search.oninput = draw;

  document.getElementById('birthdayMonth').onchange = e => {
    birthdays.monthFilter = e.target.value;
    draw();
  };

  document.getElementById('birthdayPeriod').onchange = e => {
    birthdays.periodFilter = e.target.value;
    draw();
  };

  const activeFilter = document.getElementById('birthdayActive');
  if (activeFilter) {
    activeFilter.onchange = e => {
      birthdays.activeFilter = e.target.value;
      draw();
    };
  }

  root.querySelectorAll('[data-new]').forEach(btn => {
    btn.onclick = () => ensureAdmin(() => openForm(btn.dataset.new));
  });

  draw();
}