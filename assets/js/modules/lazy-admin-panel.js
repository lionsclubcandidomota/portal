function loadingHtml() {
  return `<section class="card feature-loading" role="status" aria-live="polite">
    <span class="feature-loading-spinner" aria-hidden="true"></span>
    <div><strong>Carregando área administrativa</strong><small>Preparando relatórios e ferramentas de gestão…</small></div>
  </section>`;
}

export function createLazyAdminPanelController({ root, createOptions, toast }) {
  if (!root) throw new TypeError('createLazyAdminPanelController requer root.');
  if (typeof createOptions !== 'function') {
    throw new TypeError('createLazyAdminPanelController requer createOptions().');
  }

  let controllerPromise = null;

  async function load() {
    if (!controllerPromise) {
      controllerPromise = Promise.all([
        import('./admin-panel.js?v=6.46.4'),
        import('./reports/controller.js?v=6.46.4')
      ]).then(([adminModule, reportsModule]) => {
        const options = createOptions();
        const reports = reportsModule.createReportsController({
          getState: options.getState,
          toast: options.toast
        });
        return adminModule.createAdminPanelController({ ...options, reports });
      }).catch(error => {
        controllerPromise = null;
        throw error;
      });
    }
    return controllerPromise;
  }

  async function render() {
    if (!controllerPromise) root.innerHTML = loadingHtml();
    try {
      const controller = await load();
      controller.render();
    } catch (error) {
      console.error('Falha ao carregar a área administrativa.', error);
      root.innerHTML = `<section class="card empty-state" role="alert"><div class="empty-icon" aria-hidden="true">⚠️</div><h2>Não foi possível abrir esta área</h2><p>Atualize a página e tente novamente.</p></section>`;
      toast?.('Não foi possível carregar a área administrativa.');
    }
  }

  return Object.freeze({ load, render });
}
