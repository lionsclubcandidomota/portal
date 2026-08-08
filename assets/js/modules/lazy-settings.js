import {
  DEFAULT_LOGO,
  applyPortalAppearance
} from './settings-appearance.js?v=6.46.4';

function loadingView() {
  return `<section class="card feature-loading" role="status" aria-live="polite">
    <span class="feature-loading-spinner" aria-hidden="true"></span>
    <div><strong>Carregando ajustes</strong><small>Preparando as preferências do portal…</small></div>
  </section>`;
}

function errorView() {
  return `<section class="card empty-state" role="alert">
    <div class="empty-icon" aria-hidden="true">⚠️</div>
    <h2>Não foi possível carregar os ajustes</h2>
    <p>Atualize a página e tente novamente.</p>
  </section>`;
}

export function createLazySettingsController(options) {
  const {
    root,
    getState,
    canWrite = () => false,
    persist,
    updateAccessUI,
    isCurrentView = () => true,
    defaultLogo = DEFAULT_LOGO
  } = options;

  if (!root) throw new TypeError('createLazySettingsController requer root.');
  if (typeof getState !== 'function') throw new TypeError('createLazySettingsController requer getState().');
  if (typeof persist !== 'function') throw new TypeError('createLazySettingsController requer persist().');

  let controller = null;
  let controllerPromise = null;

  const createController = module => module.createSettingsController({ ...options, defaultLogo });

  const load = () => {
    if (!controllerPromise) {
      controllerPromise = import('./settings.js?v=6.46.4')
        .then(module => {
          controller = createController(module);
          return controller;
        })
        .catch(error => {
          controllerPromise = null;
          throw error;
        });
    }
    return controllerPromise;
  };

  const apply = () => applyPortalAppearance({
    state: getState(),
    updateAccessUI,
    defaultLogo
  });

  const render = () => {
    if (controller) return controller.render();
    root.innerHTML = loadingView();
    return load()
      .then(instance => {
        if (isCurrentView()) instance.render();
      })
      .catch(error => {
        console.error('Falha ao carregar os ajustes.', error);
        if (isCurrentView()) root.innerHTML = errorView();
      });
  };

  const applyLogo = dataUrl => {
    if (!dataUrl || !canWrite()) return false;
    if (controller?.applyLogo) return controller.applyLogo(dataUrl);
    const snapshot = options.captureInterfaceContext?.();
    getState().settings.logo = dataUrl;
    persist('Logo atualizado.');
    apply();
    if (isCurrentView()) render();
    options.restoreInterfaceContext?.(snapshot);
    return true;
  };

  return Object.freeze({ apply, applyLogo, load, render });
}
