import { renderTreasury } from './treasury.js?v=6.34.1';
import { renderAgenda } from './agenda.js';
import { renderDashboard } from './dashboard.js';
import { renderNotices } from './notices.js';
import { renderBirthdays } from './birthdays.js';

export function createPortalViewRenderer(options) {
  const {
    getState,
    getRuntime,
    getNavigation,
    root,
    treasury,
    birthdays,
    agenda,
    dashboardDependencies,
    birthdayDependencies,
    agendaDependencies,
    noticeDependencies,
    treasuryDependencies,
    renderAdmin,
    renderSettings
  } = options;

  if (typeof getState !== 'function' || typeof getRuntime !== 'function' || typeof getNavigation !== 'function') {
    throw new TypeError('createPortalViewRenderer requer os provedores de estado, runtime e navegação.');
  }

  function renderDashboardView() {
    const runtime = getRuntime();
    renderDashboard(getState(), {
      root,
      adminUnlocked: runtime.adminUnlocked,
      latestCommitInfo: runtime.latestCommitInfo,
      lastSyncInfo: runtime.lastSyncInfo,
      ...dashboardDependencies
    });
  }

  function renderBirthdaysView() {
    const runtime = getRuntime();
    renderBirthdays(getState(), {
      root,
      birthdays,
      adminUnlocked: runtime.adminUnlocked,
      ...birthdayDependencies
    });
  }

  function renderAgendaView() {
    renderAgenda(agenda, {
      root,
      ...agendaDependencies,
      isAdminUnlocked: getRuntime().isWriteAllowed
    });
  }

  function renderNoticesView() {
    renderNotices(getState(), {
      root,
      adminUnlocked: getRuntime().adminUnlocked,
      ...noticeDependencies
    });
  }

  function renderTreasuryView() {
    renderTreasury(getState(), treasury, {
      root,
      adminUnlocked: getRuntime().canWrite,
      ...treasuryDependencies,
      isTreasuryView: () => getNavigation().currentView === 'treasury'
    });
  }

  function render(view = getNavigation().currentView) {
    const renderers = {
      dashboard: renderDashboardView,
      birthdays: renderBirthdaysView,
      treasury: renderTreasuryView,
      agenda: renderAgendaView,
      notices: renderNoticesView,
      admin: renderAdmin,
      settings: renderSettings
    };
    renderers[view]?.();
  }

  return Object.freeze({
    render,
    renderAgenda: renderAgendaView,
    renderBirthdays: renderBirthdaysView,
    renderDashboard: renderDashboardView,
    renderNotices: renderNoticesView,
    renderTreasury: renderTreasuryView
  });
}

