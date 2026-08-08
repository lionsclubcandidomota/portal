import { escapeHtml, money } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.5';
import {
  buildFamilyMembershipChargeMessage,
  buildMembershipChargeMessage
} from './domain.js';

export function createMembershipChargeSharer(context) {
  const {
    state,
    treasury,
    toast,
    modalBody,
    showModal,
    closeModal
  } = context;

  const shareText = async (title, text) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') return false;
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast('Mensagem copiada. Agora é só colar no WhatsApp.');
      return true;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
    toast('Mensagem copiada. Agora é só colar no WhatsApp.');
    return true;
  };

  const individualPayload = (member, months, clubName) => {
    const expectedMonthlyAmount = treasury.membershipExpectedAmountForMember(member.id);
    const expectedTotal = expectedMonthlyAmount * months.length;
    return {
      title: `Mensalidade — ${clubName}`,
      text: buildMembershipChargeMessage({
        memberName: member.name,
        monthLabels: months.map(treasury.monthLabel),
        expectedTotal,
        clubName
      })
    };
  };

  const familyPayload = (group, requestedMonths, clubName) => {
    const members = (group.memberIds || [])
      .map(id => state().birthdays.find(item => item.id === id))
      .filter(item => item && treasury.memberIsActive(item));
    const memberCharges = members.map(member => {
      const pendingMonths = requestedMonths.filter(month => !treasury.monthIsPaid(member.id, month));
      return {
        memberName: member.name,
        monthLabels: pendingMonths.map(treasury.monthLabel),
        expectedTotal: treasury.membershipExpectedAmountForMember(member.id) * pendingMonths.length
      };
    }).filter(item => item.monthLabels.length);

    return {
      memberCharges,
      title: `Mensalidades da ${group.name} — ${clubName}`,
      text: buildFamilyMembershipChargeMessage({
        familyName: group.name,
        memberCharges,
        clubName
      })
    };
  };

  const shareMembershipCharge = async (memberId, months = []) => {
    const member = state().birthdays.find(item => item.id === memberId);
    if (!member) {
      toast('Associado não encontrado.');
      return;
    }

    const pendingMonths = [...new Set(months)].filter(Boolean);
    if (!pendingMonths.length) {
      toast('Não há mensalidades pendentes no período selecionado.');
      return;
    }

    const clubName = state().settings?.clubName || 'Lions Clube';
    const memberPayload = individualPayload(member, pendingMonths, clubName);
    const group = treasury.familyGroupForMember(memberId);
    if (!group) {
      await shareText(memberPayload.title, memberPayload.text);
      return;
    }

    const groupPayload = familyPayload(group, pendingMonths, clubName);
    if (!groupPayload.memberCharges.length) {
      await shareText(memberPayload.title, memberPayload.text);
      return;
    }
    const familyTotal = groupPayload.memberCharges.reduce((sum, item) => sum + Number(item.expectedTotal || 0), 0);

    modalBody.innerHTML = `<section class="membership-charge-choice" aria-labelledby="membershipChargeChoiceTitle">
      <div class="membership-charge-choice-intro"><span aria-hidden="true">${uiIcon('message')}</span><div><h3 id="membershipChargeChoiceTitle">Quem deve receber a mensagem?</h3><p>Escolha entre uma cobrança individual ou um resumo de toda a família.</p></div></div>
      <div class="membership-charge-choice-grid">
        <button class="membership-charge-option" type="button" data-membership-charge-target="member">
          <span aria-hidden="true">${uiIcon('user')}</span><div><strong>Somente o associado</strong><small>${escapeHtml(member.name)} · ${pendingMonths.length} mês(es)</small></div><b>${money.format(treasury.membershipExpectedAmountForMember(memberId) * pendingMonths.length)}</b>
        </button>
        <button class="membership-charge-option is-family" type="button" data-membership-charge-target="family">
          <span aria-hidden="true">${uiIcon('family')}</span><div><strong>Toda a família</strong><small>${escapeHtml(group.name)} · ${groupPayload.memberCharges.length} integrante(s) com pendências</small></div><b>${money.format(familyTotal)}</b>
        </button>
      </div>
      <div class="form-actions"><button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button></div>
    </section>`;
    showModal('Enviar cobrança');

    modalBody.querySelector('[data-membership-charge-target="member"]')?.addEventListener('click', async () => {
      closeModal();
      await shareText(memberPayload.title, memberPayload.text);
    });
    modalBody.querySelector('[data-membership-charge-target="family"]')?.addEventListener('click', async () => {
      closeModal();
      await shareText(groupPayload.title, groupPayload.text);
    });
  };

  return shareMembershipCharge;
}
