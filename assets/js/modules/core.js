export const DATA_URL = './data/dados.json';
export const ICONS = './assets/icons/ui-icons.svg';

export const VIEW_META = {
  dashboard: ['Início', 'Acompanhe as novidades do clube'],
  birthdays: ['Aniversários', 'Aniversariantes do mês atual'],
  leaders: ['Dirigentes', 'Diretoria e histórico dos Anos Leonísticos'],
  agenda: ['Agenda', 'Eventos e reuniões do clube'],
  notices: ['Avisos', 'Comunicados públicos do clube']
};

export const state = {
  data: null,
  currentView: 'dashboard',
  agendaMode: 'list',
  calendarCursor: new Date(),
  lastFocusedElement: null,
  sidebarCollapsed: false
};

export const els = {
  appShell: document.querySelector('.app-shell'),
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

export function icon(name, className = '') {
  return `<svg class="ui-icon ${className}" aria-hidden="true" focusable="false"><use href="${ICONS}#${name}"></use></svg>`;
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

export function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function parseLocalDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(NaN);
}

export function formatDate(value, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  const date = value instanceof Date ? value : parseLocalDate(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', options).format(date);
}

export function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function simpleMarkdown(text = '') {
  let safe = escapeHtml(text).replace(/\r\n?/g, '\n');
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const lines = safe.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${bullet[1]}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (line.trim()) html += `<p>${line}</p>`;
  }

  if (inList) html += '</ul>';
  return html || '<p>Sem informações adicionais.</p>';
}

export function safeUrl(value = '') {
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function avatar(person, className = 'avatar') {
  const name = String(person?.name || 'Pessoa').trim();
  const photo = String(person?.photo || '').trim();
  return photo
    ? `<img class="${className}" src="${escapeHtml(photo)}" alt="Foto de ${escapeHtml(name)}" loading="lazy" decoding="async">`
    : `<span class="${className}" aria-hidden="true">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
}

export function empty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

export function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  els.toast.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

export function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
}

export function lastUpdateText() {
  const value = state.data?.updatedAt;
  if (!value) return 'Informações atualizadas';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Informações atualizadas';
  return `Atualizado em ${new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date)}`;
}

export function openModal(title, html) {
  state.lastFocusedElement = document.activeElement;
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = html;
  els.modal.hidden = false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => els.modal.querySelector('[data-close-modal]')?.focus());
}

export function closeModal() {
  if (els.modal.hidden) return;
  els.modal.hidden = true;
  els.modalBody.innerHTML = '';
  document.body.classList.remove('modal-open');
  state.lastFocusedElement?.focus?.();
  state.lastFocusedElement = null;
}
