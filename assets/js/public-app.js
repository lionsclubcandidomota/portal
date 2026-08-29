import { DATA_URL, VIEW_META, state, els } from './modules/core.js';
import { bindShell, applyBrand, updateClock, applyTheme, closeSidebar } from './modules/shell.js';
import { renderDashboard } from './modules/views/dashboard.js?v=1.1.13';
import { renderBirthdays } from './modules/views/birthdays.js';
import { renderLeaders } from './modules/views/leaders.js?v=1.1.13';
import { renderAgenda, openAppointment } from './modules/views/agenda.js';
import { renderNotices, toggleNotice } from './modules/views/notices.js';
import { shareBirthday } from './modules/birthday-share.js';

const renderers = {
  dashboard: renderDashboard,
  birthdays: renderBirthdays,
  leaders: renderLeaders,
  agenda: renderAgenda,
  notices: renderNotices
};

function render() {
  if (!state.data) return;
  (renderers[state.currentView] || renderDashboard)();
}

function setView(view, { updateHash = true } = {}) {
  const nextView = VIEW_META[view] ? view : 'dashboard';
  state.currentView = nextView;
  const [title, description] = VIEW_META[nextView];
  els.title.textContent = title;
  els.description.textContent = description;

  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === nextView;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  if (updateHash) history.replaceState(null, '', `#${nextView}`);
  closeSidebar();
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function bindGlobalActions() {
  document.addEventListener('click', event => {
    const navigation = event.target.closest('[data-view], [data-go]');
    if (navigation) {
      setView(navigation.dataset.view || navigation.dataset.go);
      return;
    }

    const appointment = event.target.closest('[data-appt]');
    if (appointment) {
      const [type, id] = appointment.dataset.appt.split(':');
      openAppointment(type, id);
      return;
    }

    const birthdayShare = event.target.closest('[data-birthday-share]');
    if (birthdayShare) {
      shareBirthday(birthdayShare.dataset.birthdayShare);
      return;
    }

    const noticeToggle = event.target.closest('[data-notice-toggle]');
    if (noticeToggle) toggleNotice(noticeToggle.dataset.noticeToggle);
  });

  window.addEventListener('hashchange', () => {
    const view = location.hash.replace(/^#\/?/, '');
    if (VIEW_META[view] && view !== state.currentView) setView(view, { updateHash: false });
  });
}

async function bootstrap() {
  bindShell();
  bindGlobalActions();
  applyTheme(localStorage.getItem('lions.public.theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  updateClock();
  setInterval(updateClock, 1000);

  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.data = payload.data;
    state.data.updatedAt = payload.updatedAt;
    applyBrand();
    const view = location.hash.replace(/^#\/?/, '');
    setView(VIEW_META[view] ? view : 'dashboard', { updateHash: false });
    document.body.classList.add('ready');
  } catch (error) {
    console.error(error);
    els.root.innerHTML = '<div class="card"><h2>Não foi possível carregar o portal</h2><p>Confira se o arquivo <strong>data/dados.json</strong> está disponível e atualize a página.</p></div>';
  }
}

bootstrap();
