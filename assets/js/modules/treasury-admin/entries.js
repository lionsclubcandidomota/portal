import { escapeHtml, normalize, uid } from '../../utils.js';
import { normalizeTreasuryEntryPayload, resolveTreasuryEntryStatus } from './domain.js';
import { bindTreasuryAttachmentPicker, renderTreasuryAttachmentPicker } from './attachments.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.7';

export function createTreasuryEntryManager(context) {
  const {
    state,
    treasury,
    modalBody,
    showModal,
    confirmation,
    persist,
    renderTreasuryView,
    renderCurrentView,
    closeModal,
    toast,
    captureInterfaceContext,
    restoreInterfaceContext
  } = context;

  const categoryOptions = selected => `<option value="">Selecione uma categoria</option>${treasury.categories().map(category => `<option value="${escapeHtml(category)}" ${normalize(selected) === normalize(category) ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}`;

  const treasuryEntryFormHtml = item => {
    const value = key => escapeHtml(item[key] ?? '');
    const required = '<span class="required-mark">*</span>';
    const section = (icon, title, subtitle, content) => `<section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon(icon)}</span><div><h3>${title}</h3><p>${subtitle}</p></div></div><div class="form-grid admin-form-section-grid">${content}</div></section>`;
    const accounts = treasury.accounts();
    const statusMode = treasury.isProgrammed(item) ? 'Programado' : 'Efetivado';

    const content = section(
      'receipt',
      'Identificação da movimentação',
      'Registre somente movimentações financeiras gerais. Mensalidades e mútuas são recebidas pelos módulos próprios.',
      `<div class="form-field"><label>Data ${required}</label><input name="date" type="date" value="${value('date')}" autocomplete="off" required><small>${item?.id ? 'Confira a data antes de salvar as alterações.' : 'Preenchimento manual obrigatório para evitar movimentações na data errada.'}</small></div>
      <div class="form-field"><label>Conta ${required}</label><select name="accountId" required>${accounts.filter(account => account.active !== false || account.id === item.accountId).map(account => `<option value="${escapeHtml(account.id)}" ${(item.accountId || accounts[0]?.id) === account.id ? 'selected' : ''}>${escapeHtml(account.name)}</option>`).join('')}</select><small>A movimentação afetará o saldo desta conta.</small></div>
      <div class="form-field full-row treasury-category-form-field">
        <div class="form-field-label-row"><label for="treasuryEntryCategory">Categoria ${required}</label><button class="btn btn-ghost btn-sm inline-category-toggle" id="inlineCategoryToggle" type="button" aria-expanded="false" aria-controls="inlineCategoryManager">${uiIcon('settings')}<span>Gerenciar categorias</span></button></div>
        <select id="treasuryEntryCategory" name="category" required>${categoryOptions(item.category)}</select>
        <small>Crie ou renomeie categorias aqui, sem interromper o cadastro da movimentação.</small>
        <div class="inline-category-manager" id="inlineCategoryManager" hidden>
          <div class="inline-category-manager-heading"><div><strong>Gerenciamento rápido</strong><small>Para renomear ou excluir, selecione primeiro uma categoria acima.</small></div><button class="icon-btn inline-category-close" id="inlineCategoryClose" type="button" aria-label="Fechar gerenciamento de categorias">×</button></div>
          <div class="inline-category-editor"><label for="inlineCategoryName">Nome da categoria</label><div><input id="inlineCategoryName" type="text" maxlength="80" placeholder="Ex.: Manutenção da sede" autocomplete="off"><button class="btn btn-primary" id="inlineCategoryAdd" type="button">Adicionar</button></div></div>
          <div class="inline-category-actions"><button class="btn btn-ghost btn-sm" id="inlineCategoryRename" type="button">Renomear selecionada</button><button class="btn btn-danger-soft btn-sm" id="inlineCategoryDelete" type="button">Excluir selecionada</button></div>
          <p class="inline-category-status" id="inlineCategoryStatus" aria-live="polite"></p>
        </div>
      </div>
      <div class="form-field full-row"><label>Descrição ${required}</label><input name="description" value="${value('description')}" required placeholder="Ex.: Compra de papel, pagamento de cartório ou patrocínio de evento"></div>
      <div class="form-field"><label>Situação ${required}</label><select name="statusMode" required><option value="Programado" ${statusMode === 'Programado' ? 'selected' : ''}>Programado</option><option value="Efetivado" ${statusMode === 'Efetivado' ? 'selected' : ''}>Efetivado</option></select><small>Programado não altera o saldo. Ao efetivar, uma entrada vira “Recebido” e uma saída vira “Pago”.</small></div>`
    ) + section(
      'money',
      'Valores',
      'Preencha entrada ou saída. Evite informar os dois na mesma movimentação.',
      `<div class="form-field money-field"><label>Entrada (R$)</label><input name="entry" type="number" step="0.01" min="0" value="${value('entry') || 0}" inputmode="decimal"></div><div class="form-field money-field"><label>Saída (R$)</label><input name="exit" type="number" step="0.01" min="0" value="${value('exit') || 0}" inputmode="decimal"></div><div class="form-field full-row"><label>Observações</label><textarea name="notes" rows="4" placeholder="Ex.: forma de pagamento, fornecedor, projeto relacionado ou documento de referência">${value('notes')}</textarea></div>`
    ) + section(
      'paperclip',
      'Comprovantes e documentos',
      'Anexe recibos, notas fiscais, comprovantes ou outros documentos relacionados à movimentação.',
      `<div class="form-field full-row">${renderTreasuryAttachmentPicker(item.attachments || [])}<small>Imagens são otimizadas automaticamente antes da publicação. PDFs e documentos compatíveis são preservados para manter a legibilidade.</small></div>`
    );

    return `<form id="treasuryEntryForm" class="admin-entity-form"><div class="admin-form-intro"><span>Campos marcados com ${required} são obrigatórios.</span></div>${item?.id ? '' : `<div class="operation-safety-note" role="note"><span aria-hidden="true">${uiIcon('shield')}</span><div><strong>Data sem preenchimento automático</strong><small>Escolha conscientemente a data real da movimentação antes de concluir.</small></div></div>`}${content}<div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${item?.id ? 'Salvar movimentação' : 'Adicionar movimentação'}</button></div></form>`;
  };

  const bindInlineCategoryManager = form => {
    const select = form.elements.category;
    const panel = form.querySelector('#inlineCategoryManager');
    const toggle = form.querySelector('#inlineCategoryToggle');
    const close = form.querySelector('#inlineCategoryClose');
    const nameInput = form.querySelector('#inlineCategoryName');
    const status = form.querySelector('#inlineCategoryStatus');

    if (!select || !panel || !toggle || !nameInput) return;

    const setStatus = (message, tone = '') => {
      if (!status) return;
      status.textContent = message;
      status.className = `inline-category-status ${tone}`.trim();
    };

    const refreshSelect = selected => {
      select.innerHTML = categoryOptions(selected);
      select.value = treasury.categories().find(category => normalize(category) === normalize(selected)) || '';
    };

    const selectedCategory = () => String(select.value || '').trim();
    const requestedName = () => String(nameInput.value || '').trim();
    const isSystemCategory = category => ['mensalidades', 'mutuas'].includes(normalize(category));
    const duplicateFor = (name, original = '') => treasury.categories().find(category => (
      normalize(category) === normalize(name)
      && normalize(category) !== normalize(original)
    ));
    const sortCatalog = () => {
      state().treasuryCategories = [...new Set(state().treasuryCategories || [])]
        .filter(Boolean)
        .sort((first, second) => first.localeCompare(second, 'pt-BR'));
    };

    const openPanel = () => {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      nameInput.value = selectedCategory();
      setStatus('');
      nameInput.focus({ preventScroll: true });
    };
    const closePanel = () => {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus({ preventScroll: true });
    };

    toggle.addEventListener('click', () => panel.hidden ? openPanel() : closePanel());
    close?.addEventListener('click', closePanel);
    select.addEventListener('change', () => {
      if (!panel.hidden) nameInput.value = selectedCategory();
    });

    form.querySelector('#inlineCategoryAdd')?.addEventListener('click', () => {
      const name = requestedName();
      if (!name) {
        setStatus('Informe o nome da nova categoria.', 'is-error');
        nameInput.focus();
        return;
      }
      if (duplicateFor(name)) {
        setStatus('Já existe uma categoria com esse nome.', 'is-error');
        return;
      }

      if (!Array.isArray(state().treasuryCategories)) state().treasuryCategories = [];
      state().treasuryCategories.push(name);
      sortCatalog();
      persist('Categoria adicionada.');
      refreshSelect(name);
      nameInput.value = name;
      setStatus(`Categoria “${name}” adicionada e selecionada.`, 'is-success');
    });

    form.querySelector('#inlineCategoryRename')?.addEventListener('click', () => {
      const original = selectedCategory();
      const name = requestedName();
      if (!original) {
        setStatus('Selecione a categoria que deseja renomear.', 'is-error');
        select.focus();
        return;
      }
      if (isSystemCategory(original)) {
        setStatus('Mensalidades e Mútuas são categorias do sistema e não podem ser renomeadas.', 'is-error');
        return;
      }
      if (!name) {
        setStatus('Informe o novo nome da categoria.', 'is-error');
        nameInput.focus();
        return;
      }
      if (normalize(original) === normalize(name)) {
        setStatus('O nome informado é igual ao atual.', 'is-error');
        return;
      }
      if (duplicateFor(name, original)) {
        setStatus('Já existe uma categoria com esse nome.', 'is-error');
        return;
      }

      if (!Array.isArray(state().treasuryCategories)) state().treasuryCategories = [];
      const index = state().treasuryCategories.findIndex(category => normalize(category) === normalize(original));
      if (index >= 0) state().treasuryCategories[index] = name;
      else state().treasuryCategories.push(name);
      state().treasury.forEach(entry => {
        if (!treasury.isMembershipEntry(entry) && !treasury.isMutualEntry(entry) && normalize(entry.category) === normalize(original)) {
          entry.category = name;
        }
      });
      sortCatalog();
      persist('Categoria atualizada.');
      refreshSelect(name);
      nameInput.value = name;
      setStatus(`Categoria renomeada para “${name}”.`, 'is-success');
    });

    form.querySelector('#inlineCategoryDelete')?.addEventListener('click', async () => {
      const category = selectedCategory();
      if (!category) {
        setStatus('Selecione a categoria que deseja excluir.', 'is-error');
        select.focus();
        return;
      }
      if (isSystemCategory(category)) {
        setStatus('Mensalidades e Mútuas são categorias do sistema e não podem ser excluídas.', 'is-error');
        return;
      }
      const usageCount = state().treasury.filter(entry => (
        !treasury.isMembershipEntry(entry)
        && !treasury.isMutualEntry(entry)
        && normalize(entry.category) === normalize(category)
      )).length;
      if (usageCount) {
        setStatus(`A categoria possui ${usageCount} movimentação(ões). Renomeie-a para atualizar o histórico.`, 'is-error');
        return;
      }

      const approved = await confirmation.askConfirmation({
        title: 'Excluir categoria?',
        message: `A categoria “${category}” deixará de aparecer nas novas movimentações.`,
        icon: 'tag',
        confirmText: 'Excluir categoria',
        tone: 'danger'
      });
      if (!approved) return;

      state().treasuryCategories = (state().treasuryCategories || [])
        .filter(item => normalize(item) !== normalize(category));
      persist('Categoria excluída.');
      refreshSelect('');
      nameInput.value = '';
      setStatus(`Categoria “${category}” excluída.`, 'is-success');
    });
  };

  const openTreasuryEntryForm = (id = null) => {
    const interfaceSnapshot = captureInterfaceContext?.();
    const collection = state().treasury;
    const item = id ? collection.find(entry => entry.id === id) : {};
    if (id && !item) {
      toast('Movimentação financeira não encontrada.');
      return;
    }

    modalBody.innerHTML = treasuryEntryFormHtml(item);
    showModal(`${id ? 'Editar' : 'Nova'} movimentação financeira`);
    const form = document.getElementById('treasuryEntryForm');
    bindInlineCategoryManager(form);
    const attachmentPicker = bindTreasuryAttachmentPicker(form, item.attachments || [], { toast });

    form.onsubmit = event => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"],button:not([type])');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Salvando…';
      }

      try {
        const { data, statusMode } = normalizeTreasuryEntryPayload(
          Object.fromEntries(new FormData(form).entries()),
          { defaultAccountId: treasury.accounts()[0]?.id || '' }
        );
        data.status = resolveTreasuryEntryStatus({
          date: data.date,
          entry: data.entry,
          statusMode
        });
        data.attachments = attachmentPicker.getAttachments();

        const original = id ? JSON.parse(JSON.stringify(item)) : null;
        const created = id ? null : { id: uid('t'), ...data };
        if (id) Object.assign(item, data);
        else collection.push(created);

        try {
          persist(id ? 'Movimentação atualizada.' : 'Movimentação adicionada.');
        } catch (error) {
          if (id && original) {
            Object.keys(item).forEach(key => delete item[key]);
            Object.assign(item, original);
          } else if (created) {
            const createdIndex = collection.indexOf(created);
            if (createdIndex >= 0) collection.splice(createdIndex, 1);
          }
          if (error?.name === 'QuotaExceededError') {
            throw new Error('Não há espaço local suficiente para estes anexos. Remova um arquivo ou reduza o tamanho antes de salvar.');
          }
          throw error;
        }
        closeModal();
        if (typeof renderTreasuryView === 'function') renderTreasuryView();
        else renderCurrentView();
        restoreInterfaceContext?.(interfaceSnapshot, { restoreFocus: false });
      } catch (error) {
        toast(error.message || 'Não foi possível salvar a movimentação.');
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = id ? 'Salvar movimentação' : 'Adicionar movimentação';
        }
      }
    };
  };

  return { treasuryEntryFormHtml, openTreasuryEntryForm };
}
