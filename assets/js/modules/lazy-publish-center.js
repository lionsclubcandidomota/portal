export function createLazyPublishCenterController(options) {
  let controllerPromise = null;
  let controller = null;
  let bindRequested = false;
  let pendingStatus = ['offline', ''];

  const shouldLoad = () => Boolean(options.getAdminUnlocked?.());

  async function load() {
    if (!controllerPromise) {
      controllerPromise = import('./publish-center.js?v=6.46.13')
        .then(module => module.createPublishCenterController(options))
        .then(instance => {
          controller = instance;
          if (bindRequested) controller.bind();
          return instance;
        })
        .catch(error => {
          controllerPromise = null;
          controller = null;
          throw error;
        });
    }
    return controllerPromise;
  }

  const runWhenAvailable = (method, args = []) => {
    if (!shouldLoad()) return;
    void load()
      .then(instance => instance[method]?.(...args))
      .catch(error => console.error('Falha ao carregar a central de publicação.', error));
  };

  const bind = () => {
    bindRequested = true;
    if (shouldLoad()) runWhenAvailable('bind');
  };

  const refresh = () => {
    if (!shouldLoad()) {
      if (options.panel) options.panel.hidden = true;
      return;
    }
    runWhenAvailable('refresh');
  };

  const setStatus = (status, message = '') => {
    pendingStatus = [status, message];
    runWhenAvailable('setStatus', pendingStatus);
  };

  return Object.freeze({
    bind,
    close: options => controller?.close?.(options),
    getStatus: () => controller?.getStatus?.() || pendingStatus[0],
    isMinimized: () => controller?.isMinimized?.() ?? true,
    load,
    open: options => runWhenAvailable('open', [options]),
    refresh,
    requestAttention: options => runWhenAvailable('requestAttention', [options]),
    setStatus,
    toggle: () => runWhenAvailable('toggle')
  });
}
