import { normalizeTreasurySection } from './treasury/section-domain.js?v=6.52.0';

/**
 * Mantém o controlador completo da Tesouraria fora do grafo inicial.
 * O estado mínimo da seção é preservado até o primeiro acesso à tela.
 */
export function createLazyTreasuryController({
  getState,
  parseLocalDate,
  normalize,
  todayStart,
  sumTreasury,
  initialSection = 'movements',
  onSectionChange = _section => {}
}) {
  let controller = null;
  let controllerPromise = null;
  let pendingSection = normalizeTreasurySection(initialSection);

  function load() {
    if (controller) return Promise.resolve(controller);
    if (!controllerPromise) {
      controllerPromise = import('./treasury/controller.js?v=6.52.0')
        .then(module => {
          controller = module.createTreasuryController({
            getState,
            parseLocalDate,
            normalize,
            todayStart,
            sumTreasury,
            initialSection: pendingSection,
            onSectionChange: section => {
              pendingSection = normalizeTreasurySection(section);
              onSectionChange(pendingSection);
            }
          });
          return controller;
        })
        .catch(error => {
          controllerPromise = null;
          throw error;
        });
    }
    return controllerPromise;
  }

  function setSection(section) {
    pendingSection = normalizeTreasurySection(section);
    onSectionChange(pendingSection);
    if (controller) controller.section = pendingSection;
    return pendingSection;
  }

  function clearCharts() {
    if (controller) controller.chartToken = null;
  }

  function reset() {
    pendingSection = 'movements';
    if (controller) controller.reset();
    else onSectionChange(pendingSection);
  }

  return Object.freeze({
    load,
    preload: load,
    peek: () => controller,
    get section() { return controller?.section || pendingSection; },
    setSection,
    clearCharts,
    reset
  });
}
