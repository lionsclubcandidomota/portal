import { state, els, closeModal } from './core.js';

export function applyBrand() {
  const settings = state.data?.settings || {};
  if (settings.clubName) {
    const clubName = String(settings.clubName).replace(/\s*-\s*Distrito\s+LB\s*1/i, '').trim();
    els.clubName.textContent = clubName || settings.clubName;
  }
  if (settings.primaryColor) document.documentElement.style.setProperty('--primary', settings.primaryColor);
  if (settings.accentColor) document.documentElement.style.setProperty('--accent', settings.accentColor);
}

export function updateClock() {
  const now = new Date();
  els.clock.textContent = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now);
  els.clock.dateTime = now.toISOString();
  els.currentDate.textContent = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(now);
}

export function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  els.themeToggle.setAttribute('aria-pressed', String(dark));
  els.themeToggle.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
  els.themeIcon.textContent = dark ? '☀' : '☾';
  els.themeLabel.textContent = dark ? 'Claro' : 'Escuro';
}

function isMobileShell() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function syncSidebarState() {
  const desktopCollapsed = state.sidebarCollapsed && !isMobileShell();
  els.appShell?.classList.toggle('sidebar-collapsed', desktopCollapsed);
  els.sidebar.classList.toggle('collapsed', desktopCollapsed);
  els.menuBtn.setAttribute(
    'aria-expanded',
    isMobileShell() ? String(els.sidebar.classList.contains('open')) : String(!state.sidebarCollapsed)
  );
  els.menuBtn.setAttribute(
    'aria-label',
    isMobileShell() ? 'Abrir menu' : (state.sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral')
  );
  document.querySelectorAll('#mainNav .nav-item').forEach(button => {
    const label = button.querySelector('span:last-child')?.textContent?.trim() || '';
    if (desktopCollapsed && label) button.setAttribute('title', label);
    else button.removeAttribute('title');
  });
}

function toggleDesktopSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  localStorage.setItem('lions.public.sidebarCollapsed', String(state.sidebarCollapsed));
  syncSidebarState();
}

export function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.overlay.classList.remove('show');
  syncSidebarState();
}

export function bindShell() {
  state.sidebarCollapsed = localStorage.getItem('lions.public.sidebarCollapsed') === 'true';
  syncSidebarState();

  els.menuBtn.addEventListener('click', () => {
    if (isMobileShell()) {
      const open = !els.sidebar.classList.contains('open');
      els.sidebar.classList.toggle('open', open);
      els.overlay.classList.toggle('show', open);
      els.menuBtn.setAttribute('aria-expanded', String(open));
      return;
    }
    toggleDesktopSidebar();
  });

  els.overlay.addEventListener('click', closeSidebar);
  els.themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('lions.public.theme', next);
    applyTheme(next);
  });

  document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
      closeSidebar();
    }
  });
  window.addEventListener('resize', () => {
    if (!isMobileShell()) closeSidebar();
    syncSidebarState();
  });
}
