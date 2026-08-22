const EMPTY_SUMMARY = Object.freeze({
  snapshots: 0,
  latestAt: '',
  diagnosticStatus: 'ok',
  errors: [],
  warnings: [],
  storageMode: ''
});

export function createLazyRecoveryCenterController(options) {
  let controllerPromise = null;
  let controller = null;

  async function load() {
    if (!controllerPromise) {
      controllerPromise = import('./recovery-center.js?v=6.46.13')
        .then(module => module.createRecoveryCenterController(options))
        .then(instance => {
          controller = instance;
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

  const initialize = async () => (await load()).initialize();
  const createAutomaticSnapshot = async options => (await load()).createAutomaticSnapshot(options);
  const createSnapshot = async options => (await load()).createSnapshot(options);
  const open = async () => (await load()).open();
  const refreshDiagnostic = () => controller?.refreshDiagnostic?.() || { ...EMPTY_SUMMARY };
  const getSummary = () => controller?.getSummary?.() || { ...EMPTY_SUMMARY };

  return Object.freeze({
    createAutomaticSnapshot,
    createSnapshot,
    getSummary,
    initialize,
    load,
    open,
    refreshDiagnostic
  });
}
