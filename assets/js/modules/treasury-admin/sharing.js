import { buildMembershipChargeMessage } from './domain.js';

export function createMembershipChargeSharer(context) {
  const { state, treasury, toast } = context;

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

    const expectedMonthlyAmount = treasury.membershipExpectedAmountForMember(memberId);
    const expectedTotal = expectedMonthlyAmount * pendingMonths.length;
    const clubName = state().settings?.clubName || 'Lions Clube';
    const text = buildMembershipChargeMessage({
      memberName: member.name,
      monthLabels: pendingMonths.map(treasury.monthLabel),
      expectedTotal,
      clubName
    });

    await shareText(`Mensalidade — ${clubName}`, text);
  };

  return shareMembershipCharge;
}
