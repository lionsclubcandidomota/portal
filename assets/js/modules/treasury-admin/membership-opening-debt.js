import { escapeHtml, money } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.13';

export function createMembershipOpeningDebtManager(context) {
  const {
    state,
    treasury,
    modalBody,
    showModal,
    persist,
    renderTreasuryView,
    closeModal,
    toast,
    confirmation
  } = context;

  return memberId => {
    const member = state().birthdays.find(item => String(item?.id || '') === String(memberId || ''));
    if (!member) {
      toast('Associado não encontrado.');
      return;
    }

    const configured = treasury.membershipOpeningDebtForMember(member.id);
    const paid = treasury.membershipOpeningDebtPaidAmount(member.id);
    const outstanding = treasury.membershipOpeningDebtOutstanding(member.id);
    const storedNotes = String(member.membershipOpeningDebtNotes || '');

    modalBody.innerHTML = `<form id="membershipOpeningDebtForm" class="admin-entity-form">
      <section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon('history')}</span><div><h3>Saldo anterior de ${escapeHtml(member.name)}</h3><p>Informe somente débitos existentes antes do início do controle no portal. Não é necessário criar mensalidades retroativas.</p></div></div>
        <div class="form-grid admin-form-section-grid">
          <div class="form-field"><label>Débito original</label><div class="currency-input"><span>R$</span><input name="openingDebt" type="text" inputmode="decimal" value="${treasury.currencyInputValue(configured)}" required></div><small>Valor que já estava em aberto quando o controle começou.</small></div>
          <div class="form-field"><label>Já recebido</label><input value="${escapeHtml(money.format(paid))}" readonly tabindex="-1"><small>Calculado pelas baixas que abatam este saldo.</small></div>
          <div class="form-field"><label>Saldo atual em aberto</label><input value="${escapeHtml(money.format(outstanding))}" readonly tabindex="-1"><small>Será somado às cobranças enquanto permanecer pendente.</small></div>
          <div class="form-field full-row"><label>Observação</label><textarea name="openingDebtNotes" rows="3" placeholder="Ex.: valor trazido do controle anterior, acordo ou referência da conferência">${escapeHtml(storedNotes)}</textarea></div>
        </div>
      </section>
      <div class="operation-safety-note" role="note"><span aria-hidden="true">${uiIcon('info')}</span><div><strong>Controle separado das competências mensais</strong><small>O saldo anterior aparece na cobrança, mas não cria meses antigos artificialmente.</small></div></div>
      <div class="form-actions admin-form-actions"><button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Salvar saldo anterior</button></div>
    </form>`;
    showModal('Saldo anterior');

    const form = document.getElementById('membershipOpeningDebtForm');
    form.onsubmit = async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const openingDebt = Math.max(0, treasury.parseCurrencyInput(formData.get('openingDebt')));
      if (openingDebt + 0.005 < paid) {
        toast(`O débito original não pode ser menor que ${money.format(paid)}, pois esse valor já foi abatido.`);
        return;
      }

      const approved = await confirmation.askConfirmation({
        title: 'Confirmar saldo anterior',
        icon: 'history',
        tone: openingDebt > 0 ? 'warning' : 'default',
        confirmText: 'Salvar saldo',
        message: openingDebt > 0
          ? `Registrar ${money.format(openingDebt)} como débito anterior de ${member.name}?`
          : `Remover o saldo anterior configurado de ${member.name}?`
      });
      if (!approved) return;

      member.membershipOpeningDebt = Math.round((openingDebt + Number.EPSILON) * 100) / 100;
      member.membershipOpeningDebtNotes = String(formData.get('openingDebtNotes') || '').trim();
      persist(openingDebt > 0 ? 'Saldo anterior atualizado.' : 'Saldo anterior removido.');
      closeModal();
      renderTreasuryView();
    };
  };
}
