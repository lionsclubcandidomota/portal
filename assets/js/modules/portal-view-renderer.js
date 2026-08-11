import { renderDashboard } from './dashboard.js';
import { renderNotices } from './notices.js';
import { renderBirthdays } from './birthdays.js';
import { ACCESS_CAPABILITIES } from './portal-runtime/authorization.js?v=6.46.7';

function loadingView(title, description) {
  return `<section class="card feature-loading" role="status" aria-live="polite">
    <span class="feature-loading-spinner" aria-hidden="true"></span>
    <div><strong>${title}</strong><small>${description}</small></div>
  </section>`;
}

function loadErrorView() {
  return `<section class="card empty-state" role="alert">
    <div class="empty-icon" aria-hidden="true">⚠️</div>
    <h2>Não foi possível carregar esta tela</h2>
    <p>Atualize a página e tente novamente.</p>
  </section>`;
}

export function createPortalViewRenderer(options) {
  const {
    getState,
    getRuntime,
    getNavigation,
    root,
    loadTreasuryController,
    birthdays,
    agenda,
    dashboardDependencies,
    birthdayDependencies,
    agendaDependencies,
    noticeDependencies,
    treasuryDependencies,
    renderAdmin,
    renderSettings,
    leaderDependencies = {}
  } = options;

  if (typeof getState !== 'function' || typeof getRuntime !== 'function' || typeof getNavigation !== 'function') {
    throw new TypeError('createPortalViewRenderer requer os provedores de estado, runtime e navegação.');
  }

  let agendaRenderer = null;
  let leadersRenderer = null;
  let leadersPromise = null;
  let agendaPromise = null;
  let treasuryFeature = null;
  let treasuryPromise = null;

  const loadLeadersRenderer = () => {
    if (!leadersPromise) {
      leadersPromise = import('./leaders.js?v=6.46.7')
        .then(module => {
          leadersRenderer = module.renderLeaders;
          return leadersRenderer;
        })
        .catch(error => {
          leadersPromise = null;
          throw error;
        });
    }
    return leadersPromise;
  };

  const loadAgendaRenderer = () => {
    if (!agendaPromise) {
      agendaPromise = import('./agenda.js?v=6.46.7')
        .then(module => {
          agendaRenderer = module.renderAgenda;
          return agendaRenderer;
        })
        .catch(error => {
          agendaPromise = null;
          throw error;
        });
    }
    return agendaPromise;
  };

  const loadTreasuryFeature = () => {
    if (treasuryFeature) return Promise.resolve(treasuryFeature);
    if (!treasuryPromise) {
      treasuryPromise = Promise.all([
        loadTreasuryController(),
        import('./treasury/view.js?v=6.46.7')
      ])
        .then(([treasury, module]) => {
          treasuryFeature = Object.freeze({ treasury, renderer: module.renderTreasury });
          return treasuryFeature;
        })
        .catch(error => {
          treasuryPromise = null;
          throw error;
        });
    }
    return treasuryPromise;
  };

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

  function runAgendaRenderer(renderer) {
    renderer(agenda, {
      root,
      ...agendaDependencies,
      isAdminUnlocked: () => getRuntime().can(ACCESS_CAPABILITIES.MANAGE_AGENDA)
    });
  }

  function renderAgendaView() {
    if (agendaRenderer) {
      runAgendaRenderer(agendaRenderer);
      return undefined;
    }

    root.innerHTML = loadingView('Carregando agenda', 'Preparando compromissos e calendário…');
    return loadAgendaRenderer()
      .then(renderer => {
        if (getNavigation().currentView === 'agenda') runAgendaRenderer(renderer);
      })
      .catch(error => {
        console.error('Falha ao carregar a Agenda.', error);
        if (getNavigation().currentView === 'agenda') root.innerHTML = loadErrorView();
      });
  }

  function renderNoticesView() {
    renderNotices(getState(), {
      root,
      adminUnlocked: getRuntime().adminUnlocked,
      ...noticeDependencies
    });
  }

  function runLeadersRenderer(renderer) {
    renderer(getState(), { root, ...leaderDependencies });
  }

  function renderLeadersView() {
    if (leadersRenderer) {
      runLeadersRenderer(leadersRenderer);
      return undefined;
    }
    root.innerHTML = loadingView('Carregando dirigentes', 'Preparando a diretoria do Ano Leonístico…');
    return loadLeadersRenderer()
      .then(renderer => {
        if (getNavigation().currentView === 'leaders') runLeadersRenderer(renderer);
      })
      .catch(error => {
        console.error('Falha ao carregar os Dirigentes.', error);
        if (getNavigation().currentView === 'leaders') root.innerHTML = loadErrorView();
      });
  }

  function runTreasuryRenderer(feature) {
    feature.renderer(getState(), feature.treasury, {
      root,
      adminUnlocked: getRuntime().can(ACCESS_CAPABILITIES.MANAGE_TREASURY),
      ...treasuryDependencies,
      isTreasuryView: () => getNavigation().currentView === 'treasury'
    });
  }

  function renderTreasuryView() {
    if (treasuryFeature) {
      runTreasuryRenderer(treasuryFeature);
      return undefined;
    }

    root.innerHTML = loadingView('Carregando Tesouraria', 'Preparando saldos, cobranças e movimentações…');
    return loadTreasuryFeature()
      .then(feature => {
        if (getNavigation().currentView === 'treasury') runTreasuryRenderer(feature);
      })
      .catch(error => {
        console.error('Falha ao carregar a Tesouraria.', error);
        if (getNavigation().currentView === 'treasury') root.innerHTML = loadErrorView();
      });
  }

  function render(view = getNavigation().currentView) {
    const renderers = {
      dashboard: renderDashboardView,
      birthdays: renderBirthdaysView,
      leaders: renderLeadersView,
      treasury: renderTreasuryView,
      agenda: renderAgendaView,
      notices: renderNoticesView,
      admin: renderAdmin,
      settings: renderSettings
    };
    return renderers[view]?.();
  }

  function preload(view) {
    if (view === 'agenda') return loadAgendaRenderer();
    if (view === 'leaders') return loadLeadersRenderer();
    if (view === 'treasury') return loadTreasuryFeature();
    return Promise.resolve();
  }

  return Object.freeze({
    preload,
    render,
    renderAgenda: renderAgendaView,
    renderBirthdays: renderBirthdaysView,
    renderLeaders: renderLeadersView,
    renderDashboard: renderDashboardView,
    renderNotices: renderNoticesView,
    renderTreasury: renderTreasuryView
  });
}
