import { escapeHtml } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.13';
import { renderTreasuryAttachmentPicker } from './attachments.js';
import {
  TREASURY_MOVEMENT_KIND,
  TREASURY_TRANSFER_CATEGORY,
  treasuryMovementKind
} from '../treasury/movement-domain.js';

export const TRANSFER_CATEGORY = TREASURY_TRANSFER_CATEGORY;

function categoryOptions(categories = [], selected = '') {
  return `<option value="">Selecione uma categoria</option>${categories.map(category => `<option value="${escapeHtml(category)}" ${String(selected || '').toLocaleLowerCase('pt-BR') === String(category || '').toLocaleLowerCase('pt-BR') ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}`;
}

export function buildTreasuryEntryFormHtml({ item = {}, accounts = [], categories = [], isProgrammed = () => false } = {}) {
  const normalizedItem = item || {};
  const movementKind = treasuryMovementKind(normalizedItem);
  const amount = movementKind === TREASURY_MOVEMENT_KIND.ENTRY
    ? Number(normalizedItem.entry || normalizedItem.amount || 0)
    : movementKind === TREASURY_MOVEMENT_KIND.EXIT
      ? Number(normalizedItem.exit || normalizedItem.amount || 0)
      : Number(normalizedItem.transferAmount || 0);
  const value = key => escapeHtml(normalizedItem[key] ?? '');
  const required = '<span class="required-mark">*</span>';
  const section = (icon, title, subtitle, content) => `<section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon(icon)}</span><div><h3>${title}</h3><p>${subtitle}</p></div></div><div class="form-grid admin-form-section-grid">${content}</div></section>`;
  const statusMode = normalizedItem.statusMode || (isProgrammed(normalizedItem) ? 'Programado' : 'Efetivado');
  const selectedAccountId = normalizedItem.accountId || accounts[0]?.id || '';
  const selectedSourceId = normalizedItem.sourceAccountId || accounts[0]?.id || '';
  const selectedDestinationId = normalizedItem.destinationAccountId || accounts.find(account => account.id !== selectedSourceId)?.id || accounts[1]?.id || accounts[0]?.id || '';

  const operationOption = (kind, icon, title, description) => `<label class="treasury-operation-option ${movementKind === kind ? 'is-selected' : ''}" data-operation-option="${kind}"><input type="radio" name="movementKind" value="${kind}" ${movementKind === kind ? 'checked' : ''}><span class="treasury-operation-option-icon" aria-hidden="true">${uiIcon(icon)}</span><span class="treasury-operation-option-copy"><strong>${title}</strong><small>${description}</small></span><span class="treasury-operation-option-check" aria-hidden="true">${uiIcon('check')}</span></label>`;

  const identification = section('receipt', 'Tipo de movimentação', 'Escolha a operação primeiro. O formulário exibirá somente os campos necessários para ela.', `<div class="form-field full-row treasury-operation-picker"><div class="treasury-operation-options" role="radiogroup" aria-label="Tipo da movimentação">${operationOption(TREASURY_MOVEMENT_KIND.ENTRY, 'download', 'Entrada', 'Valor que entra em uma conta do clube.')}${operationOption(TREASURY_MOVEMENT_KIND.EXIT, 'upload', 'Saída', 'Pagamento ou despesa que reduz o saldo de uma conta.')}${operationOption(TREASURY_MOVEMENT_KIND.TRANSFER, 'transfer', 'Transferência', 'Move saldo de uma conta do clube para outra.')}</div><div class="treasury-operation-context" data-operation-context data-kind="${movementKind}"><span data-operation-context-icon aria-hidden="true">${uiIcon(movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'download' : movementKind === TREASURY_MOVEMENT_KIND.EXIT ? 'upload' : 'transfer')}</span><div><strong data-operation-context-title>${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'Registrar uma entrada' : movementKind === TREASURY_MOVEMENT_KIND.EXIT ? 'Registrar uma saída' : 'Transferir entre contas'}</strong><small data-operation-context-copy>${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'O valor será somado ao saldo da conta selecionada.' : movementKind === TREASURY_MOVEMENT_KIND.EXIT ? 'O valor será descontado do saldo da conta selecionada.' : 'O saldo total do clube não muda; apenas a distribuição entre contas.'}</small></div></div></div>
    <div class="form-field"><label>Data ${required}</label><input name="date" type="date" value="${value('date')}" autocomplete="off" required><small>${normalizedItem?.id ? 'Confira a data antes de salvar as alterações.' : 'Informe a data real da movimentação.'}</small></div>
    <div class="form-field" data-standard-only ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'hidden' : ''}><label id="treasuryAccountLabel">${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'Conta que receberá o valor' : 'Conta de onde sairá o valor'} ${required}</label><select name="accountId" ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'disabled' : 'required'}>${accounts.filter(account => account.active !== false || account.id === normalizedItem.accountId).map(account => `<option value="${escapeHtml(account.id)}" ${selectedAccountId === account.id ? 'selected' : ''}>${escapeHtml(account.name)}</option>`).join('')}</select><small id="treasuryAccountHelp">${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'A entrada será somada ao saldo desta conta.' : 'A saída será descontada do saldo desta conta.'}</small></div>
    <div class="form-field" data-transfer-only ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? '' : 'hidden'}><label>Conta de origem ${required}</label><select name="sourceAccountId" ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'required' : 'disabled'}>${accounts.filter(account => account.active !== false || account.id === normalizedItem.sourceAccountId).map(account => `<option value="${escapeHtml(account.id)}" ${selectedSourceId === account.id ? 'selected' : ''}>${escapeHtml(account.name)}</option>`).join('')}</select><small>O valor será retirado desta conta.</small></div>
    <div class="form-field" data-transfer-only ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? '' : 'hidden'}><label>Conta de destino ${required}</label><select name="destinationAccountId" ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'required' : 'disabled'}>${accounts.filter(account => account.active !== false || account.id === normalizedItem.destinationAccountId).map(account => `<option value="${escapeHtml(account.id)}" ${selectedDestinationId === account.id ? 'selected' : ''}>${escapeHtml(account.name)}</option>`).join('')}</select><small>O mesmo valor será acrescentado nesta conta.</small></div>
    <div class="form-field full-row treasury-category-form-field" data-standard-only ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'hidden' : ''}><div class="form-field-label-row"><label for="treasuryEntryCategory">Categoria ${required}</label><button class="btn btn-ghost btn-sm inline-category-toggle" id="inlineCategoryToggle" type="button" aria-expanded="false" aria-controls="inlineCategoryManager" ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'disabled' : ''}>${uiIcon('settings')}<span>Gerenciar categorias</span></button></div><select id="treasuryEntryCategory" name="category" ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'disabled' : 'required'}>${categoryOptions(categories, normalizedItem.category)}</select><small>Crie ou renomeie categorias aqui, sem interromper o cadastro da movimentação; elas também organizam os relatórios.</small><div class="inline-category-manager" id="inlineCategoryManager" hidden><div class="inline-category-manager-heading"><div><strong>Gerenciamento rápido</strong><small>Para renomear ou excluir, selecione primeiro uma categoria acima.</small></div><button class="icon-btn inline-category-close" id="inlineCategoryClose" type="button" aria-label="Fechar gerenciamento de categorias">×</button></div><div class="inline-category-editor"><label for="inlineCategoryName">Nome da categoria</label><div><input id="inlineCategoryName" type="text" maxlength="80" placeholder="Ex.: Manutenção da sede" autocomplete="off"><button class="btn btn-primary" id="inlineCategoryAdd" type="button">Adicionar</button></div></div><div class="inline-category-actions"><button class="btn btn-ghost btn-sm" id="inlineCategoryRename" type="button">Renomear selecionada</button><button class="btn btn-danger-soft btn-sm" id="inlineCategoryDelete" type="button">Excluir selecionada</button></div><p class="inline-category-status" id="inlineCategoryStatus" aria-live="polite"></p></div></div>
    <div class="form-field full-row treasury-transfer-category" data-transfer-only ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? '' : 'hidden'}><label>Categoria</label><div class="treasury-fixed-category"><span aria-hidden="true">${uiIcon('transfer')}</span><strong>${escapeHtml(TRANSFER_CATEGORY)}</strong></div><small>A categoria é definida automaticamente para não misturar transferências com receitas e despesas.</small></div>
    <div class="form-field full-row"><label>Descrição ${required}</label><input name="description" value="${value('description')}" required data-operation-description placeholder="${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'Ex.: Doação recebida, venda de convite ou reembolso' : movementKind === TREASURY_MOVEMENT_KIND.EXIT ? 'Ex.: Compra de material, conta de energia ou fornecedor' : 'Ex.: Transferência para conta de eventos'}"></div>
    <div class="form-field"><label>Situação ${required}</label><select name="statusMode" required><option value="Programado" ${statusMode === 'Programado' ? 'selected' : ''}>Programado</option><option value="Efetivado" ${statusMode === 'Efetivado' ? 'selected' : ''}>Efetivado</option></select><small id="treasuryStatusHelp">${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'Efetivado registra o valor como recebido. Programado mantém apenas a previsão.' : movementKind === TREASURY_MOVEMENT_KIND.EXIT ? 'Efetivado registra o valor como pago. Programado mantém apenas a previsão.' : 'Efetivado movimenta o saldo entre as contas. Programado mantém apenas a previsão.'}</small></div>`);

  const values = section('money', 'Valor e detalhes', 'Informe apenas o valor correspondente à operação selecionada.', `<div class="form-field money-field" data-standard-only ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'hidden' : ''}><label id="treasuryAmountLabel">${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'Valor da entrada' : 'Valor da saída'} (R$) ${required}</label><input name="amount" type="number" step="0.01" min="0" value="${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 0 : amount}" inputmode="decimal" ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'disabled' : 'required'}><small id="treasuryAmountHelp">${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'Este valor será acrescentado à conta selecionada.' : 'Este valor será descontado da conta selecionada.'}</small></div><div class="form-field money-field" data-transfer-only ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? '' : 'hidden'}><label>Valor da transferência (R$) ${required}</label><input name="transferAmount" type="number" step="0.01" min="0" value="${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? amount : 0}" inputmode="decimal" ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'required' : 'disabled'}><small>O mesmo valor sai da origem e entra no destino.</small></div><div class="form-field full-row"><label>Observações</label><textarea name="notes" rows="4" placeholder="Informações complementares, forma de pagamento ou referência do documento">${value('notes')}</textarea></div>`);
  const attachments = section('paperclip', 'Comprovantes e documentos', 'Anexe recibos, notas fiscais, comprovantes ou outros documentos relacionados à movimentação.', `<div class="form-field full-row">${renderTreasuryAttachmentPicker(normalizedItem.attachments || [])}<small>Imagens são otimizadas automaticamente antes da publicação. PDFs e documentos compatíveis são preservados para manter a legibilidade.</small></div>`);
  const initialSubmitLabel = movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? (normalizedItem?.id ? 'Salvar entrada' : 'Adicionar entrada') : movementKind === TREASURY_MOVEMENT_KIND.EXIT ? (normalizedItem?.id ? 'Salvar saída' : 'Adicionar saída') : (normalizedItem?.id ? 'Salvar transferência' : 'Adicionar transferência');

  return `<form id="treasuryEntryForm" class="admin-entity-form treasury-operation-form" data-is-editing="${normalizedItem?.id ? 'true' : 'false'}"><div class="admin-form-intro"><span>Escolha a operação e preencha somente os dados exibidos para ela. Campos marcados com ${required} são obrigatórios.</span></div>${normalizedItem?.id ? '' : `<div class="operation-safety-note" role="note"><span aria-hidden="true">${uiIcon('shield')}</span><div><strong>Data sem preenchimento automático</strong><small>Confira também a operação e a conta: esses dados definem como o saldo será alterado quando o registro for efetivado.</small></div></div>`}${identification}${values}${attachments}<div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${initialSubmitLabel}</button></div></form>`;
}

export function bindTreasuryMovementKindController(form) {
  const kindFields = [...form.querySelectorAll('[name="movementKind"]')];
  const standardGroups = form.querySelectorAll('[data-standard-only]');
  const transferGroups = form.querySelectorAll('[data-transfer-only]');
  const amountField = form.elements.amount;
  const accountField = form.elements.accountId;
  const categoryField = form.elements.category;
  const sourceAccountField = form.elements.sourceAccountId;
  const destinationAccountField = form.elements.destinationAccountId;
  const transferAmountField = form.elements.transferAmount;
  const inlineCategoryToggle = form.querySelector('#inlineCategoryToggle');
  const submitButton = form.querySelector('button[type="submit"],button:not([type])');
  const accountLabel = form.querySelector('#treasuryAccountLabel');
  const accountHelp = form.querySelector('#treasuryAccountHelp');
  const amountLabel = form.querySelector('#treasuryAmountLabel');
  const amountHelp = form.querySelector('#treasuryAmountHelp');
  const statusHelp = form.querySelector('#treasuryStatusHelp');
  const descriptionField = form.querySelector('[data-operation-description]');
  const contextBox = form.querySelector('[data-operation-context]');
  const contextIcon = form.querySelector('[data-operation-context-icon]');
  const contextTitle = form.querySelector('[data-operation-context-title]');
  const contextCopy = form.querySelector('[data-operation-context-copy]');
  const isEditing = form.dataset.isEditing === 'true';
  if (!kindFields.length) return;

  const currentKind = () => kindFields.find(field => field.checked)?.value || 'entry';
  const toggleGroup = (nodes, active) => nodes.forEach(node => { node.hidden = !active; });
  const operationCopy = {
    entry: { icon: 'download', accountLabel: 'Conta que receberá o valor', accountHelp: 'A entrada será somada ao saldo desta conta.', amountLabel: 'Valor da entrada', amountHelp: 'Este valor será acrescentado à conta selecionada.', statusHelp: 'Efetivado registra o valor como recebido. Programado mantém apenas a previsão.', contextTitle: 'Registrar uma entrada', contextCopy: 'O valor será somado ao saldo da conta selecionada.', placeholder: 'Ex.: Doação recebida, venda de convite ou reembolso', submit: isEditing ? 'Salvar entrada' : 'Adicionar entrada' },
    exit: { icon: 'upload', accountLabel: 'Conta de onde sairá o valor', accountHelp: 'A saída será descontada do saldo desta conta.', amountLabel: 'Valor da saída', amountHelp: 'Este valor será descontado da conta selecionada.', statusHelp: 'Efetivado registra o valor como pago. Programado mantém apenas a previsão.', contextTitle: 'Registrar uma saída', contextCopy: 'O valor será descontado do saldo da conta selecionada.', placeholder: 'Ex.: Compra de material, conta de energia ou fornecedor', submit: isEditing ? 'Salvar saída' : 'Adicionar saída' },
    transfer: { icon: 'transfer', statusHelp: 'Efetivado movimenta o saldo entre as contas. Programado mantém apenas a previsão.', contextTitle: 'Transferir entre contas', contextCopy: 'O saldo total do clube não muda; apenas a distribuição entre contas.', placeholder: 'Ex.: Transferência para conta de eventos', submit: isEditing ? 'Salvar transferência' : 'Adicionar transferência' }
  };

  const applyState = () => {
    const kind = currentKind();
    const isTransfer = kind === 'transfer';
    const copy = operationCopy[kind];
    toggleGroup(standardGroups, !isTransfer);
    toggleGroup(transferGroups, isTransfer);
    form.querySelectorAll('[data-operation-option]').forEach(option => option.classList.toggle('is-selected', option.dataset.operationOption === kind));
    if (accountField) { accountField.disabled = isTransfer; accountField.required = !isTransfer; }
    if (amountField) { amountField.disabled = isTransfer; amountField.required = !isTransfer; }
    if (categoryField) { categoryField.disabled = isTransfer; categoryField.required = !isTransfer; if (isTransfer) categoryField.value = TRANSFER_CATEGORY; }
    if (inlineCategoryToggle) inlineCategoryToggle.disabled = isTransfer;
    if (sourceAccountField) { sourceAccountField.disabled = !isTransfer; sourceAccountField.required = isTransfer; }
    if (destinationAccountField) { destinationAccountField.disabled = !isTransfer; destinationAccountField.required = isTransfer; }
    if (transferAmountField) { transferAmountField.disabled = !isTransfer; transferAmountField.required = isTransfer; }
    if (isTransfer && sourceAccountField && destinationAccountField && sourceAccountField.value === destinationAccountField.value) {
      const alternative = [...destinationAccountField.options].find(option => option.value !== sourceAccountField.value);
      if (alternative) destinationAccountField.value = alternative.value;
    }
    if (!isTransfer) {
      if (accountLabel) accountLabel.innerHTML = `${copy.accountLabel} <span class="required-mark">*</span>`;
      if (accountHelp) accountHelp.textContent = copy.accountHelp;
      if (amountLabel) amountLabel.innerHTML = `${copy.amountLabel} (R$) <span class="required-mark">*</span>`;
      if (amountHelp) amountHelp.textContent = copy.amountHelp;
    }
    if (statusHelp) statusHelp.textContent = copy.statusHelp;
    if (descriptionField) descriptionField.placeholder = copy.placeholder;
    if (submitButton) submitButton.textContent = copy.submit;
    if (contextBox) contextBox.dataset.kind = kind;
    if (contextIcon) contextIcon.innerHTML = uiIcon(copy.icon);
    if (contextTitle) contextTitle.textContent = copy.contextTitle;
    if (contextCopy) contextCopy.textContent = copy.contextCopy;
  };
  kindFields.forEach(field => field.addEventListener('change', applyState));
  sourceAccountField?.addEventListener('change', () => {
    if (currentKind() !== 'transfer' || !destinationAccountField || sourceAccountField.value !== destinationAccountField.value) return;
    const alternative = [...destinationAccountField.options].find(option => option.value !== sourceAccountField.value);
    if (alternative) destinationAccountField.value = alternative.value;
  });
  applyState();
}
