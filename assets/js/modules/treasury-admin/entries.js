import { escapeHtml, normalize, uid } from '../../utils.js';
import { normalizeTreasuryEntryPayload, resolveTreasuryEntryStatus, resolveTreasuryTransferStatus } from './domain.js';
import { bindTreasuryAttachmentPicker, renderTreasuryAttachmentPicker } from './attachments.js';
import { uiIcon } from '../visual-helpers.js?v=6.49.1';
import { treasuryAccountBalanceAtDate } from '../treasury/account-balance-domain.js';
import {
  TRANSFER_CATEGORY,
  bindTreasuryMovementKindController,
  buildTreasuryEntryFormHtml
} from './entry-form-ui.js';
import {
  TREASURY_BANK_YIELD_CATEGORY,
  TREASURY_ENTRY_MODE,
  TREASURY_MOVEMENT_KIND,
  calculateBankYieldAdjustment,
  treasuryMovementKind,
  treasuryMovementLabel
} from '../treasury/movement-domain.js';
import { buildTreasuryTransferPair, resolveTransferParts, transferEntriesFor, treasuryOperationEntryIds } from '../treasury/movement-transfer-domain.js';

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

  const ensureTransferCategory = () => {
    if (!Array.isArray(state().treasuryCategories)) state().treasuryCategories = [];
    if (!state().treasuryCategories.some(category => normalize(category) === normalize(TRANSFER_CATEGORY))) {
      state().treasuryCategories.push(TRANSFER_CATEGORY);
      state().treasuryCategories = [...new Set(state().treasuryCategories)]
        .filter(Boolean)
        .sort((first, second) => first.localeCompare(second, 'pt-BR'));
    }
  };

  const ensureBankYieldCategory = () => {
    if (!Array.isArray(state().treasuryCategories)) state().treasuryCategories = [];
    if (!state().treasuryCategories.some(category => normalize(category) === normalize(TREASURY_BANK_YIELD_CATEGORY))) {
      state().treasuryCategories.push(TREASURY_BANK_YIELD_CATEGORY);
      state().treasuryCategories = [...new Set(state().treasuryCategories)]
        .filter(Boolean)
        .sort((first, second) => first.localeCompare(second, 'pt-BR'));
    }
  };

  const categoryOptions = selected => `<option value="">Selecione uma categoria</option>${treasury.categories().map(category => `<option value="${escapeHtml(category)}" ${normalize(selected) === normalize(category) ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}`;

  const buildTransferFormItem = rawItem => {
    const groupId = String(rawItem?.transferGroupId || rawItem?.id || '');
    const entries = transferEntriesFor(state().treasury, groupId);
    const { source, destination } = resolveTransferParts(entries);
    const reference = source || destination || rawItem || {};
    const statusMode = treasury.isProgrammed(reference) ? 'Programado' : 'Efetivado';

    return {
      id: groupId,
      transferGroupId: groupId,
      movementKind: TREASURY_MOVEMENT_KIND.TRANSFER,
      date: source?.date || destination?.date || rawItem?.date || '',
      sourceAccountId: source?.sourceAccountId || source?.accountId || rawItem?.sourceAccountId || '',
      destinationAccountId: source?.destinationAccountId || destination?.accountId || rawItem?.destinationAccountId || '',
      transferAmount: Number(source?.transferAmount || destination?.transferAmount || source?.exit || destination?.entry || 0),
      category: String(source?.category || rawItem?.category || TRANSFER_CATEGORY),
      description: String(source?.transferLabel || rawItem?.transferLabel || source?.description || rawItem?.description || 'Transferência entre contas'),
      notes: String(source?.notes || destination?.notes || rawItem?.notes || ''),
      statusMode,
      attachments: Array.isArray(source?.attachments) ? source.attachments : []
    };
  };

  const treasuryEntryFormHtml = item => {
    ensureTransferCategory();
    ensureBankYieldCategory();
    return buildTreasuryEntryFormHtml({
      item,
      accounts: treasury.accounts(),
      categories: treasury.categories(),
      isProgrammed: treasury.isProgrammed
    });
  };

  const balanceBeforeBankYield = (accountId, date, excludeIds = []) => {
    const accountList = treasury.accounts();
    const account = accountList.find(item => String(item.id) === String(accountId || ''));
    if (!account || !date) return null;
    const excluded = new Set((excludeIds || []).map(String));
    return treasuryAccountBalanceAtDate({
      items: state().treasury.filter(item => !excluded.has(String(item.id || ''))),
      accountId: account.id,
      primaryAccountId: accountList[0]?.id || '',
      initialBalance: Number(account.initialBalance || 0),
      date,
      includeProgrammed: false,
      isProgrammed: treasury.isProgrammed
    });
  };

  const bindMovementKindController = (form, options = {}) => bindTreasuryMovementKindController(form, options);

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
    const isSystemCategory = category => ['mensalidades', 'mutuas', normalize(TRANSFER_CATEGORY), normalize(TREASURY_BANK_YIELD_CATEGORY)].includes(normalize(category));
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
      if (toggle.disabled) return;
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
        setStatus('Mensalidades, Mútuas, Transferências e Rendimentos bancários são categorias do sistema e não podem ser renomeadas.', 'is-error');
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
        setStatus('Mensalidades, Mútuas, Transferências e Rendimentos bancários são categorias do sistema e não podem ser excluídas.', 'is-error');
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

  const openTreasuryEntryForm = (idOrPreset = null) => {
    const interfaceSnapshot = captureInterfaceContext?.();
    const collection = state().treasury;
    const preset = (idOrPreset && typeof idOrPreset === 'object' && !Array.isArray(idOrPreset)) ? idOrPreset : null;
    const id = preset ? (preset.id || null) : idOrPreset;
    const rawItem = id ? collection.find(entry => entry.id === id) : (preset || {});
    if (id && !rawItem) {
      toast('Movimentação financeira não encontrada.');
      return;
    }

    const editingTransfer = Boolean(rawItem?.transferGroupId);
    const editingTransferEntries = editingTransfer ? transferEntriesFor(state().treasury, rawItem.transferGroupId) : [];
    const formItem = editingTransfer ? buildTransferFormItem(rawItem) : rawItem;

    modalBody.innerHTML = treasuryEntryFormHtml(formItem);
    const initialKind = treasuryMovementKind(formItem);
    const operationTitle = treasuryMovementLabel(initialKind).toLocaleLowerCase('pt-BR');
    showModal(`${id ? 'Editar' : 'Nova'} ${operationTitle}`);
    const form = document.getElementById('treasuryEntryForm');
    const bankYieldExcludedIds = id ? treasuryOperationEntryIds(collection, rawItem) : [];
    bindMovementKindController(form, {
      resolveAccountBalance: (accountId, date) => balanceBeforeBankYield(accountId, date, bankYieldExcludedIds)
    });
    bindInlineCategoryManager(form);
    const attachmentPicker = bindTreasuryAttachmentPicker(form, formItem.attachments || [], { toast });

    form.onsubmit = event => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"],button:not([type])');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Salvando…';
      }

      const snapshot = collection.map(entry => JSON.parse(JSON.stringify(entry)));

      try {
        ensureTransferCategory();
        const rawData = Object.fromEntries(new FormData(form).entries());
        if (String(rawData.movementKind || '') === TREASURY_MOVEMENT_KIND.ENTRY
          && String(rawData.entryMode || '') === TREASURY_ENTRY_MODE.BANK_YIELD) {
          const accountId = String(rawData.accountId || '').trim();
          const date = String(rawData.date || '').trim();
          const portalBalance = balanceBeforeBankYield(accountId, date, bankYieldExcludedIds);
          if (!Number.isFinite(Number(portalBalance))) throw new Error('Selecione a conta e informe a data do rendimento bancário.');
          const adjustment = calculateBankYieldAdjustment({
            portalBalance,
            reportedBalance: Number(rawData.bankReportedBalance || 0)
          });
          if (!adjustment.isPositive) {
            throw new Error(adjustment.amount < 0
              ? 'O saldo informado pelo banco é menor que o saldo da conta no Portal. Registre tarifas ou outros débitos separadamente.'
              : 'O saldo informado é igual ao saldo da conta no Portal; não há rendimento para registrar.');
          }
          rawData.amount = adjustment.amount.toFixed(2);
          rawData.bankBalanceBefore = adjustment.portalBalance.toFixed(2);
          rawData.bankReportedBalance = adjustment.reportedBalance.toFixed(2);
          rawData.category = TREASURY_BANK_YIELD_CATEGORY;
          rawData.statusMode = 'Efetivado';
        } else {
          delete rawData.bankBalanceBefore;
          delete rawData.bankReportedBalance;
        }
        const normalized = normalizeTreasuryEntryPayload(
          rawData,
          { defaultAccountId: treasury.accounts()[0]?.id || '', transferCategory: TRANSFER_CATEGORY }
        );
        const attachments = attachmentPicker.getAttachments();
        const kind = normalized.movementKind;
        const currentIds = id
          ? treasuryOperationEntryIds(collection, rawItem)
          : [];

        if (currentIds.length) {
          currentIds.forEach(currentId => {
            const index = collection.findIndex(entry => entry.id === currentId);
            if (index >= 0) collection.splice(index, 1);
          });
        }

        if (kind === TREASURY_MOVEMENT_KIND.TRANSFER) {
          const data = normalized.data;
          const transferGroupId = editingTransfer ? String(rawItem.transferGroupId) : uid('tt');
          const { source: existingSource, destination: existingDestination } = resolveTransferParts(editingTransferEntries);
          const transferAmount = Number(data.transferAmount || 0);
          const status = resolveTreasuryTransferStatus({
            date: data.date,
            statusMode: normalized.statusMode
          });
          const baseDescription = String(data.description || '').trim() || 'Transferência entre contas';
          const pair = buildTreasuryTransferPair({
            transferGroupId,
            sourceEntryId: existingSource?.id || '',
            destinationEntryId: existingDestination?.id || '',
            date: data.date,
            category: data.category || TRANSFER_CATEGORY,
            notes: data.notes,
            status,
            description: baseDescription,
            sourceAccountId: data.sourceAccountId,
            destinationAccountId: data.destinationAccountId,
            transferAmount,
            attachments
          }, { createId: () => uid('t') });
          collection.push(...pair);
        } else {
          const data = normalized.data;
          data.status = resolveTreasuryEntryStatus({
            date: data.date,
            entry: data.entry,
            statusMode: normalized.statusMode
          });
          data.attachments = attachmentPicker.getAttachments();
          data.movementKind = kind;
          collection.push({ id: id && !editingTransfer ? rawItem.id : uid('t'), ...data });
        }

        try {
          const operationLabel = treasuryMovementLabel(kind);
          persist(`${operationLabel} ${id ? 'atualizada' : 'adicionada'}.`);
        } catch (error) {
          collection.splice(0, collection.length, ...snapshot);
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
        collection.splice(0, collection.length, ...snapshot);
        toast(error.message || 'Não foi possível salvar a movimentação.');
      } finally {
        if (submit) {
          submit.disabled = false;
          const kind = treasuryMovementKind({ movementKind: form.elements.movementKind?.value || TREASURY_MOVEMENT_KIND.ENTRY });
          const operationLabel = treasuryMovementLabel(kind).toLocaleLowerCase('pt-BR');
          submit.textContent = `${id ? 'Salvar' : 'Adicionar'} ${operationLabel}`;
        }
      }
    };
  };

  return { treasuryEntryFormHtml, openTreasuryEntryForm };
}
