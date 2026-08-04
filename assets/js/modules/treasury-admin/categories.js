import { escapeHtml, normalize } from '../../utils.js';

export function createTreasuryCategoriesManager(context) {
  const {
    state,
    treasury,
    modalBody,
    showModal,
    confirmation,
    persist,
    toast
  } = context;

  const openTreasuryCategoriesManager = (editCategory = '') => {
    const categories = treasury.categories();
    const editing = categories.find(category => normalize(category) === normalize(editCategory)) || '';
    const usageFor = category => state().treasury.filter(item =>
      !treasury.isMembershipEntry(item) && normalize(item.category) === normalize(category)
    ).length;

    modalBody.innerHTML = `<div class="treasury-catalog-manager">
      <div class="catalog-manager-heading"><div><span class="section-eyebrow">Organização financeira</span><h3>Categorias</h3><p>Gerencie as opções disponíveis para novos lançamentos.</p></div></div>
      <div class="category-manager-list">${categories.map(category => {
        const usageCount = usageFor(category);
        return `<article class="category-manager-row"><div><strong>${escapeHtml(category)}</strong><small>${usageCount ? `${usageCount} lançamento(s) vinculado(s)` : 'Ainda não utilizada'}</small></div><div class="catalog-row-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit-category="${escapeHtml(category)}">Editar</button><button class="btn btn-danger-soft btn-sm" type="button" data-remove-category="${escapeHtml(category)}" ${usageCount ? 'disabled title="Edite a categoria para atualizar os lançamentos vinculados."' : ''}>Excluir</button></div></article>`;
      }).join('')}</div>
      <form id="categoryManagerForm" class="admin-entity-form catalog-editor-form"><input type="hidden" name="originalName" value="${escapeHtml(editing)}"><section class="admin-form-section"><div class="admin-form-section-heading"><span>${editing ? '✏️' : '➕'}</span><div><h3>${editing ? 'Editar categoria' : 'Adicionar categoria'}</h3><p>Use nomes curtos e claros para facilitar filtros e gráficos.</p></div></div><div class="form-grid admin-form-section-grid"><div class="form-field full-row"><label>Nome da categoria *</label><input name="name" required value="${escapeHtml(editing)}" placeholder="Ex.: Projetos sociais"></div></div></section><div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Fechar</button>${editing ? '<button type="button" class="btn btn-ghost" id="cancelCategoryEdit">Cancelar edição</button>' : ''}<button class="btn btn-primary" type="submit">${editing ? 'Salvar categoria' : 'Adicionar categoria'}</button></div></form>
    </div>`;
    showModal('Categorias da Tesouraria');

    const form = document.getElementById('categoryManagerForm');
    form.onsubmit = event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const name = String(data.name || '').trim();
      const originalName = String(data.originalName || '').trim();
      const duplicate = treasury.categories().find(category =>
        normalize(category) === normalize(name) && normalize(category) !== normalize(originalName)
      );
      if (duplicate) {
        toast('Já existe uma categoria com esse nome.');
        return;
      }

      const catalog = state().treasuryCategories;
      if (originalName) {
        const index = catalog.findIndex(category => normalize(category) === normalize(originalName));
        if (index >= 0) catalog[index] = name;
        else catalog.push(name);
        state().treasury.forEach(item => {
          if (!treasury.isMembershipEntry(item) && normalize(item.category) === normalize(originalName)) {
            item.category = name;
          }
        });
      } else {
        catalog.push(name);
      }
      state().treasuryCategories = [...new Set(catalog)].sort((first, second) => first.localeCompare(second, 'pt-BR'));
      persist(originalName ? 'Categoria atualizada.' : 'Categoria adicionada.');
      openTreasuryCategoriesManager();
    };

    document.getElementById('cancelCategoryEdit')?.addEventListener('click', () => openTreasuryCategoriesManager());
    modalBody.querySelectorAll('[data-edit-category]').forEach(button => {
      button.onclick = () => openTreasuryCategoriesManager(button.dataset.editCategory);
    });
    modalBody.querySelectorAll('[data-remove-category]').forEach(button => {
      button.onclick = async () => {
        const category = button.dataset.removeCategory;
        if (usageFor(category)) {
          toast('Esta categoria possui lançamentos. Edite-a para atualizar o histórico.');
          return;
        }
        const approved = await confirmation.askConfirmation({
          title: 'Excluir categoria?',
          message: `A categoria “${category}” deixará de aparecer nos novos lançamentos.`,
          icon: '🏷️',
          confirmText: 'Excluir categoria',
          tone: 'danger'
        });
        if (!approved) return;
        state().treasuryCategories = state().treasuryCategories.filter(item => normalize(item) !== normalize(category));
        persist('Categoria excluída.');
        openTreasuryCategoriesManager();
      };
    });
  };

  return openTreasuryCategoriesManager;
}
