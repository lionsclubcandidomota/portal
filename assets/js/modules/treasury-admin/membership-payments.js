import { escapeHtml, formatDate, money, toInputDate, uid } from '../../utils.js';
import { allocateMembershipPayment } from './domain.js';
import { uiIcon } from '../visual-helpers.js?v=6.52.3';

export function createMembershipPaymentManager(context, memberSelectorCard) {
  const {
    state,
    treasury,
    modalBody,
    showModal,
    persist,
    renderTreasuryView,
    closeModal,
    toast,
    avatar,
    confirmation
  } = context;

  const openMembershipPayment = (memberId, referenceMonth) => {
    const currentState = state();
    const member = currentState.birthdays.find(item => item.id === memberId);
    if (!member) return;

    const group = treasury.familyGroupForMember(memberId);
    const groupMembers = group
      ? (group.memberIds || [])
        .map(id => currentState.birthdays.find(item => item.id === id))
        .filter(item => item && treasury.memberIsActive(item))
      : [member].filter(treasury.memberIsActive);
    const groupPrimaryId = group?.primaryMemberId || groupMembers[0]?.id || member.id;
    const today = toInputDate(new Date());
    const defaultReference = /^\d{4}-\d{2}$/.test(referenceMonth || '') ? referenceMonth : today.slice(0, 7);
    const individualFee = treasury.membershipFeeForMonth(defaultReference);
    const familyPrimary = treasury.membershipFamilyPrimaryFeeForMonth(defaultReference);
    const familyAdditional = treasury.membershipFamilyAdditionalFeeForMonth(defaultReference);
    const referenceYear = Number(defaultReference.slice(0, 4));
    const initialIds = groupMembers.map(item => item.id);
    const storedNotes = group ? String(group.notes || '') : String(member.membershipNotes || '');
    const openingDebtOutstanding = treasury.membershipOpeningDebtOutstanding(member.id);
    const activeAccounts = treasury.accounts().filter(account => account.active !== false);
    const defaultMembershipAccount = treasury.membershipDefaultAccount?.() || activeAccounts[0] || null;

    const expectedFor = (id, month = '') => month
      ? treasury.membershipExpectedAmountForMemberMonth(id, month)
      : treasury.membershipExpectedAmountForMember(id);
    const monthState = (ids, month) => {
      const activeIds = ids.length ? ids : initialIds;
      const paidCount = activeIds.filter(id => treasury.monthIsPaid(id, month)).length;
      const partialCount = activeIds.filter(id => treasury.monthIsPartial(id, month)).length;
      const outstanding = activeIds.reduce((sum, id) => sum + treasury.membershipOutstandingForMonth(id, month), 0);
      return {
        allPaid: activeIds.length > 0 && paidCount === activeIds.length,
        partial: partialCount > 0,
        outstanding
      };
    };

    const renderMonthChip = (year, index, selected = false, ids = initialIds) => {
      const value = `${year}-${String(index + 1).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
        .format(new Date(year, index, 1))
        .replace('.', '');
      const status = monthState(ids, value);
      const stateText = status.allPaid ? 'Pago' : status.partial ? 'Parcial' : '';
      const title = status.allPaid
        ? 'Mensalidade totalmente quitada para os associados selecionados.'
        : status.partial
          ? `Existe pagamento parcial. Saldo em aberto: ${money.format(status.outstanding)}.`
          : `Saldo em aberto: ${money.format(status.outstanding)}.`;
      return `<label class="month-select-chip ${status.allPaid ? 'is-already-paid' : status.partial ? 'is-partial' : ''}" title="${escapeHtml(title)}"><input type="checkbox" name="coveredMonths" value="${value}" ${selected && !status.allPaid ? 'checked' : ''} ${status.allPaid ? 'disabled' : ''}><span data-base-label="${escapeHtml(label)}">${escapeHtml(label)}${stateText ? `<small>${stateText}</small>` : ''}</span></label>`;
    };

    const monthChecks = Array.from({ length: 12 }, (_, index) =>
      renderMonthChip(referenceYear, index, false, initialIds)
    ).join('');

    modalBody.innerHTML = `<form id="membershipPaymentForm" class="admin-entity-form membership-payment-form-v2">
      <section class="membership-payment-hero"><div class="membership-payment-person">${avatar(member)}<div><strong>${escapeHtml(member.name)}</strong><small>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número informado'}</small>${group ? `<span class="membership-family-chip">${uiIcon('family')} ${escapeHtml(group.name)}</span>` : ''}</div></div><div class="membership-fee-highlight"><small>${group ? 'Plano familiar' : 'Mensalidade individual'}</small><strong>${group ? `${money.format(familyPrimary)} + ${money.format(familyAdditional)}` : money.format(individualFee)}</strong>${group ? '<small>Titular + adicional por integrante</small>' : ''}</div></section>
      <section class="admin-form-section membership-payment-section membership-payment-members-section"><div class="admin-form-section-heading"><span>${uiIcon('family')}</span><div><h3>Associados incluídos</h3><p>${group ? `O grupo ${escapeHtml(group.name)} foi selecionado automaticamente. Ajuste se necessário.` : 'Confirme o associado que receberá a baixa.'}</p></div></div>
        <div class="membership-payment-section-body"><div class="family-member-options family-member-options-v2 membership-payment-members">${groupMembers.map(item => memberSelectorCard(item, { checked: true })).join('')}</div></div>
      </section>
      ${openingDebtOutstanding > 0.005 ? `<section class="admin-form-section membership-payment-section membership-payment-opening-section"><div class="admin-form-section-heading"><span>${uiIcon('history')}</span><div><h3>Saldo anterior</h3><p>Este associado possui débito anterior ao início do controle. Se marcado, o recebimento abate este saldo antes das competências mensais.</p></div></div><div class="membership-payment-section-body"><label class="member-selector-card membership-opening-debt-card"><input type="checkbox" name="includeOpeningDebt" value="${escapeHtml(member.id)}" checked><span class="member-selector-copy"><strong>Abater saldo anterior</strong><small>Saldo em aberto</small><span class="membership-family-chip sensitive-money">${escapeHtml(money.format(openingDebtOutstanding))}</span></span><span class="member-selector-check" aria-hidden="true">${uiIcon('check')}</span></label></div></section>` : ''}
      <section class="admin-form-section membership-payment-section membership-payment-months-section"><div class="admin-form-section-heading"><span>${uiIcon('calendar')}</span><div><h3>Mensalidades em aberto</h3><p>Selecione as competências que poderão receber o pagamento. Meses parcialmente pagos continuam disponíveis até a quitação.</p></div></div>
        <div class="membership-payment-section-body membership-months-body"><div class="month-selection-toolbar"><label><span>Ano de referência</span><select id="membershipReferenceYear">${Array.from({ length: 7 }, (_, index) => referenceYear - 5 + index).map(year => `<option value="${year}" ${year === referenceYear ? 'selected' : ''}>${year}</option>`).join('')}</select></label><span id="selectedMonthsCount" class="selected-count" aria-live="polite">0 meses selecionados</span></div>
        <div class="month-selection-grid" id="membershipMonthsGrid">${monthChecks}</div></div>
      </section>
      <section class="admin-form-section membership-payment-section membership-payment-details-section"><div class="admin-form-section-heading"><span>${uiIcon('receipt')}</span><div><h3>Detalhes do recebimento</h3><p>Você pode quitar integralmente as competências selecionadas ou informar um valor recebido para rateio.</p></div></div>
        <div class="form-grid admin-form-section-grid">
          <div class="form-field"><label>Forma da baixa</label><select name="paymentMode" id="membershipPaymentMode"><option value="settle">Quitar saldo das mensalidades selecionadas</option><option value="allocate">Ratear um valor recebido</option></select><small>No rateio, o valor é aplicado primeiro às competências mais antigas selecionadas.</small></div>
          <div class="form-field"><label>Data da baixa</label><input name="paymentDate" type="date" value="" autocomplete="off" required><small>Informe manualmente a data efetiva do recebimento.</small></div>
          <div class="form-field"><label>Conta de recebimento</label><select name="accountId" required>${activeAccounts.map(account => `<option value="${escapeHtml(account.id)}" ${defaultMembershipAccount?.id === account.id ? 'selected' : ''}>${escapeHtml(account.name)}${account.membershipDefault === true ? ' · Padrão' : ''}</option>`).join('')}</select><small>${defaultMembershipAccount ? `Pré-selecionada conforme a conta padrão de mensalidades: ${escapeHtml(defaultMembershipAccount.name)}.` : 'Selecione a conta que receberá o valor.'}</small></div>
          <div class="form-field"><label>Valor do recebimento</label><div class="currency-input"><span>R$</span><input name="amount" type="text" inputmode="decimal" value="${treasury.currencyInputValue(0)}" readonly required></div><small id="membershipAmountHelp">Calculado pelo saldo em aberto das competências selecionadas.</small></div>
          <div class="form-field full-row"><label>Observações do ${group ? 'grupo familiar' : 'associado'}</label><textarea name="membershipNotes" rows="3" placeholder="Informações sobre cobrança, responsável, acordo ou forma de pagamento">${escapeHtml(storedNotes)}</textarea><small>Estas informações serão mantidas para as próximas baixas.</small></div>
          <div class="form-field full-row"><label>Observação desta baixa</label><textarea name="paymentNotes" rows="3" placeholder="Ex.: pagamento parcial via PIX, complemento ou detalhe específico deste recebimento"></textarea></div>
        </div>
        <div class="membership-calculation-box"><span>${uiIcon('calculator')}</span><div><small>Distribuição do recebimento</small><strong id="membershipCalculationHint">Selecione ao menos uma mensalidade em aberto</strong></div><b id="membershipCalculationTotal">${money.format(0)}</b></div>
        <div class="operation-safety-note" id="membershipAllocationPreview" role="note" hidden><span aria-hidden="true">${uiIcon('info')}</span><div><strong>Como o valor será rateado</strong><small></small></div></div>
      </section>
      <div class="operation-readiness" id="membershipPaymentReadiness" role="status" aria-live="polite"><span aria-hidden="true">○</span><strong>Selecione as mensalidades e informe a data da baixa.</strong></div><div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button><button class="btn btn-primary" id="membershipPaymentSubmit" type="submit" disabled>Revisar e registrar</button></div>
    </form>`;
    showModal('Dar baixa de mensalidade');

    const form = document.getElementById('membershipPaymentForm');
    const monthsGrid = document.getElementById('membershipMonthsGrid');
    const paymentDateInput = form.elements.paymentDate;
    const amountInput = form.elements.amount;
    const paymentModeInput = form.elements.paymentMode;
    const amountHelp = document.getElementById('membershipAmountHelp');
    const submitButton = document.getElementById('membershipPaymentSubmit');
    const readiness = document.getElementById('membershipPaymentReadiness');
    const allocationPreview = document.getElementById('membershipAllocationPreview');
    const selectedMemberIds = () => [...form.querySelectorAll('[name="memberIds"]:checked')].map(input => input.value);
    const selectedMonths = () => [...form.querySelectorAll('[name="coveredMonths"]:checked')].map(input => input.value).sort();
    const includesOpeningDebt = () => Boolean(
      form.elements.includeOpeningDebt?.checked
      && selectedMemberIds().includes(member.id)
      && treasury.membershipOpeningDebtOutstanding(member.id) > 0.005
    );

    const renderAllocationPreview = result => {
      if (!allocationPreview) return;
      const lines = [];
      if (result.openingDebtAllocation?.amount > 0.005) {
        const status = result.openingDebtAllocation.remainingAfter <= 0.005
          ? 'quitado'
          : `restam ${money.format(result.openingDebtAllocation.remainingAfter)}`;
        lines.push(`Saldo anterior · ${member.name}: ${money.format(result.openingDebtAllocation.amount)} (${status})`);
      }
      result.allocations.forEach(allocation => {
        const person = state().birthdays.find(item => item.id === allocation.memberId);
        const status = allocation.remainingAfter <= 0.005 ? 'quitada' : `restam ${money.format(allocation.remainingAfter)}`;
        lines.push(`${treasury.monthLabel(allocation.month)} · ${person?.name || 'Associado'}: ${money.format(allocation.amount)} (${status})`);
      });
      if (!lines.length) {
        allocationPreview.hidden = true;
        return;
      }
      allocationPreview.hidden = false;
      const copy = allocationPreview.querySelector('small');
      if (copy) copy.textContent = lines.join(' · ');
    };

    const updateMonthAvailability = () => {
      const ids = selectedMemberIds();
      form.querySelectorAll('[name="coveredMonths"]').forEach(input => {
        const status = monthState(ids, input.value);
        const blocked = status.allPaid;
        if (blocked) input.checked = false;
        input.disabled = blocked;
        const chip = input.closest('.month-select-chip');
        chip?.classList.toggle('is-already-paid', blocked);
        chip?.classList.toggle('is-partial', !blocked && status.partial);
        if (!chip) return;
        chip.title = blocked
          ? 'Mensalidade totalmente quitada para os associados selecionados.'
          : status.partial
            ? `Pagamento parcial. Saldo em aberto: ${money.format(status.outstanding)}.`
            : `Saldo em aberto: ${money.format(status.outstanding)}.`;
        const span = chip.querySelector('span');
        if (span) {
          const base = span.dataset.baseLabel || span.textContent.replace(/Pago|Parcial/g, '').trim();
          span.dataset.baseLabel = base;
          span.innerHTML = `${escapeHtml(base)}${blocked ? '<small>Pago</small>' : status.partial ? '<small>Parcial</small>' : ''}`;
        }
      });
    };

    const buildAllocation = (amountOverride = null) => {
      const ids = selectedMemberIds();
      const months = selectedMonths();
      const monthlyOutstandingTotal = ids.reduce((sum, id) => sum + months.reduce(
        (monthSum, month) => monthSum + treasury.membershipOutstandingForMonth(id, month), 0
      ), 0);
      const openingOutstanding = includesOpeningDebt()
        ? treasury.membershipOpeningDebtOutstanding(member.id)
        : 0;
      const outstandingTotal = Math.round((monthlyOutstandingTotal + openingOutstanding + Number.EPSILON) * 100) / 100;
      const mode = String(paymentModeInput.value || 'settle');
      const requestedAmount = Math.round(((amountOverride === null
        ? (mode === 'settle' ? outstandingTotal : treasury.parseCurrencyInput(amountInput.value))
        : amountOverride) + Number.EPSILON) * 100) / 100;
      const openingAmount = Math.round((Math.min(openingOutstanding, requestedAmount) + Number.EPSILON) * 100) / 100;
      const openingDebtAllocation = openingAmount > 0.005 ? {
        memberId: member.id,
        outstandingBefore: openingOutstanding,
        amount: openingAmount,
        remainingAfter: Math.round((openingOutstanding - openingAmount + Number.EPSILON) * 100) / 100
      } : null;
      const amountForMonths = Math.max(0, Math.round((requestedAmount - openingAmount + Number.EPSILON) * 100) / 100);
      const monthlyResult = allocateMembershipPayment({
        memberIds: ids,
        members: state().birthdays,
        coveredMonths: months,
        amount: amountForMonths,
        hasFamilyGroup: Boolean(group),
        groupPrimaryId,
        expectedAmountForMember: expectedFor,
        paidAmountForMemberMonth: (id, month) => treasury.membershipPaidAmountForMonth(id, month)
      });
      return {
        ...monthlyResult,
        requestedAmount,
        outstandingTotal,
        openingOutstanding,
        openingDebtAllocation,
        allocatedTotal: Math.round((openingAmount + monthlyResult.allocatedTotal + Number.EPSILON) * 100) / 100,
        unallocatedAmount: monthlyResult.unallocatedAmount
      };
    };

    const recalculate = () => {
      updateMonthAvailability();
      const ids = selectedMemberIds();
      const months = selectedMonths();
      const mode = String(paymentModeInput.value || 'settle');
      const result = buildAllocation();
      const outstandingTotal = result.outstandingTotal;
      const hasOpeningDebt = Boolean(result.openingDebtAllocation || includesOpeningDebt());
      const hasTarget = months.length > 0 || hasOpeningDebt;

      amountInput.readOnly = mode === 'settle';
      if (mode === 'settle') amountInput.value = treasury.currencyInputValue(outstandingTotal);
      amountHelp.textContent = mode === 'settle'
        ? 'Calculado pelo saldo anterior e/ou competências selecionadas.'
        : `Informe o valor efetivamente recebido. Máximo selecionado: ${money.format(outstandingTotal)}.`;

      const refreshedResult = buildAllocation();
      const amount = mode === 'settle' ? outstandingTotal : treasury.parseCurrencyInput(amountInput.value);
      const targetParts = [];
      if (includesOpeningDebt()) targetParts.push('saldo anterior');
      if (months.length) targetParts.push(`${months.length} ${months.length === 1 ? 'competência' : 'competências'}`);
      document.getElementById('membershipCalculationHint').textContent = hasTarget
        ? mode === 'settle'
          ? `${targetParts.join(' + ')} · saldo em aberto ${money.format(outstandingTotal)}`
          : `${money.format(amount)} será aplicado primeiro ao saldo anterior e depois às competências mais antigas`
        : 'Selecione saldo anterior e/ou mensalidades em aberto';
      document.getElementById('membershipCalculationTotal').textContent = money.format(refreshedResult.allocatedTotal);
      document.getElementById('selectedMonthsCount').textContent = `${months.length} ${months.length === 1 ? 'mês selecionado' : 'meses selecionados'}`;
      renderAllocationPreview(refreshedResult);

      const hasDate = Boolean(String(paymentDateInput?.value || '').trim());
      const overpaid = refreshedResult.unallocatedAmount > 0.005;
      const ready = ids.length > 0 && hasTarget && hasDate && amount > 0.005 && refreshedResult.allocatedTotal > 0.005 && !overpaid;
      if (submitButton) submitButton.disabled = !ready;
      if (readiness) {
        readiness.classList.toggle('is-ready', ready);
        readiness.querySelector('span').innerHTML = uiIcon(ready ? 'check' : 'circle');
        readiness.querySelector('strong').textContent = ready
          ? refreshedResult.allocatedTotal + 0.005 < outstandingTotal
            ? 'Pagamento parcial pronto para registro. O saldo restante continuará em aberto.'
            : 'Dados preenchidos. Os saldos alcançados pelo valor serão quitados.'
          : !hasTarget
            ? 'Selecione saldo anterior e/ou mensalidades em aberto.'
            : !hasDate
              ? 'Informe manualmente a data efetiva da baixa.'
              : amount <= 0.005
                ? 'Informe o valor efetivamente recebido.'
                : overpaid
                  ? `O valor excede o saldo selecionado em ${money.format(refreshedResult.unallocatedAmount)}.`
                  : 'Selecione ao menos um associado.';
      }
    };

    const renderMonths = (year, keepSelected = true) => {
      const current = keepSelected ? new Set(selectedMonths()) : new Set();
      const ids = selectedMemberIds();
      monthsGrid.innerHTML = Array.from({ length: 12 }, (_, index) => {
        const value = `${year}-${String(index + 1).padStart(2, '0')}`;
        return renderMonthChip(year, index, current.has(value), ids);
      }).join('');
      monthsGrid.querySelectorAll('input').forEach(input => input.addEventListener('change', recalculate));
      recalculate();
    };

    document.getElementById('membershipReferenceYear')
      .addEventListener('change', event => renderMonths(Number(event.target.value), false));
    form.querySelectorAll('[name="memberIds"]').forEach(input => { input.onchange = recalculate; });
    form.elements.includeOpeningDebt?.addEventListener('change', recalculate);
    form.querySelectorAll('[name="coveredMonths"]').forEach(input => { input.onchange = recalculate; });
    paymentDateInput?.addEventListener('change', recalculate);
    paymentDateInput?.addEventListener('input', recalculate);
    amountInput?.addEventListener('input', recalculate);
    amountInput?.addEventListener('blur', () => {
      if (paymentModeInput.value === 'allocate') amountInput.value = treasury.currencyInputValue(treasury.parseCurrencyInput(amountInput.value));
      recalculate();
    });
    paymentModeInput?.addEventListener('change', () => {
      if (paymentModeInput.value === 'allocate') amountInput.value = treasury.currencyInputValue(0);
      recalculate();
      if (paymentModeInput.value === 'allocate') amountInput.focus();
    });
    recalculate();

    form.onsubmit = async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const paymentDate = String(formData.get('paymentDate') || '').trim();
      const requestedMemberIds = formData.getAll('memberIds');
      const requestedMonths = formData.getAll('coveredMonths').sort();
      const paymentMode = String(formData.get('paymentMode') || 'settle');
      const openingSelected = Boolean(
        formData.get('includeOpeningDebt')
        && requestedMemberIds.includes(member.id)
        && treasury.membershipOpeningDebtOutstanding(member.id) > 0.005
      );
      if (!requestedMemberIds.length) {
        toast('Selecione ao menos um associado.');
        return;
      }
      if (!paymentDate) {
        toast('Informe manualmente a data efetiva da baixa.');
        paymentDateInput?.focus();
        return;
      }
      if (!requestedMonths.length && !openingSelected) {
        toast('Selecione saldo anterior e/ou mensalidades em aberto.');
        return;
      }

      const monthlyOutstanding = requestedMemberIds.reduce((sum, id) => sum + requestedMonths.reduce(
        (monthSum, month) => monthSum + treasury.membershipOutstandingForMonth(id, month), 0
      ), 0);
      const openingOutstanding = openingSelected ? treasury.membershipOpeningDebtOutstanding(member.id) : 0;
      const outstandingTotal = Math.round((monthlyOutstanding + openingOutstanding + Number.EPSILON) * 100) / 100;
      const requestedAmount = paymentMode === 'settle'
        ? outstandingTotal
        : treasury.parseCurrencyInput(formData.get('amount'));
      const openingAmount = Math.round((Math.min(openingOutstanding, requestedAmount) + Number.EPSILON) * 100) / 100;
      const openingDebtAllocation = openingAmount > 0.005 ? {
        memberId: member.id,
        outstandingBefore: openingOutstanding,
        amount: openingAmount,
        remainingAfter: Math.round((openingOutstanding - openingAmount + Number.EPSILON) * 100) / 100
      } : null;
      const amountForMonths = Math.max(0, Math.round((requestedAmount - openingAmount + Number.EPSILON) * 100) / 100);
      const monthlyResult = allocateMembershipPayment({
        memberIds: requestedMemberIds,
        members: state().birthdays,
        coveredMonths: requestedMonths,
        amount: amountForMonths,
        hasFamilyGroup: Boolean(group),
        groupPrimaryId,
        expectedAmountForMember: expectedFor,
        paidAmountForMemberMonth: (id, month) => treasury.membershipPaidAmountForMonth(id, month)
      });
      const result = {
        ...monthlyResult,
        openingDebtAllocation,
        allocatedTotal: Math.round((openingAmount + monthlyResult.allocatedTotal + Number.EPSILON) * 100) / 100,
        unallocatedAmount: monthlyResult.unallocatedAmount
      };

      if (result.allocatedTotal <= 0.005) {
        toast('Não há saldo em aberto para receber com os dados selecionados.');
        return;
      }
      if (result.unallocatedAmount > 0.005) {
        toast(`O valor informado excede o saldo selecionado em ${money.format(result.unallocatedAmount)}.`);
        return;
      }

      const allocatedMemberIds = [...new Set([
        ...(openingDebtAllocation ? [openingDebtAllocation.memberId] : []),
        ...result.memberAllocations.map(allocation => allocation.memberId)
      ])];
      const names = allocatedMemberIds
        .map(id => state().birthdays.find(item => item.id === id)?.name)
        .filter(Boolean);
      const persistentNotes = String(formData.get('membershipNotes') || '').trim();
      const paymentNotes = String(formData.get('paymentNotes') || '').trim();
      const allocatedMonths = [...new Set(result.allocations.map(allocation => allocation.month))].sort();
      const targetLabels = [];
      if (openingDebtAllocation) targetLabels.push('saldo anterior');
      if (allocatedMonths.length) targetLabels.push(allocatedMonths.map(treasury.monthLabel).join(', '));
      const hasPartial = result.allocations.some(allocation => allocation.remainingAfter > 0.005)
        || Boolean(openingDebtAllocation?.remainingAfter > 0.005);
      const approved = await confirmation.askConfirmation({
        title: hasPartial ? 'Conferir pagamento parcial' : 'Conferir baixa de mensalidade',
        icon: 'receipt',
        tone: 'warning',
        confirmText: 'Confirmar recebimento',
        message: `Registrar ${money.format(result.allocatedTotal)} em ${formatDate(paymentDate)}, aplicado em ${targetLabels.join(' + ')}, para ${names.join(', ')}?${hasPartial ? ' Parte do saldo continuará em aberto.' : ''}`
      });
      if (!approved) return;

      if (group) group.notes = persistentNotes;
      else member.membershipNotes = persistentNotes;

      const monthlyByMember = new Map(result.memberAllocations.map(allocation => [allocation.memberId, allocation]));
      const storedMemberAllocations = allocatedMemberIds.map(id => monthlyByMember.get(id) || {
        memberId: id,
        memberName: state().birthdays.find(item => item.id === id)?.name || '',
        role: group ? (id === groupPrimaryId ? 'Titular' : 'Familiar') : 'Individual',
        monthlyAmount: expectedFor(id),
        months: [],
        amount: 0,
        monthAllocations: []
      });
      const linkedMembers = allocatedMemberIds.map(id => ({
        memberId: id,
        name: state().birthdays.find(item => item.id === id)?.name || '',
        role: group ? (id === groupPrimaryId ? 'Titular' : 'Familiar') : 'Individual',
        amount: Math.round(((monthlyByMember.get(id)?.amount || 0) + (openingDebtAllocation?.memberId === id ? openingDebtAllocation.amount : 0) + Number.EPSILON) * 100) / 100
      }));

      state().treasury.push({
        id: uid('t'),
        date: paymentDate,
        paymentDate,
        description: `${openingDebtAllocation ? 'Mensalidade / saldo anterior' : 'Mensalidade'} - ${names.join(', ')}`,
        category: 'Mensalidades',
        accountId: String(formData.get('accountId')),
        entry: result.allocatedTotal,
        exit: 0,
        status: 'Recebido',
        memberId: allocatedMemberIds[0],
        memberIds: allocatedMemberIds,
        memberAllocations: storedMemberAllocations,
        membershipOpeningDebtAllocations: openingDebtAllocation ? [openingDebtAllocation] : [],
        linkedMembers,
        referenceMonth: allocatedMonths[0] || '',
        coveredMonths: allocatedMonths,
        membershipFrequency: 'custom',
        membershipPaymentMode: paymentMode,
        membershipPlan: group ? 'family' : 'individual',
        familyGroupId: group?.id || '',
        notes: [
          group ? `Pagamento conjunto: ${group.name}` : 'Pagamento registrado pelo controle de mensalidades.',
          paymentMode === 'allocate'
            ? 'Valor recebido aplicado primeiro ao saldo anterior selecionado e depois pelas mensalidades em aberto, da competência mais antiga para a mais recente.'
            : 'Quitação dos saldos selecionados.',
          openingDebtAllocation
            ? `${member.name} · saldo anterior: ${money.format(openingDebtAllocation.amount)}${openingDebtAllocation.remainingAfter > 0.005 ? ` · saldo restante ${money.format(openingDebtAllocation.remainingAfter)}` : ' · quitado'}`
            : '',
          ...result.memberAllocations.flatMap(allocation => allocation.monthAllocations.map(monthAllocation => (
            `${allocation.memberName} · ${treasury.monthLabel(monthAllocation.month)}: ${money.format(monthAllocation.amount)}${monthAllocation.remainingAfter > 0.005 ? ` · saldo restante ${money.format(monthAllocation.remainingAfter)}` : ' · quitada'}`
          ))),
          paymentNotes
        ].filter(Boolean).join('\n')
      });
      persist(hasPartial ? 'Pagamento parcial de mensalidade registrado.' : 'Mensalidade recebida.');
      closeModal();
      renderTreasuryView();
    };
  };

  return openMembershipPayment;
}
