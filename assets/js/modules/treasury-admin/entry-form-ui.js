import { escapeHtml } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.52.0';
import { renderTreasuryAttachmentPicker } from './attachments.js';
import {
  TREASURY_BANK_YIELD_CATEGORY,
  TREASURY_ENTRY_MODE,
  TREASURY_MOVEMENT_KIND,
  TREASURY_TRANSFER_CATEGORY,
  calculateBankYieldAdjustment,
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
  const entryMode = String(normalizedItem.entryMode || '').trim() === TREASURY_ENTRY_MODE.BANK_YIELD
    ? TREASURY_ENTRY_MODE.BANK_YIELD
    : TREASURY_ENTRY_MODE.MANUAL;
  const bankReportedBalance = Number(normalizedItem.bankReportedBalance || 0);
  const bankBalanceBefore = Number(normalizedItem.bankBalanceBefore || 0);
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

  const values = section('money', 'Valor e detalhes', 'Informe o valor manualmente ou, em rendimentos bancários, deixe o Portal calcular a diferença.', `<div class="form-field" data-entry-only ${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? '' : 'hidden'}><label for="treasuryEntryMode">Tipo da entrada ${required}</label><select id="treasuryEntryMode" name="entryMode" ${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'required' : 'disabled'}><option value="${TREASURY_ENTRY_MODE.MANUAL}" ${entryMode === TREASURY_ENTRY_MODE.MANUAL ? 'selected' : ''}>Entrada comum</option><option value="${TREASURY_ENTRY_MODE.BANK_YIELD}" ${entryMode === TREASURY_ENTRY_MODE.BANK_YIELD ? 'selected' : ''}>Rendimento bancário</option></select><small>Em rendimento bancário, informe o saldo exibido pelo banco e o Portal calcula somente a diferença positiva.</small></div><div class="form-field money-field" data-standard-only ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'hidden' : ''}><label id="treasuryAmountLabel">${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'Valor da entrada' : 'Valor da saída'} (R$) ${required}</label><input name="amount" type="number" step="0.01" min="0" value="${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 0 : amount}" inputmode="decimal" ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'disabled' : 'required'}><small id="treasuryAmountHelp">${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'Este valor será acrescentado à conta selecionada.' : 'Este valor será descontado da conta selecionada.'}</small></div><div class="form-field full-row treasury-bank-yield-calculator" data-bank-yield-only ${movementKind === TREASURY_MOVEMENT_KIND.ENTRY && entryMode === TREASURY_ENTRY_MODE.BANK_YIELD ? '' : 'hidden'}><div class="treasury-bank-yield-heading"><span aria-hidden="true">${uiIcon('trend-up')}</span><div><strong>Calcular pelo saldo do banco</strong><small>Use o saldo efetivamente apresentado pelo banco na data do rendimento.</small></div></div><div class="treasury-bank-yield-grid"><label><span>Saldo informado pelo banco (R$) ${required}</span><input name="bankReportedBalance" type="number" step="0.01" min="0" value="${bankReportedBalance || ''}" inputmode="decimal" ${movementKind === TREASURY_MOVEMENT_KIND.ENTRY && entryMode === TREASURY_ENTRY_MODE.BANK_YIELD ? 'required' : 'disabled'}></label><div class="treasury-bank-yield-summary" aria-live="polite"><span><small>Saldo no Portal</small><strong data-bank-yield-before>${bankBalanceBefore ? bankBalanceBefore.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Informe conta e data'}</strong></span><span><small>Saldo do banco</small><strong data-bank-yield-reported>${bankReportedBalance ? bankReportedBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</strong></span><span class="is-result"><small>Rendimento calculado</small><strong data-bank-yield-amount>${amount > 0 ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</strong></span></div></div><input type="hidden" name="bankBalanceBefore" value="${bankBalanceBefore || ''}"><p class="treasury-bank-yield-feedback" data-bank-yield-feedback>Informe a conta, a data e o saldo apresentado pelo banco.</p></div><div class="form-field money-field" data-transfer-only ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? '' : 'hidden'}><label>Valor da transferência (R$) ${required}</label><input name="transferAmount" type="number" step="0.01" min="0" value="${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? amount : 0}" inputmode="decimal" ${movementKind === TREASURY_MOVEMENT_KIND.TRANSFER ? 'required' : 'disabled'}><small>O mesmo valor sai da origem e entra no destino.</small></div><div class="form-field full-row"><label>Observações</label><textarea name="notes" rows="4" placeholder="Informações complementares, forma de pagamento ou referência do documento">${value('notes')}</textarea></div>`);
  const attachments = section('paperclip', 'Comprovantes e documentos', 'Anexe recibos, notas fiscais, comprovantes ou outros documentos relacionados à movimentação.', `<div class="form-field full-row">${renderTreasuryAttachmentPicker(normalizedItem.attachments || [])}<small>Imagens são otimizadas automaticamente antes da publicação. PDFs e documentos compatíveis são preservados para manter a legibilidade.</small></div>`);
  const initialSubmitLabel = movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? (normalizedItem?.id ? 'Salvar entrada' : 'Adicionar entrada') : movementKind === TREASURY_MOVEMENT_KIND.EXIT ? (normalizedItem?.id ? 'Salvar saída' : 'Adicionar saída') : (normalizedItem?.id ? 'Salvar transferência' : 'Adicionar transferência');

  return `<form id="treasuryEntryForm" class="admin-entity-form treasury-operation-form" data-is-editing="${normalizedItem?.id ? 'true' : 'false'}"><div class="admin-form-intro"><span>Escolha a operação e preencha somente os dados exibidos para ela. Campos marcados com ${required} são obrigatórios.</span></div>${normalizedItem?.id ? '' : `<div class="operation-safety-note" role="note"><span aria-hidden="true">${uiIcon('shield')}</span><div><strong>Data sem preenchimento automático</strong><small>Confira também a operação e a conta: esses dados definem como o saldo será alterado quando o registro for efetivado.</small></div></div>`}${identification}${values}${attachments}<div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${initialSubmitLabel}</button></div></form>`;
}

export function bindTreasuryMovementKindController(form, { resolveAccountBalance = () => null } = {}) {
  const kindFields = [...form.querySelectorAll('[name="movementKind"]')];
  const standardGroups = form.querySelectorAll('[data-standard-only]');
  const transferGroups = form.querySelectorAll('[data-transfer-only]');
  const entryGroups = form.querySelectorAll('[data-entry-only]');
  const bankYieldGroups = form.querySelectorAll('[data-bank-yield-only]');
  const amountField = form.elements.amount;
  const accountField = form.elements.accountId;
  const categoryField = form.elements.category;
  const sourceAccountField = form.elements.sourceAccountId;
  const destinationAccountField = form.elements.destinationAccountId;
  const transferAmountField = form.elements.transferAmount;
  const entryModeField = form.elements.entryMode;
  const bankReportedField = form.elements.bankReportedBalance;
  const bankBalanceBeforeField = form.elements.bankBalanceBefore;
  const statusModeField = form.elements.statusMode;
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
  const yieldBefore = form.querySelector('[data-bank-yield-before]');
  const yieldReported = form.querySelector('[data-bank-yield-reported]');
  const yieldAmount = form.querySelector('[data-bank-yield-amount]');
  const yieldFeedback = form.querySelector('[data-bank-yield-feedback]');
  const isEditing = form.dataset.isEditing === 'true';
  if (!kindFields.length) return;

  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const currentKind = () => kindFields.find(field => field.checked)?.value || 'entry';
  const currentEntryMode = () => entryModeField?.value || TREASURY_ENTRY_MODE.MANUAL;
  const toggleGroup = (nodes, active) => nodes.forEach(node => { node.hidden = !active; });
  const operationCopy = {
    entry: { icon: 'download', accountLabel: 'Conta que receberá o valor', accountHelp: 'A entrada será somada ao saldo desta conta.', amountLabel: 'Valor da entrada', amountHelp: 'Este valor será acrescentado à conta selecionada.', statusHelp: 'Efetivado registra o valor como recebido. Programado mantém apenas a previsão.', contextTitle: 'Registrar uma entrada', contextCopy: 'O valor será somado ao saldo da conta selecionada.', placeholder: 'Ex.: Doação recebida, venda de convite ou reembolso', submit: isEditing ? 'Salvar entrada' : 'Adicionar entrada' },
    exit: { icon: 'upload', accountLabel: 'Conta de onde sairá o valor', accountHelp: 'A saída será descontada do saldo desta conta.', amountLabel: 'Valor da saída', amountHelp: 'Este valor será descontado da conta selecionada.', statusHelp: 'Efetivado registra o valor como pago. Programado mantém apenas a previsão.', contextTitle: 'Registrar uma saída', contextCopy: 'O valor será descontado do saldo da conta selecionada.', placeholder: 'Ex.: Compra de material, conta de energia ou fornecedor', submit: isEditing ? 'Salvar saída' : 'Adicionar saída' },
    transfer: { icon: 'transfer', statusHelp: 'Efetivado movimenta o saldo entre as contas. Programado mantém apenas a previsão.', contextTitle: 'Transferir entre contas', contextCopy: 'O saldo total do clube não muda; apenas a distribuição entre contas.', placeholder: 'Ex.: Transferência para conta de eventos', submit: isEditing ? 'Salvar transferência' : 'Adicionar transferência' }
  };

  const updateBankYield = () => {
    const active = currentKind() === TREASURY_MOVEMENT_KIND.ENTRY && currentEntryMode() === TREASURY_ENTRY_MODE.BANK_YIELD;
    if (!active) {
      bankReportedField?.setCustomValidity('');
      return;
    }
    const accountId = String(accountField?.value || '').trim();
    const date = String(form.elements.date?.value || '').trim();
    const balance = accountId && date ? resolveAccountBalance(accountId, date) : null;
    const reported = Number(bankReportedField?.value || 0);
    const hasBalance = Number.isFinite(Number(balance));
    const result = hasBalance ? calculateBankYieldAdjustment({ portalBalance: balance, reportedBalance: reported }) : null;

    if (yieldBefore) yieldBefore.textContent = hasBalance ? currency.format(result.portalBalance) : 'Informe conta e data';
    if (yieldReported) yieldReported.textContent = bankReportedField?.value ? currency.format(reported) : '—';
    if (yieldAmount) yieldAmount.textContent = result?.isPositive ? currency.format(result.amount) : '—';
    if (bankBalanceBeforeField) bankBalanceBeforeField.value = hasBalance ? result.portalBalance.toFixed(2) : '';
    if (amountField) amountField.value = result?.isPositive ? result.amount.toFixed(2) : '0.00';

    let message = 'Informe a conta, a data e o saldo apresentado pelo banco.';
    let validity = '';
    if (hasBalance && bankReportedField?.value) {
      if (result.isPositive) message = `Será registrada uma entrada de ${currency.format(result.amount)} nesta conta.`;
      else {
        message = result.amount < 0
          ? `O saldo informado é ${currency.format(Math.abs(result.amount))} menor que o saldo do Portal. Verifique tarifas, débitos ou lançamentos pendentes.`
          : 'O saldo informado é igual ao saldo do Portal; não há rendimento para registrar.';
        validity = 'Para registrar rendimento bancário, o saldo informado deve ser maior que o saldo atual da conta no Portal.';
      }
    }
    bankReportedField?.setCustomValidity(validity);
    if (yieldFeedback) {
      yieldFeedback.textContent = message;
      yieldFeedback.classList.toggle('is-success', Boolean(result?.isPositive));
      yieldFeedback.classList.toggle('is-warning', Boolean(hasBalance && bankReportedField?.value && !result?.isPositive));
    }
  };

  const applyState = () => {
    const kind = currentKind();
    const isTransfer = kind === TREASURY_MOVEMENT_KIND.TRANSFER;
    const isEntry = kind === TREASURY_MOVEMENT_KIND.ENTRY;
    const isBankYield = isEntry && currentEntryMode() === TREASURY_ENTRY_MODE.BANK_YIELD;
    const copy = operationCopy[kind];
    toggleGroup(standardGroups, !isTransfer);
    toggleGroup(transferGroups, isTransfer);
    toggleGroup(entryGroups, isEntry);
    toggleGroup(bankYieldGroups, isBankYield);
    form.querySelectorAll('[data-operation-option]').forEach(option => option.classList.toggle('is-selected', option.dataset.operationOption === kind));
    if (entryModeField) { entryModeField.disabled = !isEntry; entryModeField.required = isEntry; }
    if (accountField) { accountField.disabled = isTransfer; accountField.required = !isTransfer; }
    if (amountField) { amountField.disabled = isTransfer; amountField.required = !isTransfer; amountField.readOnly = isBankYield; }
    if (categoryField) {
      categoryField.disabled = isTransfer || isBankYield;
      categoryField.required = !isTransfer && !isBankYield;
      categoryField.classList.toggle('is-locked', isBankYield);
      if (isTransfer) categoryField.value = TRANSFER_CATEGORY;
      else if (isBankYield) categoryField.value = TREASURY_BANK_YIELD_CATEGORY;
    }
    if (inlineCategoryToggle) inlineCategoryToggle.disabled = isTransfer || isBankYield;
    if (sourceAccountField) { sourceAccountField.disabled = !isTransfer; sourceAccountField.required = isTransfer; }
    if (destinationAccountField) { destinationAccountField.disabled = !isTransfer; destinationAccountField.required = isTransfer; }
    if (transferAmountField) { transferAmountField.disabled = !isTransfer; transferAmountField.required = isTransfer; }
    if (bankReportedField) { bankReportedField.disabled = !isBankYield; bankReportedField.required = isBankYield; }
    if (statusModeField) {
      const programmedOption = statusModeField.querySelector('option[value="Programado"]');
      if (programmedOption) programmedOption.disabled = isBankYield;
      if (isBankYield) statusModeField.value = 'Efetivado';
    }
    if (isTransfer && sourceAccountField && destinationAccountField && sourceAccountField.value === destinationAccountField.value) {
      const alternative = [...destinationAccountField.options].find(option => option.value !== sourceAccountField.value);
      if (alternative) destinationAccountField.value = alternative.value;
    }
    if (!isTransfer) {
      if (accountLabel) accountLabel.innerHTML = `${copy.accountLabel} <span class="required-mark">*</span>`;
      if (accountHelp) accountHelp.textContent = isBankYield ? 'O Portal compara o saldo desta conta com o saldo informado pelo banco.' : copy.accountHelp;
      if (amountLabel) amountLabel.innerHTML = `${isBankYield ? 'Rendimento calculado' : copy.amountLabel} (R$) <span class="required-mark">*</span>`;
      if (amountHelp) amountHelp.textContent = isBankYield ? 'Calculado automaticamente pela diferença positiva entre os dois saldos.' : copy.amountHelp;
    }
    if (statusHelp) statusHelp.textContent = isBankYield ? 'Rendimento bancário representa um valor já creditado pelo banco e é registrado como Efetivado.' : copy.statusHelp;
    if (descriptionField) {
      descriptionField.placeholder = isBankYield ? 'Ex.: Rendimento bancário da conta corrente' : copy.placeholder;
      if (isBankYield && !descriptionField.value.trim()) descriptionField.value = 'Rendimento bancário';
    }
    if (submitButton) submitButton.textContent = copy.submit;
    if (contextBox) contextBox.dataset.kind = kind;
    if (contextIcon) contextIcon.innerHTML = uiIcon(copy.icon);
    if (contextTitle) contextTitle.textContent = isBankYield ? 'Registrar rendimento bancário' : copy.contextTitle;
    if (contextCopy) contextCopy.textContent = isBankYield ? 'Informe o saldo apresentado pelo banco; o Portal calcula somente a diferença positiva.' : copy.contextCopy;
    updateBankYield();
  };
  kindFields.forEach(field => field.addEventListener('change', applyState));
  entryModeField?.addEventListener('change', applyState);
  accountField?.addEventListener('change', updateBankYield);
  form.elements.date?.addEventListener('change', updateBankYield);
  bankReportedField?.addEventListener('input', updateBankYield);
  sourceAccountField?.addEventListener('change', () => {
    if (currentKind() !== 'transfer' || !destinationAccountField || sourceAccountField.value !== destinationAccountField.value) return;
    const alternative = [...destinationAccountField.options].find(option => option.value !== sourceAccountField.value);
    if (alternative) destinationAccountField.value = alternative.value;
  });
  applyState();
}

