export function createLazyAccessManagementController(options) {
  let featurePromise = null;
  const load = () => {
    if (!featurePromise) {
      featurePromise = import('./access-management.js?v=6.46.7')
        .then(module => module.createAccessManagementController(options))
        .catch(error => {
          featurePromise = null;
          throw error;
        });
    }
    return featurePromise;
  };
  return Object.freeze({
    preload: load,
    open: async () => (await load()).open()
  });
}
