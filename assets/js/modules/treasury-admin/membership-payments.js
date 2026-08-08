import { escapeHtml, formatDate, money, toInputDate, uid } from '../../utils.js';
import { buildMemberAllocations, calculateMembershipBase } from './domain.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.4';

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
    const individualFee = treasury.membershipFee();
    const familyPrimary = treasury.membershipFamilyPrimaryFee();
    const familyAdditional = treasury.membershipFamilyAdditionalFee();
    const groupPrimaryId = group?.primaryMemberId || groupMembers[0]?.id || member.id;
    const today = toInputDate(new Date());
    const defaultReference = /^\d{4}-\d{2}$/.test(referenceMonth || '') ? referenceMonth : today.slice(0, 7);
    const referenceYear = Number(defaultReference.slice(0, 4));

    const calculateBase = selectedIds => calculateMembershipBase({
      selectedIds,
      hasFamilyGroup: Boolean(group),
      groupPrimaryId,
      individualFee,
      familyPrimaryFee: familyPrimary,
      familyAdditionalFee: familyAdditional
    });

    const initialIds = groupMembers.map(item => item.id);
    const storedNotes = group ? String(group.notes || '') : String(member.membershipNotes || '');
    const monthChecks = Array.from({ length: 12 }, (_, index) => {
      const value = `${referenceYear}-${String(index + 1).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
        .format(new Date(referenceYear, index, 1))
        .replace('.', '');
      const conflicts = initialIds.filter(id => treasury.monthIsPaid(id, value));
      const disabled = conflicts.length > 0;
      return `<label class="month-select-chip ${disabled ? 'is-already-paid' : ''}" title="${disabled ? 'Mensalidade já recebida para um ou mais associados.' : ''}"><input type="checkbox" name="coveredMonths" value="${value}"  ${disabled ? 'disabled' : ''}><span>${label}${disabled ? '<small>Pago</small>' : ''}</span></label>`;
    }).join('');

    modalBody.innerHTML = `<form id="membershipPaymentForm" class="admin-entity-form membership-payment-form-v2">
      <section class="membership-payment-hero"><div class="membership-payment-person">${avatar(member)}<div><strong>${escapeHtml(member.name)}</strong><small>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número informado'}</small>${group ? `<span class="membership-family-chip">${uiIcon('family')} ${escapeHtml(group.name)}</span>` : ''}</div></div><div class="membership-fee-highlight"><small>${group ? 'Plano familiar' : 'Mensalidade individual'}</small><strong>${group ? `${money.format(familyPrimary)} + ${money.format(familyAdditional)}` : money.format(individualFee)}</strong>${group ? '<small>Titular + adicional por integrante</small>' : ''}</div></section>
      <section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon('family')}</span><div><h3>Associados incluídos</h3><p>${group ? `O grupo ${escapeHtml(group.name)} foi selecionado automaticamente. Ajuste se necessário.` : 'Confirme o associado que receberá a baixa.'}</p></div></div>
        <div class="family-member-options family-member-options-v2 membership-payment-members">${groupMembers.map(item => memberSelectorCard(item, { checked: true })).join('')}</div>
      </section>
      <section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon('calendar')}</span><div><h3>Meses de referência</h3><p>Selecione exatamente os meses que deseja quitar. Isso facilita pagamentos antecipados ou de períodos acumulados.</p></div></div>
        <div class="month-selection-toolbar"><label><span>Ano de referência</span><select id="membershipReferenceYear">${[referenceYear - 1, referenceYear, referenceYear + 1].map(year => `<option value="${year}" ${year === referenceYear ? 'selected' : ''}>${year}</option>`).join('')}</select></label><span id="selectedMonthsCount" class="selected-count" aria-live="polite">0 meses selecionados</span></div>
        <div class="month-selection-grid" id="membershipMonthsGrid">${monthChecks}</div>
      </section>
      <section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon('receipt')}</span><div><h3>Detalhes do recebimento</h3><p>A data da baixa representa quando o valor realmente entrou na conta.</p></div></div>
        <div class="form-grid admin-form-section-grid"><div class="form-field"><label>Data da baixa</label><input name="paymentDate" type="date" value="" autocomplete="off" required><small>Informe manualmente a data efetiva do recebimento.</small></div><div class="form-field"><label>Conta de recebimento</label><select name="accountId" required>${treasury.accounts().filter(account => account.active !== false).map(account => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`).join('')}</select></div><div class="form-field"><label>Valor do recebimento</label><div class="currency-input"><span>R$</span><input name="amount" type="text" inputmode="decimal" value="${treasury.currencyInputValue(0)}" readonly required></div><small>Calculado conforme os valores configurados para titular e familiar.</small></div><div class="form-field full-row"><label>Observações do ${group ? 'grupo familiar' : 'associado'}</label><textarea name="membershipNotes" rows="3" placeholder="Informações sobre cobrança, responsável, acordo ou forma de pagamento">${escapeHtml(storedNotes)}</textarea><small>Estas informações serão mantidas para as próximas baixas.</small></div><div class="form-field full-row"><label>Observação desta baixa</label><textarea name="paymentNotes" rows="3" placeholder="Ex.: pagamento via PIX, complemento ou detalhe específico deste recebimento"></textarea></div></div>
        <div class="membership-calculation-box"><span>${uiIcon('calculator')}</span><div><small>Cálculo automático</small><strong id="membershipCalculationHint">Selecione ao menos um mês ainda pendente</strong></div><b id="membershipCalculationTotal">${money.format(0)}</b></div>
      </section>
      <div class="operation-readiness" id="membershipPaymentReadiness" role="status" aria-live="polite"><span aria-hidden="true">○</span><strong>Selecione os meses e informe a data da baixa.</strong></div><div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button><button class="btn btn-primary" id="membershipPaymentSubmit" type="submit" disabled>Revisar e registrar</button></div>
    </form>`;
    showModal('Dar baixa de mensalidade');

    const form = document.getElementById('membershipPaymentForm');
    const monthsGrid = document.getElementById('membershipMonthsGrid');
    const selectedMemberIds = () => [...form.querySelectorAll('[name="memberIds"]:checked')]
      .map(input => input.value);
    const paymentDateInput = form.elements.paymentDate;
    const submitButton = document.getElementById('membershipPaymentSubmit');
    const readiness = document.getElementById('membershipPaymentReadiness');

    const updateMonthAvailability = () => {
      const ids = selectedMemberIds();
      form.querySelectorAll('[name="coveredMonths"]').forEach(input => {
        const conflicts = ids.filter(id => treasury.monthIsPaid(id, input.value));
        const blocked = conflicts.length > 0;
        input.disabled = blocked;
        if (blocked) input.checked = false;
        const chip = input.closest('.month-select-chip');
        chip?.classList.toggle('is-already-paid', blocked);
        if (chip) {
          chip.title = blocked ? 'Mensalidade já recebida para um ou mais associados selecionados.' : '';
          const span = chip.querySelector('span');
          if (span) {
            const base = span.dataset.baseLabel || span.textContent.replace(/Pago/g, '').trim();
            span.dataset.baseLabel = base;
            span.innerHTML = `${base}${blocked ? '<small>Pago</small>' : ''}`;
          }
        }
      });
    };

    const recalculate = () => {
      updateMonthAvailability();
      const selectedIds = selectedMemberIds();
      const coveredMonths = [...form.querySelectorAll('[name="coveredMonths"]:checked')]
        .map(input => input.value)
        .sort();
      const monthCount = coveredMonths.length;
      const base = calculateBase(selectedIds);
      const total = base * monthCount;
      form.elements.amount.value = treasury.currencyInputValue(total);
      const hasPrimary = selectedIds.includes(groupPrimaryId);
      const additionalCount = Math.max(0, selectedIds.length - (hasPrimary ? 1 : 0));
      const detail = group
        ? `${hasPrimary ? `1 titular × ${money.format(familyPrimary)}` : 'Sem titular'}${additionalCount ? ` + ${additionalCount} adicional(is) × ${money.format(familyAdditional)}` : ''}`
        : `${selectedIds.length} associado(s) × ${money.format(individualFee)}`;
      document.getElementById('membershipCalculationHint').textContent = monthCount
        ? `${detail} × ${monthCount} ${monthCount === 1 ? 'mês' : 'meses'}`
        : 'Selecione ao menos um mês ainda pendente';
      document.getElementById('membershipCalculationTotal').textContent = money.format(total);
      document.getElementById('selectedMonthsCount').textContent = `${coveredMonths.length} ${coveredMonths.length === 1 ? 'mês selecionado' : 'meses selecionados'}`;
      const hasDate = Boolean(String(paymentDateInput?.value || '').trim());
      const ready = selectedIds.length > 0 && coveredMonths.length > 0 && hasDate;
      if (submitButton) submitButton.disabled = !ready;
      if (readiness) {
        readiness.classList.toggle('is-ready', ready);
        readiness.querySelector('span').innerHTML = uiIcon(ready ? 'check' : 'circle');
        readiness.querySelector('strong').textContent = ready
          ? 'Dados essenciais preenchidos. Revise a confirmação antes de registrar.'
          : !coveredMonths.length
            ? 'Selecione manualmente ao menos um mês ainda pendente.'
            : !hasDate
              ? 'Informe manualmente a data efetiva da baixa.'
              : 'Selecione ao menos um associado.';
      }
    };

    const renderMonths = (year, keepSelected = true) => {
      const current = keepSelected
        ? new Set([...form.querySelectorAll('[name="coveredMonths"]:checked')].map(input => input.value))
        : new Set();
      monthsGrid.innerHTML = Array.from({ length: 12 }, (_, index) => {
        const value = `${year}-${String(index + 1).padStart(2, '0')}`;
        const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
          .format(new Date(year, index, 1))
          .replace('.', '');
        return `<label class="month-select-chip"><input type="checkbox" name="coveredMonths" value="${value}" ${current.has(value) ? 'checked' : ''}><span data-base-label="${label}">${label}</span></label>`;
      }).join('');
      monthsGrid.querySelectorAll('input').forEach(input => input.addEventListener('change', recalculate));
      recalculate();
    };

    document.getElementById('membershipReferenceYear')
      .addEventListener('change', event => renderMonths(Number(event.target.value), false));
    form.querySelectorAll('[name="memberIds"]').forEach(input => { input.onchange = recalculate; });
    form.querySelectorAll('[name="coveredMonths"]').forEach(input => { input.onchange = recalculate; });
    paymentDateInput?.addEventListener('change', recalculate);
    paymentDateInput?.addEventListener('input', recalculate);
    recalculate();

    form.onsubmit = async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const paymentDate = String(formData.get('paymentDate') || '').trim();
      const memberIds = formData.getAll('memberIds');
      const coveredMonths = formData.getAll('coveredMonths').sort();
      if (!memberIds.length) {
        toast('Selecione ao menos um associado.');
        return;
      }
      if (!paymentDate) {
        toast('Informe manualmente a data efetiva da baixa.');
        paymentDateInput?.focus();
        return;
      }
      if (!coveredMonths.length) {
        toast('Selecione ao menos um mês de referência ainda pendente.');
        return;
      }

      const duplicatePayments = treasury.paymentConflicts(memberIds, coveredMonths);
      if (duplicatePayments.length) {
        const first = duplicatePayments[0];
        const person = state().birthdays.find(item => item.id === first.memberId);
        toast(`${person?.name || 'Associado'} já possui mensalidade recebida em ${treasury.monthLabel(first.month)}.`);
        return;
      }

      const names = memberIds
        .map(id => state().birthdays.find(item => item.id === id)?.name)
        .filter(Boolean);
      const persistentNotes = String(formData.get('membershipNotes') || '').trim();
      const paymentNotes = String(formData.get('paymentNotes') || '').trim();
      const monthsText = coveredMonths.map(treasury.monthLabel).join(', ');
      const monthCount = coveredMonths.length;
      const memberAllocations = buildMemberAllocations({
        memberIds,
        members: state().birthdays,
        coveredMonths,
        hasFamilyGroup: Boolean(group),
        groupPrimaryId,
        individualFee,
        familyPrimaryFee: familyPrimary,
        familyAdditionalFee: familyAdditional
      });
      const calculatedTotal = memberAllocations
        .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
      const approved = await confirmation.askConfirmation({
        title: 'Conferir baixa de mensalidade',
        icon: 'receipt',
        tone: 'warning',
        confirmText: 'Confirmar recebimento',
        message: `Registrar ${money.format(calculatedTotal)} em ${formatDate(paymentDate)}, referente a ${monthsText}, para ${names.join(', ')}?`
      });
      if (!approved) return;

      if (group) group.notes = persistentNotes;
      else member.membershipNotes = persistentNotes;

      state().treasury.push({
        id: uid('t'),
        date: paymentDate,
        paymentDate,
        description: `Mensalidade - ${names.join(', ')}`,
        category: 'Mensalidades',
        accountId: String(formData.get('accountId')),
        entry: calculatedTotal,
        exit: 0,
        status: 'Recebido',
        memberId: memberIds[0],
        memberIds,
        memberAllocations,
        linkedMembers: memberAllocations.map(allocation => ({
          memberId: allocation.memberId,
          name: allocation.memberName,
          role: allocation.role,
          amount: allocation.amount
        })),
        referenceMonth: coveredMonths[0],
        coveredMonths,
        membershipFrequency: 'custom',
        membershipPlan: group ? 'family' : 'individual',
        familyGroupId: group?.id || '',
        notes: [
          group ? `Pagamento conjunto: ${group.name}` : 'Pagamento registrado pelo controle de mensalidades.',
          ...memberAllocations.map(allocation => `${allocation.role}: ${allocation.memberName} — ${money.format(allocation.amount)}`),
          `Meses quitados: ${monthsText}`,
          paymentNotes
        ].filter(Boolean).join('\n')
      });
      persist('Mensalidade recebida.');
      closeModal();
      renderTreasuryView();
    };
  };

  return openMembershipPayment;
}
