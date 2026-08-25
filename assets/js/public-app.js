const DATA_URL = './data/dados.json';
const ICONS = './assets/icons/ui-icons.svg';

const VIEW_META = {
  dashboard: ['Início', 'Acompanhe as novidades do clube'],
  birthdays: ['Aniversários', 'Aniversariantes do mês atual'],
  leaders: ['Dirigentes', 'Diretoria e histórico dos Anos Leonísticos'],
  agenda: ['Agenda', 'Eventos e reuniões do clube'],
  notices: ['Avisos', 'Comunicados públicos do clube']
};

const state = { data: null, currentView: 'dashboard', agendaMode: 'list', calendarCursor: new Date() };
const els = {
  root: document.getElementById('viewRoot'),
  title: document.getElementById('pageTitle'),
  description: document.getElementById('pageDescription'),
  currentDate: document.getElementById('currentDate'),
  clock: document.getElementById('clock'),
  sidebar: document.getElementById('sidebar'),
  overlay: document.getElementById('sidebarOverlay'),
  menuBtn: document.getElementById('menuBtn'),
  clubName: document.getElementById('sidebarClubName'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  toast: document.getElementById('toastRegion'),
  themeToggle: document.getElementById('themeToggle'),
  themeIcon: document.getElementById('themeIcon'),
  themeLabel: document.getElementById('themeLabel')
};

function icon(name, className = '') {
  return `<svg class="ui-icon ${className}" aria-hidden="true" focusable="false"><use href="${ICONS}#${name}"></use></svg>`;
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
}
function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function parseLocalDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(NaN);
}
function formatDate(value, options = { day:'2-digit', month:'2-digit', year:'numeric' }) {
  const date = value instanceof Date ? value : parseLocalDate(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', options).format(date);
}
function todayStart() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function dateKey(date) {
  const y = date.getFullYear(); const m = String(date.getMonth()+1).padStart(2,'0'); const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function simpleMarkdown(text = '') {
  let safe = escapeHtml(text).replace(/\r\n?/g, '\n');
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const lines = safe.split('\n');
  let html = '', inList = false;
  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${bullet[1]}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim()) html += `<p>${line}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html || '<p>Sem informações adicionais.</p>';
}
function safeUrl(value = '') {
  try {
    const url = new URL(value, location.href);
    return ['http:','https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
function avatar(person, className = 'avatar') {
  const name = String(person?.name || 'Pessoa').trim();
  const photo = String(person?.photo || '').trim();
  return photo
    ? `<img class="${className}" src="${escapeHtml(photo)}" alt="Foto de ${escapeHtml(name)}" loading="lazy" decoding="async">`
    : `<span class="${className}" aria-hidden="true">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
}
function empty(message) { return `<div class="empty">${escapeHtml(message)}</div>`; }
function toast(message) {
  const node = document.createElement('div'); node.className = 'toast'; node.textContent = message; els.toast.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function applyBrand() {
  const settings = state.data?.settings || {};
  if (settings.clubName) els.clubName.textContent = settings.clubName;
  if (settings.primaryColor) document.documentElement.style.setProperty('--primary', settings.primaryColor);
  if (settings.accentColor) document.documentElement.style.setProperty('--accent', settings.accentColor);
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
function updateClock() {
  const now = new Date();
  els.clock.textContent = new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
  els.clock.dateTime = now.toISOString();
  els.currentDate.textContent = new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(now);
}
function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  els.themeToggle.setAttribute('aria-pressed', String(dark));
  els.themeToggle.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
  els.themeIcon.textContent = dark ? '☀' : '☾';
  els.themeLabel.textContent = dark ? 'Claro' : 'Escuro';
}
function bindShell() {
  els.menuBtn.addEventListener('click', () => {
    const open = !els.sidebar.classList.contains('open');
    els.sidebar.classList.toggle('open', open); els.overlay.classList.toggle('show', open); els.menuBtn.setAttribute('aria-expanded', String(open));
  });
  els.overlay.addEventListener('click', closeSidebar);
  els.themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('lions.public.theme', next); applyTheme(next);
  });
  document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeSidebar(); } });
  window.addEventListener('hashchange', () => {
    const view = location.hash.replace(/^#\/?/, '');
    if (VIEW_META[view] && view !== state.currentView) setView(view, {updateHash:false});
  });
}
function closeSidebar(){ els.sidebar.classList.remove('open'); els.overlay.classList.remove('show'); els.menuBtn.setAttribute('aria-expanded','false'); }
function setView(view, {updateHash=true} = {}) {
  if (!VIEW_META[view]) view = 'dashboard';
  state.currentView = view;
  const [title, desc] = VIEW_META[view]; els.title.textContent = title; els.description.textContent = desc;
  document.querySelectorAll('[data-view]').forEach(btn => {
    const active = btn.dataset.view === view; btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current','page'); else btn.removeAttribute('aria-current');
  });
  if (updateHash) history.replaceState(null,'',`#${view}`);
  closeSidebar(); render(); window.scrollTo({top:0,behavior:'auto'});
}
function openModal(title, html) { els.modalTitle.textContent = title; els.modalBody.innerHTML = html; els.modal.hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal() { if (els.modal.hidden) return; els.modal.hidden = true; els.modalBody.innerHTML = ''; document.body.style.overflow = ''; }

function birthdayParts(person) {
  const m = String(person.birthday || '').match(/^(\d{2})-(\d{2})$/); if (!m) return null;
  return { month:Number(m[1])-1, day:Number(m[2]) };
}
function nextBirthday(person, from = new Date()) {
  const parts = birthdayParts(person); if (!parts) return new Date(NaN);
  let d = new Date(from.getFullYear(), parts.month, parts.day); d.setHours(0,0,0,0);
  const today = new Date(from); today.setHours(0,0,0,0);
  if (d < today) d = new Date(from.getFullYear()+1, parts.month, parts.day);
  return d;
}
function daysUntilBirthday(person) { return Math.round((nextBirthday(person)-todayStart())/86400000); }
function birthdayDateText(person) {
  const p = birthdayParts(person); if (!p) return '—';
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long'}).format(new Date(2000,p.month,p.day));
}
function birthdayRelativeDays(person, from = new Date()) {
  const parts = birthdayParts(person); if (!parts) return Number.POSITIVE_INFINITY;
  const today = new Date(from); today.setHours(0,0,0,0);
  const occurrence = new Date(today.getFullYear(), parts.month, parts.day); occurrence.setHours(0,0,0,0);
  return Math.round((occurrence - today) / 86400000);
}
function birthdayStatus(person) {
  const days = birthdayRelativeDays(person);
  if (days === 0) return { text:'Hoje', cls:'today' };
  if (days === 1) return { text:'Amanhã', cls:'soon' };
  if (days > 1 && days <= 7) return { text:`Daqui a ${days} dias`, cls:'soon' };
  if (days > 7) return { text:`Daqui a ${days} dias`, cls:'' };
  if (days === -1) return { text:'Ontem', cls:'past' };
  return { text:`Há ${Math.abs(days)} dias`, cls:'past' };
}
function currentMonthBirthdays() {
  const today = new Date();
  const month = today.getMonth();
  return state.data.birthdays
    .filter(p => birthdayParts(p)?.month === month)
    .sort((a,b) => {
      const aDays = birthdayRelativeDays(a, today);
      const bDays = birthdayRelativeDays(b, today);
      const aUpcoming = aDays >= 0;
      const bUpcoming = bDays >= 0;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      if (aUpcoming) return aDays - bDays || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      return bDays - aDays || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
}
function appointments() {
  const events = state.data.events.map(e => ({...e,type:'event',title:e.name,details:e.description}));
  const meetings = state.data.meetings.map(m => ({...m,type:'meeting',title:m.theme || 'Reunião',details:m.notes}));
  return [...events,...meetings].sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
function upcomingAppointments(limit = Infinity) {
  const today = dateKey(todayStart());
  return appointments().filter(a => a.date >= today && normalize(a.status) !== 'cancelado').slice(0,limit);
}
function noticeExpired(n) {
  if (!n.endDate) return false; const end = parseLocalDate(n.endDate); end.setHours(23,59,59,999); return end < new Date();
}
function publicNotices() { return state.data.notices.filter(n => !noticeExpired(n)).sort((a,b) => a.date.localeCompare(b.date)); }
function lastUpdateText() {
  const value = state.data.updatedAt; if (!value) return 'Informações atualizadas';
  const d = new Date(value); if (Number.isNaN(d.getTime())) return 'Informações atualizadas';
  return `Atualizado em ${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)}`;
}

function renderDashboard() {
  const bdays = currentMonthBirthdays(); const upcoming = upcomingAppointments(5); const notices = publicNotices().slice(0,3); const settings = state.data.settings;
  els.root.innerHTML = `
    <section class="hero">
      <div class="hero-content"><span class="hero-eyebrow">Portal do clube</span><h2>${greeting()}!</h2><p>Acompanhe as novidades do ${escapeHtml(settings.clubName)}.</p><div class="hero-meta"><span class="pill">${icon('refresh')} ${escapeHtml(lastUpdateText())}</span></div></div>
      <div class="hero-logo"><div class="hero-logo-wrap"><img src="${escapeHtml(settings.logo || './public/logo.png')}" alt="Logo do ${escapeHtml(settings.clubName)}"></div><small>${escapeHtml(settings.clubName)}</small></div>
    </section>
    <section class="grid grid-kpis">
      <button class="kpi-card" type="button" data-go="agenda"><span class="kpi-icon">${icon('calendar')}</span><span class="kpi-copy"><small>Próximos na agenda</small><strong>${upcomingAppointments().length}</strong></span></button>
      <button class="kpi-card" type="button" data-go="notices"><span class="kpi-icon">${icon('megaphone')}</span><span class="kpi-copy"><small>Avisos disponíveis</small><strong>${publicNotices().length}</strong></span></button>
    </section>
    <section class="dashboard-grid">
      <article class="card full"><div class="card-header"><div><h3>${icon('cake')} Aniversários</h3><div class="card-subtitle">Aniversariantes do mês atual</div></div><button class="btn btn-ghost" type="button" data-go="birthdays">Ver todos</button></div><div class="list">${bdays.length ? bdays.slice(0,8).map(p => { const s=birthdayStatus(p); return `<div class="list-item">${avatar(p)}<div class="list-item-main"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(birthdayDateText(p))}</small></div><span class="birthday-status ${s.cls}">${escapeHtml(s.text)}</span></div>`; }).join('') : empty('Nenhum aniversariante neste mês.')}</div></article>
      <article class="card"><div class="card-header"><div><h3>${icon('calendar')} Agenda</h3><div class="card-subtitle">Próximos eventos e reuniões</div></div><button class="btn btn-ghost" type="button" data-go="agenda">Ver agenda</button></div><div class="list">${upcoming.length ? upcoming.map(a => `<button class="list-item" type="button" data-appt="${escapeHtml(a.type)}:${escapeHtml(a.id)}"><span class="kpi-icon">${icon(a.type==='meeting'?'handshake':'calendar')}</span><span class="list-item-main"><strong>${escapeHtml(a.title)}</strong><small>${formatDate(a.date,{day:'2-digit',month:'2-digit'})} · ${escapeHtml(a.time || 'Horário não informado')}</small></span></button>`).join('') : empty('Nenhum compromisso próximo.')}</div></article>
      <article class="card"><div class="card-header"><div><h3>${icon('megaphone')} Avisos</h3><div class="card-subtitle">Comunicados em destaque</div></div><button class="btn btn-ghost" type="button" data-go="notices">Ver avisos</button></div><div class="list">${notices.length ? notices.map(n => `<div class="notice"><h4>${escapeHtml(n.title)}</h4><div class="markdown">${simpleMarkdown(n.text)}</div><small>${formatDate(n.date)}${n.endDate ? ` até ${formatDate(n.endDate)}`:''}</small></div>`).join('') : empty('Nenhum aviso disponível.')}</div></article>
    </section>`;
  bindViewNavigation(); bindAppointmentButtons();
}

function renderBirthdays() {
  const month = new Intl.DateTimeFormat('pt-BR',{month:'long'}).format(new Date());
  els.root.innerHTML = `<section class="section-banner"><div><h2>${icon('cake')} Aniversários de ${month}</h2><p>Por privacidade, o portal público exibe somente dia e mês.</p></div><div class="search-row"><label class="search">${icon('search')}<input id="birthdaySearch" type="search" placeholder="Pesquisar pelo nome…" aria-label="Pesquisar aniversariantes"></label><span class="month-chip">${icon('calendar')} ${month}</span></div></section><div id="birthdayResults"></div>`;
  const input = document.getElementById('birthdaySearch');
  const draw = () => {
    const q=normalize(input.value); const items=currentMonthBirthdays().filter(p=>normalize(p.name).includes(q));
    const rows = items.map(p=>{const s=birthdayStatus(p);return `<tr><td><div class="birthday-person">${avatar(p)}<strong>${escapeHtml(p.name)}</strong></div></td><td class="birthday-date">${escapeHtml(birthdayDateText(p))}</td><td><span class="birthday-status ${s.cls}">${escapeHtml(s.text)}</span></td><td>${birthdayRelativeDays(p)===0?`<button class="btn btn-primary" type="button" data-birthday-share="${escapeHtml(p.id)}">${icon('cake')} Enviar parabéns</button>`:''}</td></tr>`}).join('');
    const cards = items.map(p=>{const s=birthdayStatus(p);return `<article class="birthday-card"><div class="birthday-card-head">${avatar(p)}<div><h3>${escapeHtml(p.name)}</h3><span class="birthday-status ${s.cls}">${escapeHtml(s.text)}</span></div></div><div class="birthday-card-meta"><div><small>Aniversário</small><strong>${escapeHtml(birthdayDateText(p))}</strong></div><div><small>Próxima data</small><strong>${formatDate(nextBirthday(p),{day:'2-digit',month:'2-digit'})}</strong></div></div>${birthdayRelativeDays(p)===0?`<div class="birthday-card-actions"><button class="btn btn-primary" type="button" data-birthday-share="${escapeHtml(p.id)}">${icon('cake')} Enviar parabéns</button></div>`:''}</article>`}).join('');
    document.getElementById('birthdayResults').innerHTML = items.length ? `<div class="card birthdays-table"><table><thead><tr><th>Pessoa</th><th>Aniversário</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div><div class="birthday-cards">${cards}</div>` : empty('Nenhum aniversariante encontrado neste mês.');
    document.querySelectorAll('[data-birthday-share]').forEach(btn=>btn.addEventListener('click',()=>shareBirthday(btn.dataset.birthdayShare)));
  };
  input.addEventListener('input',draw); draw();
}

function currentLionYear(date = new Date()) { const y=date.getFullYear(); return date.getMonth()>=6?`${y}/${y+1}`:`${y-1}/${y}`; }
function leaderYears() { return [...new Set(state.data.leaders.map(l=>l.lionYear).filter(Boolean))].sort((a,b)=>b.localeCompare(a)); }
function rolePriority(name='') { const n=normalize(name); const list=['presidente','vice presidente','secret','tesour','diretor']; const i=list.findIndex(x=>n.includes(x)); return i<0?99:i; }
function renderLeaders(selectedYear = '') {
  const years=leaderYears(); const year=selectedYear || (years.includes(currentLionYear())?currentLionYear():years[0]||currentLionYear());
  const leaders=state.data.leaders.filter(l=>l.lionYear===year).sort((a,b)=>rolePriority(a.role)-rolePriority(b.role)||a.role.localeCompare(b.role,'pt-BR'));
  els.root.innerHTML = `<section class="leaders-hero"><div><span class="hero-eyebrow">Diretoria do clube</span><h2>Dirigentes do AL ${escapeHtml(year)}</h2><p>Conheça as pessoas responsáveis pela condução do clube neste Ano Leonístico.</p></div>${years.length?`<label><span class="sr-only">Ano Leonístico</span><select id="leaderYear" aria-label="Selecionar Ano Leonístico">${years.map(y=>`<option value="${escapeHtml(y)}" ${y===year?'selected':''}>AL ${escapeHtml(y)}${y===currentLionYear()?' · Atual':''}</option>`).join('')}</select></label>`:''}</section><section class="leaders-grid">${leaders.length?leaders.map((l,i)=>`<article class="leader-card ${i===0?'featured':''}">${avatar(l,'leader-photo')}<span class="leader-role">${escapeHtml(l.role)}</span><h3>${escapeHtml(l.name)}</h3><p>${year===currentLionYear()?'Dirigente atual':`Dirigente no AL ${escapeHtml(year)}`}</p></article>`).join(''):empty('Os dirigentes deste Ano Leonístico ainda não foram publicados.')}</section>`;
  document.getElementById('leaderYear')?.addEventListener('change',e=>renderLeaders(e.target.value));
}

function appointmentLocation(a) {
  const online=safeUrl(a.onlineUrl); const location=String(a.location||'').trim();
  if (online && normalize(a.locationType)==='online') return `<a href="${escapeHtml(online)}" target="_blank" rel="noopener noreferrer">Acessar encontro on-line</a>`;
  if (location) return escapeHtml(location);
  if (online) return `<a href="${escapeHtml(online)}" target="_blank" rel="noopener noreferrer">Link do encontro</a>`;
  return 'Não informado';
}
function openAppointment(type,id) {
  const a=appointments().find(x=>x.type===type&&String(x.id)===String(id)); if(!a)return;
  openModal(a.title, `<div><span class="agenda-type">${a.type==='meeting'?`${icon('handshake')} Reunião`:`${icon('calendar')} Evento`}</span><div class="detail-grid"><div><small>Data</small><strong>${formatDate(a.date)}</strong></div><div><small>Horário</small><strong>${escapeHtml(a.time||'Não informado')}</strong></div><div><small>Local</small><strong>${appointmentLocation(a)}</strong></div><div><small>Status</small><strong>${escapeHtml(a.status||'Confirmado')}</strong></div></div><div class="markdown">${simpleMarkdown(a.details||'')}</div><div style="margin-top:16px;display:flex;justify-content:flex-end"><button class="btn btn-primary" type="button" id="addCalendar">${icon('calendar')} Adicionar ao calendário</button></div></div>`);
  document.getElementById('addCalendar')?.addEventListener('click',()=>downloadIcs(a));
}
function bindAppointmentButtons() { document.querySelectorAll('[data-appt]').forEach(btn=>btn.addEventListener('click',()=>{const [type,id]=btn.dataset.appt.split(':');openAppointment(type,id)})); }
function renderAgenda() {
  els.root.innerHTML = `<section class="section-banner"><div><h2>${icon('calendar')} Agenda pública</h2><p>Eventos e reuniões publicados pelo clube.</p></div><div class="segmented"><button type="button" data-agenda-mode="list" class="${state.agendaMode==='list'?'active':''}">${icon('list')} Lista</button><button type="button" data-agenda-mode="calendar" class="${state.agendaMode==='calendar'?'active':''}">${icon('calendar')} Calendário</button></div></section><div id="agendaContent"></div>`;
  document.querySelectorAll('[data-agenda-mode]').forEach(btn=>btn.addEventListener('click',()=>{state.agendaMode=btn.dataset.agendaMode;renderAgenda()}));
  if(state.agendaMode==='calendar') renderCalendar(); else renderAgendaList();
}
function renderAgendaList() {
  const items=appointments(); const today=dateKey(todayStart()); const upcoming=items.filter(a=>a.date>=today); const past=items.filter(a=>a.date<today).reverse(); const shown=[...upcoming,...past.slice(0,8)];
  document.getElementById('agendaContent').innerHTML = shown.length?`<div class="agenda-list">${shown.map(a=>{const d=parseLocalDate(a.date);return `<article class="agenda-item"><div class="agenda-date"><strong>${String(d.getDate()).padStart(2,'0')}</strong><span>${new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(d).replace('.','')}</span></div><div class="agenda-main"><span class="agenda-type">${a.type==='meeting'?icon('handshake')+' Reunião':icon('calendar')+' Evento'}</span><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.time||'Horário não informado')} · ${appointmentLocation(a)}</p><small>${escapeHtml(a.status||'Confirmado')}</small></div><button class="btn btn-ghost" type="button" data-appt="${escapeHtml(a.type)}:${escapeHtml(a.id)}">Ver detalhes</button></article>`}).join('')}</div>`:empty('Nenhum compromisso publicado.'); bindAppointmentButtons();
}
function renderCalendar() {
  const cursor=state.calendarCursor; const y=cursor.getFullYear(),m=cursor.getMonth(); const first=new Date(y,m,1); const start=new Date(y,m,1-first.getDay()); const days=Array.from({length:42},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i)); const map=new Map();
  for(const a of appointments()){ if(!map.has(a.date))map.set(a.date,[]); map.get(a.date).push(a); }
  document.getElementById('agendaContent').innerHTML = `<div class="calendar-shell"><div class="calendar-headbar"><button class="icon-btn" id="prevMonth" type="button" aria-label="Mês anterior">‹</button><h3>${new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(cursor)}</h3><button class="icon-btn" id="nextMonth" type="button" aria-label="Próximo mês">›</button></div><div class="calendar-grid">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=>`<div class="calendar-weekday">${x}</div>`).join('')}${days.map(d=>{const key=dateKey(d),items=map.get(key)||[];return `<div class="calendar-day ${d.getMonth()!==m?'outside':''} ${key===dateKey(new Date())?'today':''}"><div class="calendar-number">${d.getDate()}</div><div class="calendar-events">${items.slice(0,3).map(a=>`<button class="calendar-event" type="button" data-appt="${escapeHtml(a.type)}:${escapeHtml(a.id)}" title="${escapeHtml(a.title)}">${escapeHtml(a.time||'')} ${escapeHtml(a.title)}</button>`).join('')}</div>${items.length>3?`<small class="calendar-more">+${items.length-3}</small>`:''}</div>`}).join('')}</div></div>`;
  document.getElementById('prevMonth').addEventListener('click',()=>{state.calendarCursor=new Date(y,m-1,1);renderCalendar()}); document.getElementById('nextMonth').addEventListener('click',()=>{state.calendarCursor=new Date(y,m+1,1);renderCalendar()}); bindAppointmentButtons();
}
function downloadIcs(a) {
  const safe=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); const start=parseLocalDate(a.date); const [hh='00',mm='00']=String(a.time||'00:00').split(':'); start.setHours(Number(hh),Number(mm),0,0); const end=new Date(start.getTime()+60*60*1000); const fmt=d=>`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}00`; const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Portal Lions Publico//PT-BR','BEGIN:VEVENT',`UID:${safe(a.id)}@portal-lions`,`DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,`SUMMARY:${safe(a.title)}`,`LOCATION:${safe(a.location)}`,`DESCRIPTION:${safe(a.details)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n'); const blob=new Blob([body],{type:'text/calendar;charset=utf-8'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`agenda-${normalize(a.title).replace(/\s+/g,'-')||'lions'}.ics`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function renderNotices() {
  const items=publicNotices(); els.root.innerHTML = `<section class="section-banner"><div><h2>${icon('megaphone')} Avisos públicos</h2><p>Comunicados ativos e programados.</p></div></section><section class="notices-list">${items.length?items.map((n,i)=>`<article class="notice-card"><button class="notice-summary" type="button" data-notice-toggle="${i}" aria-expanded="${i===0?'true':'false'}"><span class="notice-icon">${icon('megaphone')}</span><span><strong>${escapeHtml(n.title)}</strong><small>${formatDate(n.date)}${n.endDate?` até ${formatDate(n.endDate)}`:''}</small></span><span class="priority">${escapeHtml(n.priority||'Normal')}</span></button><div class="notice-details markdown" data-notice-details="${i}" ${i===0?'':'hidden'}>${simpleMarkdown(n.text)}</div></article>`).join(''):empty('Nenhum aviso disponível.')}</section>`;
  document.querySelectorAll('[data-notice-toggle]').forEach(btn=>btn.addEventListener('click',()=>{const d=document.querySelector(`[data-notice-details="${btn.dataset.noticeToggle}"]`); const open=!d.hidden; d.hidden=open; btn.setAttribute('aria-expanded',String(!open));}));
}

async function shareBirthday(id) {
  const person=state.data.birthdays.find(p=>String(p.id)===String(id)); if(!person)return; const buttons=[...document.querySelectorAll(`[data-birthday-share="${CSS.escape(String(id))}"]`)]; buttons.forEach(b=>b.disabled=true);
  try {
    const blob=await createBirthdayArtwork(person); const fileName=`feliz-aniversario-${normalize(person.name).replace(/\s+/g,'-')}.png`; const file=new File([blob],fileName,{type:'image/png'});
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) await navigator.share({title:`Feliz aniversário, ${person.name}!`,files:[file]}); else { const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);toast('Arte de aniversário baixada.'); }
  } catch(e) { if(e?.name!=='AbortError') toast('Não foi possível criar a homenagem.'); }
  finally { buttons.forEach(b=>b.disabled=false); }
}
function loadImage(src) { return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src}); }
async function createBirthdayArtwork(person) {
  const template=await loadImage('./assets/templates/birthday-template.webp'); const canvas=document.createElement('canvas'); canvas.width=template.naturalWidth||1248; canvas.height=template.naturalHeight||1248; const ctx=canvas.getContext('2d'); ctx.drawImage(template,0,0,canvas.width,canvas.height); const sx=canvas.width/1248,sy=canvas.height/1248,s=Math.min(sx,sy),cx=414*sx,cy=684*sy,r=322*s; ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();ctx.fillStyle='#eaf2f8';ctx.fillRect(cx-r,cy-r,2*r,2*r); if(person.photo){try{const p=await loadImage(person.photo);const z=Math.max((2*r)/p.width,(2*r)/p.height);const w=p.width*z,h=p.height*z;ctx.drawImage(p,cx-w/2,cy-h/2-r*.035,w,h)}catch{drawInitial(ctx,person,cx,cy,r)}}else drawInitial(ctx,person,cx,cy,r);ctx.restore(); ctx.strokeStyle='#e8b737';ctx.lineWidth=15*s;ctx.beginPath();ctx.arc(cx,cy,r+2*s,0,Math.PI*2);ctx.stroke(); const x=92*sx,y=958*sy,w=645*sx,h=112*sy;ctx.fillStyle='rgba(2,38,70,.95)';roundRect(ctx,x,y,w,h,28*s);ctx.fill();ctx.strokeStyle='#e8b737';ctx.lineWidth=3*s;ctx.stroke();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';let fs=46*s;ctx.font=`800 ${fs}px system-ui`;while(ctx.measureText(person.name).width>w-40*s&&fs>24*s){fs-=2*s;ctx.font=`800 ${fs}px system-ui`}ctx.fillText(person.name,x+w/2,y+h/2); return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('blob')),'image/png'));
}
function drawInitial(ctx,p,cx,cy,r){ctx.fillStyle='#075ca8';ctx.fillRect(cx-r,cy-r,2*r,2*r);ctx.fillStyle='#fff';ctx.font=`900 ${r}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(p.name||'?').charAt(0).toUpperCase(),cx,cy)}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}

function bindViewNavigation(){ document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.go))); }
function render(){ if(!state.data)return; ({dashboard:renderDashboard,birthdays:renderBirthdays,leaders:()=>renderLeaders(),agenda:renderAgenda,notices:renderNotices}[state.currentView]||renderDashboard)(); }

async function bootstrap() {
  bindShell(); applyTheme(localStorage.getItem('lions.public.theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')); updateClock(); setInterval(updateClock,1000);
  try {
    const response=await fetch(DATA_URL,{cache:'no-store'}); if(!response.ok)throw new Error(`HTTP ${response.status}`); const payload=await response.json(); state.data=payload.data; state.data.updatedAt=payload.updatedAt; applyBrand(); const view=location.hash.replace(/^#\/?/,''); setView(VIEW_META[view]?view:'dashboard',{updateHash:false}); document.body.classList.add('ready');
  } catch(error) { console.error(error); els.root.innerHTML='<div class="card"><h2>Não foi possível carregar o portal</h2><p>Confira se o arquivo <strong>data/dados.json</strong> está disponível e atualize a página.</p></div>'; }
}
bootstrap();
