import { escapeHtml, formatDate, money, uid } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.5';

export function createMutualPaymentManager(context) {
  const {
    state,
    treasury,
    modalBody,
    showModal,
    confirmation,
    persist,
    renderTreasuryView,
    closeModal,
    toast,
    avatar
  } = context;

  const openMutualPayment = (chargeKeys = []) => {
    const requestedKeys = [...new Set((Array.isArray(chargeKeys) ? chargeKeys : [chargeKeys]).map(String).filter(Boolean))];
    const charges = requestedKeys
      .map(key => {
        const [groupId, eventId, memberId] = key.split('::');
        const resolved = treasury.mutualChargeFor(groupId, eventId, memberId);
        const member = state().birthdays.find(item => String(item.id) === String(memberId));
        if (!resolved || !member || !eventId || treasury.mutualIsPaid(groupId, memberId, eventId)) return null;
        return {
          key: treasury.mutualChargeKey(groupId, eventId, memberId),
          group: resolved.group,
          event: resolved.event,
          member,
          amount: Number(resolved.amount || 0)
        };
      })
      .filter(Boolean);

    if (!charges.length) {
      toast('Selecione ao menos uma cobrança de mútua em aberto.');
      return;
    }

    const activeAccounts = treasury.accounts().filter(account => account.active !== false);
    if (!activeAccounts.length) {
      toast('Cadastre ou ative uma conta antes de registrar o recebimento.');
      return;
    }

    const groupNames = [...new Set(charges.map(item => item.group.name))];
    const eventNames = [...new Set(charges.map(item => item.event.deceasedName))];
    const occurrenceLabel = eventNames.length === 1
      ? `Falecimento de ${eventNames[0]}`
      : `${eventNames.length} falecimentos selecionados`;
    modalBody.innerHTML = `<form id="mutualPaymentForm" class="admin-entity-form membership-payment-form-v2 mutual-payment-form">
      <section class="mutual-payment-hero"><div><span aria-hidden="true">${uiIcon('heart')}</span><div><small>Baixa de mútuas</small><strong>${escapeHtml(occurrenceLabel)}</strong><p>${groupNames.length === 1 ? escapeHtml(groupNames[0]) : `${groupNames.length} grupos selecionados`}</p></div></div><div><small>Cobranças selecionadas</small><strong>${charges.length}</strong></div></section>
      <section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon('users')}</span><div><h3>Participantes e ocorrências</h3><p>Revise cada cobrança antes de registrar os recebimentos individuais.</p></div></div>
        <div class="mutual-payment-charge-list" id="mutualPaymentChargeList">${charges.map(item => `<label class="mutual-payment-charge"><input type="checkbox" name="chargeKeys" value="${escapeHtml(item.key)}" checked>${avatar(item.member)}<span class="mutual-payment-charge-copy"><strong>${escapeHtml(item.member.name)}</strong><small>${escapeHtml(item.group.name)} · falecimento de ${escapeHtml(item.event.deceasedName)} · ${escapeHtml(formatDate(item.event.occurrenceDate))}</small></span><b class="sensitive-money">${money.format(item.amount)}</b></label>`).join('')}</div>
        <div class="mutual-payment-total"><div><small>Participantes incluídos</small><strong id="mutualPaymentCount">${charges.length}</strong></div><div><small>Total do recebimento</small><strong class="sensitive-money" id="mutualPaymentTotal">${money.format(charges.reduce((sum, item) => sum + item.amount, 0))}</strong></div></div>
      </section>
      <section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon('receipt')}</span><div><h3>Detalhes do recebimento</h3><p>A data deve representar quando o valor realmente entrou na conta.</p></div></div>
        <div class="form-grid admin-form-section-grid"><div class="form-field"><label>Data efetiva do recebimento *</label><input name="paymentDate" type="date" required value="" autocomplete="off"><small>Escolha manualmente a data da baixa.</small></div><div class="form-field"><label>Conta de entrada *</label><select name="accountId" required>${activeAccounts.map(account => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`).join('')}</select></div><div class="form-field full-row"><label>Observação desta baixa</label><textarea name="paymentNotes" rows="3" placeholder="Ex.: recebimento via PIX ou informação relevante para conferência"></textarea></div></div>
      </section>
      <div class="operation-readiness" id="mutualPaymentReadiness" role="status" aria-live="polite"><span aria-hidden="true">○</span><strong>Informe a data e mantenha ao menos um participante selecionado.</strong></div>
      <div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button><button class="btn btn-primary" id="mutualPaymentSubmit" type="submit" disabled>Revisar e registrar</button></div>
    </form>`;
    showModal('Dar baixa de mútuas');

    const form = document.getElementById('mutualPaymentForm');
    const paymentDateInput = form.elements.paymentDate;
    const submitButton = document.getElementById('mutualPaymentSubmit');
    const readiness = document.getElementById('mutualPaymentReadiness');
    const chargeMap = new Map(charges.map(item => [item.key, item]));

    const selectedCharges = () => [...form.querySelectorAll('[name="chargeKeys"]:checked')]
      .map(input => chargeMap.get(input.value))
      .filter(Boolean);

    const updateSummary = () => {
      const selected = selectedCharges();
      const total = selected.reduce((sum, item) => sum + item.amount, 0);
      document.getElementById('mutualPaymentCount').textContent = String(selected.length);
      document.getElementById('mutualPaymentTotal').textContent = money.format(total);
      const hasDate = Boolean(String(paymentDateInput?.value || '').trim());
      const ready = selected.length > 0 && hasDate;
      submitButton.disabled = !ready;
      readiness.classList.toggle('is-ready', ready);
      readiness.querySelector('span').innerHTML = uiIcon(ready ? 'check' : 'circle');
      readiness.querySelector('strong').textContent = ready
        ? 'Dados essenciais preenchidos. Revise a confirmação antes de registrar.'
        : !selected.length
          ? 'Mantenha ao menos um participante selecionado.'
          : 'Informe manualmente a data efetiva do recebimento.';
    };

    form.querySelectorAll('[name="chargeKeys"]').forEach(input => input.addEventListener('change', updateSummary));
    paymentDateInput?.addEventListener('input', updateSummary);
    paymentDateInput?.addEventListener('change', updateSummary);
    updateSummary();

    form.onsubmit = async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const paymentDate = String(formData.get('paymentDate') || '').trim();
      const accountId = String(formData.get('accountId') || '').trim();
      const selected = selectedCharges();
      if (!paymentDate) {
        toast('Informe manualmente a data efetiva do recebimento.');
        paymentDateInput?.focus();
        return;
      }
      if (!selected.length) {
        toast('Selecione ao menos um participante.');
        return;
      }

      const conflicts = treasury.mutualPaymentConflicts(selected.map(item => item.key));
      if (conflicts.length) {
        const first = selected.find(item => item.key === conflicts[0].key);
        toast(`${first?.member.name || 'Participante'} já possui a cobrança referente a ${first?.event.deceasedName || 'esta ocorrência'} registrada como paga.`);
        return;
      }

      const total = selected.reduce((sum, item) => sum + item.amount, 0);
      const approved = await confirmation.askConfirmation({
        title: 'Conferir baixa de mútuas',
        icon: 'heart',
        tone: 'warning',
        confirmText: 'Confirmar recebimentos',
        message: `Registrar ${selected.length} pagamento(s) de cobrança por falecimento, totalizando ${money.format(total)}, em ${formatDate(paymentDate)}? Cada cobrança gerará um movimento individual.`
      });
      if (!approved) return;

      const paymentNotes = String(formData.get('paymentNotes') || '').trim();
      selected.forEach(item => {
        const referenceMonth = String(item.event.occurrenceDate || '').slice(0, 7);
        state().treasury.push({
          id: uid('t'),
          date: paymentDate,
          paymentDate,
          description: `Mútua - ${item.group.name} - Falecimento de ${item.event.deceasedName} - ${item.member.name}`,
          category: 'Mútuas',
          accountId,
          entry: item.amount,
          exit: 0,
          status: 'Recebido',
          memberId: item.member.id,
          memberIds: [item.member.id],
          mutualGroupId: item.group.id,
          mutualEventId: item.event.id,
          mutualEventName: item.event.deceasedName,
          mutualMemberId: item.member.id,
          mutualChargeKey: item.key,
          mutualReferenceMonth: referenceMonth,
          mutualReferenceDate: item.event.occurrenceDate,
          referenceMonth,
          coveredMonths: referenceMonth ? [referenceMonth] : [],
          notes: [
            `Pagamento de mútua por falecimento: ${item.event.deceasedName}.`,
            `Data do falecimento: ${formatDate(item.event.occurrenceDate)}.`,
            `Grupo: ${item.group.name}.`,
            `Participante: ${item.member.name}.`,
            `Valor da cobrança: ${money.format(item.amount)}.`,
            paymentNotes
          ].filter(Boolean).join('\n')
        });
      });

      treasury.clearMutualSelection();
      persist(`${selected.length} cobrança(s) de mútua por falecimento recebida(s) e lançada(s) nos movimentos da conta.`);
      closeModal();
      renderTreasuryView();
    };
  };

  return openMutualPayment;
}
