import { accessSnapshot, canAccessView } from './portal-runtime/authorization.js?v=6.36.0';

const DEFAULT_TITLES = {
  dashboard: 'Dashboard',
  birthdays: 'Aniversariantes',
  treasury: 'Tesouraria',
  agenda: 'Agenda',
  notices: 'Avisos',
  admin: 'Dashboard Administrativo',
  settings: 'Configurações'
};

const DEFAULT_DESCRIPTIONS = {
  dashboard: 'Visão geral e atalhos para as informações do clube',
  birthdays: 'Consulte e organize os próximos aniversários',
  treasury: 'Acompanhe entradas, saídas, saldo e categorias',
  agenda: 'Eventos e reuniões reunidos em um único calendário',
  notices: 'Comunicados importantes e histórico de publicações',
  admin: 'Indicadores gerenciais, cadastros e manutenção do portal',
  settings: 'Personalize a identidade visual do painel'
};

const DEFAULT_DESKTOP_BREAKPOINT = 900;
const SIDEBAR_STORAGE_KEY = 'lions_sidebar_collapsed';

export function createNavigationController({
  pageTitle,
  pageDescription,
  modeChip,
  sidebar,
  overlay,
  mainNav = document.getElementById('mainNav'),
  menuButton = document.getElementById('menuBtn'),
  mobileMoreButton = document.getElementById('mobileMoreBtn'),
  lockAdminButton = document.getElementById('lockAdminBtn'),
  isAdminUnlocked,
  getAccessRole = () => (isAdminUnlocked() ? 'admin' : 'visitor'),
  getAccessPolicy = () => accessSnapshot({ accessRole: getAccessRole() }),
  renderView,
  destroyViewResources,
  refreshGlobalControls,
  setTreasurySection,
  logoutAdmin,
  initialView = 'dashboard',
  titles = DEFAULT_TITLES,
  descriptions = DEFAULT_DESCRIPTIONS,
  desktopBreakpoint = DEFAULT_DESKTOP_BREAKPOINT
}) {
  if (!pageTitle) throw new TypeError('createNavigationController requer pageTitle.');
  if (!sidebar) throw new TypeError('createNavigationController requer sidebar.');
  if (!overlay) throw new TypeError('createNavigationController requer overlay.');
  if (typeof isAdminUnlocked !== 'function') throw new TypeError('createNavigationController requer isAdminUnlocked().');
  if (typeof renderView !== 'function') throw new TypeError('createNavigationController requer renderView().');

  let currentView = initialView;
  let bound = false;

  const isDesktopLayout = () => window.innerWidth > desktopBreakpoint;

  const updateMenuButtonState = () => {
    if (!menuButton) return;
    const collapsed = document.body.classList.contains('sidebar-collapsed');
    const mobileOpen = sidebar.classList.contains('open');
    menuButton.setAttribute('aria-expanded', String(isDesktopLayout() ? !collapsed : mobileOpen));
    menuButton.setAttribute(
      'aria-label',
      isDesktopLayout()
        ? (collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral')
        : (mobileOpen ? 'Fechar menu' : 'Abrir menu')
    );
  };

  const openSidebar = () => {
    sidebar.classList.add('open');
    overlay.classList.add('show');
    updateMenuButtonState();
  };

  const closeSidebar = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    updateMenuButtonState();
  };

  const toggleDesktopSidebar = () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
    updateMenuButtonState();
  };

  const currentAccessPolicy = () => {
    const policy = getAccessPolicy?.();
    return policy?.role ? policy : accessSnapshot({ accessRole: getAccessRole() });
  };

  const updateAccessUI = () => {
    const access = currentAccessPolicy();
    const directorMode = access.role === 'director';
    document.body.classList.toggle('visitor-mode', !access.authenticated);
    document.body.classList.toggle('admin-mode', access.role === 'admin');
    document.body.classList.toggle('director-mode', directorMode);
    document.body.classList.toggle('authenticated-mode', access.authenticated);

    const settingsNav = document.getElementById('settingsNav');
    const adminNav = document.getElementById('adminAccessNav');
    const adminLabel = adminNav?.querySelector('.nav-label');
    const adminIcon = adminNav?.querySelector('span:first-child');
    const treasuryNav = document.querySelectorAll('[data-view="treasury"]');
    const treasuryMobileNav = document.querySelector('[data-mobile-view="treasury"]');
    const portalRefreshButton = document.getElementById('portalRefreshButton');

    if (settingsNav) {
      settingsNav.hidden = !access.canViewSettings;
      settingsNav.style.display = access.canViewSettings ? '' : 'none';
      settingsNav.setAttribute('aria-hidden', String(!access.canViewSettings));
      settingsNav.tabIndex = access.canViewSettings ? 0 : -1;
    }
    if (portalRefreshButton) portalRefreshButton.hidden = !access.canRefresh;
    treasuryNav.forEach(item => { item.hidden = !access.canViewTreasury; });
    if (treasuryMobileNav) treasuryMobileNav.hidden = !access.canViewTreasury;
    if (lockAdminButton) {
      lockAdminButton.textContent = access.authenticated
        ? (directorMode ? '🔒 Encerrar acesso Diretoria' : '🔒 Encerrar acesso administrativo')
        : '🔐 Acesso ao painel';
    }
    if (adminLabel) adminLabel.textContent = access.authenticated
      ? (directorMode ? 'Dashboard Diretoria' : 'Dashboard Administrativo')
      : 'Acesso Administrativo';
    if (adminIcon) adminIcon.textContent = directorMode ? '👁️' : access.authenticated ? '🛠️' : '🔐';
    if (modeChip) modeChip.textContent = directorMode
      ? '● Diretoria · somente leitura'
      : access.authenticated ? '● Modo administrativo' : 'Modo visitante';

    refreshGlobalControls?.();
  };

  const setView = requestedView => {
    let view = requestedView || 'dashboard';
    const access = currentAccessPolicy();
    if (!canAccessView(access.role, view)) view = 'admin';

    currentView = view;
    destroyViewResources?.();


    document.querySelectorAll('.nav-item').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-mobile-view]').forEach(button => {
      const active = button.dataset.mobileView === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    pageTitle.textContent = titles[view] || titles.dashboard;
    if (pageDescription) pageDescription.textContent = descriptions[view] || '';

    closeSidebar();
    renderView(view);
    updateAccessUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToView = view => {
    if (view === 'treasury') {
      setTreasurySection?.('movements');
      return;
    }
    setView(view);
  };

  const handleMainNavigation = event => {
    const button = event.target.closest('[data-view]');
    if (button) navigateToView(button.dataset.view);
  };

  const bind = () => {
    if (bound) return;
    bound = true;

    mainNav?.addEventListener('click', handleMainNavigation);

    if (menuButton) {
      menuButton.addEventListener('click', () => {
        if (isDesktopLayout()) toggleDesktopSidebar();
        else if (sidebar.classList.contains('open')) closeSidebar();
        else openSidebar();
      });
    }

    overlay.addEventListener('click', closeSidebar);

    if (localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1') {
      document.body.classList.add('sidebar-collapsed');
    }
    updateMenuButtonState();

    window.addEventListener('resize', () => {
      if (isDesktopLayout()) closeSidebar();
      updateMenuButtonState();
    });

    document.querySelectorAll('[data-mobile-view]').forEach(button => {
      button.addEventListener('click', () => navigateToView(button.dataset.mobileView));
    });
    mobileMoreButton?.addEventListener('click', openSidebar);

    lockAdminButton?.addEventListener('click', () => {
      if (!currentAccessPolicy().authenticated) {
        setView('admin');
        return;
      }
      logoutAdmin?.();
    });
  };

  return {
    get currentView() {
      return currentView;
    },
    bind,
    closeSidebar,
    openSidebar,
    setView,
    updateAccessUI,
    updateMenuButtonState
  };
}
