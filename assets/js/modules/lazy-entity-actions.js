import { escapeHtml } from '../utils.js';

export function createLazyEntityActions({
  getState,
  loadTreasuryController,
  root,
  modalController,
  confirmation,
  persist,
  renderTreasuryView,
  renderCurrentView,
  closeModal,
  toast,
  isAdminUnlocked,
  setView,
  selectImage,
  avatar,
  empty
}) {
  let featurePromise = null;

  const ensureAdmin = action => {
    if (isAdminUnlocked()) return action();
    toast(document.body.classList.contains('director-mode')
      ? 'O perfil Diretoria possui acesso somente leitura.'
      : 'Desbloqueie o Painel Administrativo.');
    setView('admin');
    return undefined;
  };

  const pageToolbar = (placeholder, button, type) => `<div class="toolbar"><div class="search"><input id="searchInput" placeholder="${escapeHtml(placeholder)}" aria-label="Pesquisar"></div><div class="toolbar-group"><button class="btn btn-primary admin-only write-only" data-new="${escapeHtml(type)}" type="button">＋ ${escapeHtml(button)}</button></div></div>`;

  const rowActions = (type, id) => `<div class="actions admin-only write-only"><button class="btn btn-ghost btn-sm" data-edit="${escapeHtml(type)}" data-id="${escapeHtml(id)}" type="button">Editar</button><button class="btn btn-danger btn-sm" data-delete="${escapeHtml(type)}" data-id="${escapeHtml(id)}" type="button">Excluir</button></div>`;

  async function load() {
    if (!featurePromise) {
      featurePromise = Promise.all([
        loadTreasuryController(),
        import('./treasury-admin.js?v=6.36.0'),
        import('./entity-forms.js?v=6.36.0')
      ]).then(([treasury, treasuryAdminModule, entityFormsModule]) => {
        const treasuryAdmin = treasuryAdminModule.createTreasuryAdminController({
          getState,
          treasury,
          modalController,
          confirmation,
          persist,
          renderTreasuryView,
          renderCurrentView,
          closeModal,
          toast,
          avatar,
          empty
        });
        const entityForms = entityFormsModule.createEntityFormsController({
          getState,
          treasury,
          root,
          modalController,
          confirmation,
          persist,
          renderCurrentView,
          closeModal,
          toast,
          isAdminUnlocked,
          setView,
          openTreasuryEntryForm: treasuryAdmin.openTreasuryEntryForm,
          selectImage
        });

        return Object.freeze({ ...treasuryAdmin, ...entityForms });
      }).catch(error => {
        featurePromise = null;
        throw error;
      });
    }
    return featurePromise;
  }

  const invoke = async (method, ...args) => {
    try {
      const features = await load();
      return await features[method]?.(...args);
    } catch (error) {
      console.error(`Falha ao carregar o recurso administrativo “${method}”.`, error);
      toast('Não foi possível carregar este recurso. Atualize a página e tente novamente.');
      return undefined;
    }
  };

  const openForm = (...args) => invoke('openForm', ...args);
  const applyBirthdayPhoto = (...args) => invoke('applyBirthdayPhoto', ...args);

  const bindToolbar = draw => {
    const search = document.getElementById('searchInput');
    if (search) search.oninput = event => draw(event.target.value);
    root.querySelectorAll('[data-new]').forEach(button => {
      button.onclick = () => ensureAdmin(() => openForm(button.dataset.new));
    });
  };

  const bindRowActions = () => {
    root.querySelectorAll('[data-edit]').forEach(button => {
      button.onclick = () => ensureAdmin(() => openForm(button.dataset.edit, button.dataset.id));
    });
    root.querySelectorAll('[data-delete]').forEach(button => {
      button.onclick = () => ensureAdmin(() => invoke('deleteItem', button.dataset.delete, button.dataset.id));
    });
  };

  return Object.freeze({
    preload: load,
    applyBirthdayPhoto,
    bindRowActions,
    bindToolbar,
    ensureAdmin,
    openForm,
    pageToolbar,
    rowActions,
    openFamilyGroupsManager: (...args) => invoke('openFamilyGroupsManager', ...args),
    openMembershipPayment: (...args) => invoke('openMembershipPayment', ...args),
    openMutualGroupsManager: (...args) => invoke('openMutualGroupsManager', ...args),
    openMutualEventManager: (...args) => invoke('openMutualEventManager', ...args),
    openMutualPayment: (...args) => invoke('openMutualPayment', ...args),
    openTreasuryAccountsManager: (...args) => invoke('openTreasuryAccountsManager', ...args),
    shareMembershipCharge: (...args) => invoke('shareMembershipCharge', ...args),
    openTreasuryEntryForm: (...args) => invoke('openTreasuryEntryForm', ...args)
  });
}
