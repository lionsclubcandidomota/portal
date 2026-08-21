import {
  TREASURY_MOVEMENT_KIND,
  TREASURY_TRANSFER_CATEGORY,
  normalizeTreasuryMovementKind
} from '../treasury/movement-domain.js';
import { money } from '../../utils.js';

export function calculateMembershipBase({
  selectedIds = [],
  hasFamilyGroup = false,
  groupPrimaryId = '',
  individualFee = 0,
  familyPrimaryFee = 0,
  familyAdditionalFee = 0
} = {}) {
  const ids = [...new Set(selectedIds)].filter(Boolean);
  if (!hasFamilyGroup) return Number(individualFee || 0) * ids.length;

  const hasPrimary = ids.includes(groupPrimaryId);
  const additionalCount = Math.max(0, ids.length - (hasPrimary ? 1 : 0));
  return (hasPrimary ? Number(familyPrimaryFee || 0) : 0)
    + (additionalCount * Number(familyAdditionalFee || 0));
}

export function buildMemberAllocations({
  memberIds = [],
  members = [],
  coveredMonths = [],
  hasFamilyGroup = false,
  groupPrimaryId = '',
  individualFee = 0,
  familyPrimaryFee = 0,
  familyAdditionalFee = 0
} = {}) {
  const monthCount = coveredMonths.length;
  const memberById = new Map(members.map(member => [member.id, member]));

  return [...new Set(memberIds)].filter(Boolean).map(memberId => {
    const isPrimary = hasFamilyGroup && memberId === groupPrimaryId;
    const monthlyAmount = hasFamilyGroup
      ? (isPrimary ? Number(familyPrimaryFee || 0) : Number(familyAdditionalFee || 0))
      : Number(individualFee || 0);

    return {
      memberId,
      memberName: memberById.get(memberId)?.name || '',
      role: hasFamilyGroup ? (isPrimary ? 'Titular' : 'Familiar') : 'Individual',
      monthlyAmount,
      months: [...coveredMonths],
      amount: monthlyAmount * monthCount
    };
  });
}


function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function allocateMembershipPayment({
  memberIds = [],
  members = [],
  coveredMonths = [],
  amount = 0,
  hasFamilyGroup = false,
  groupPrimaryId = '',
  expectedAmountForMember = () => 0,
  paidAmountForMemberMonth = () => 0
} = {}) {
  const ids = [...new Set(memberIds)].filter(Boolean);
  const months = [...new Set(coveredMonths)].filter(Boolean).sort();
  const memberById = new Map(members.map(member => [String(member.id), member]));
  const requestedAmount = roundMoney(Math.max(0, Number(amount || 0)));
  const debts = [];

  months.forEach(month => {
    ids.forEach(memberId => {
      const expectedAmount = roundMoney(Math.max(0, Number(expectedAmountForMember(memberId) || 0)));
      const previouslyPaid = roundMoney(Math.max(0, Number(paidAmountForMemberMonth(memberId, month) || 0)));
      const outstandingBefore = roundMoney(Math.max(0, expectedAmount - previouslyPaid));
      if (outstandingBefore <= 0) return;
      debts.push({
        memberId,
        month,
        expectedAmount,
        previouslyPaid,
        outstandingBefore
      });
    });
  });

  const outstandingTotal = roundMoney(debts.reduce((sum, debt) => sum + debt.outstandingBefore, 0));
  let remaining = requestedAmount;
  const applied = [];

  debts.forEach(debt => {
    if (remaining <= 0) return;
    const appliedAmount = roundMoney(Math.min(debt.outstandingBefore, remaining));
    if (appliedAmount <= 0) return;
    remaining = roundMoney(remaining - appliedAmount);
    applied.push({
      ...debt,
      amount: appliedAmount,
      remainingAfter: roundMoney(debt.outstandingBefore - appliedAmount)
    });
  });

  const memberAllocations = ids.map(memberId => {
    const monthAllocations = applied.filter(allocation => allocation.memberId === memberId);
    if (!monthAllocations.length) return null;
    const member = memberById.get(String(memberId));
    const isPrimary = hasFamilyGroup && memberId === groupPrimaryId;
    return {
      memberId,
      memberName: member?.name || '',
      role: hasFamilyGroup ? (isPrimary ? 'Titular' : 'Familiar') : 'Individual',
      monthlyAmount: roundMoney(Math.max(0, Number(expectedAmountForMember(memberId) || 0))),
      months: monthAllocations.map(allocation => allocation.month),
      amount: roundMoney(monthAllocations.reduce((sum, allocation) => sum + allocation.amount, 0)),
      monthAllocations
    };
  }).filter(Boolean);

  return {
    requestedAmount,
    outstandingTotal,
    allocatedTotal: roundMoney(requestedAmount - remaining),
    unallocatedAmount: roundMoney(remaining),
    allocations: applied,
    memberAllocations
  };
}

export function buildMembershipChargeMessage({
  memberName = '',
  monthLabels = [],
  expectedTotal = 0,
  openingDebt = 0,
  clubName = 'Lions Clube'
} = {}) {
  const months = [...new Set(monthLabels)].filter(Boolean);
  const firstName = String(memberName || '').trim().split(/\s+/)[0] || memberName;
  const debt = Math.max(0, Number(openingDebt || 0));
  const total = Math.max(0, Number(expectedTotal || 0));
  const parts = [];
  if (debt > 0) parts.push(`saldo anterior em aberto de ${money.format(debt)}`);
  if (months.length) parts.push(`mensalidade${months.length > 1 ? 's' : ''} pendente${months.length > 1 ? 's' : ''} referente${months.length > 1 ? 's' : ''} a ${months.join(', ')}`);
  const pendingText = parts.length ? parts.join(' e ') : 'valores pendentes';
  const valueText = total > 0 ? ` O total estimado em aberto é ${money.format(total)}.` : '';

  return `Olá, ${firstName}! Tudo bem?

Identificamos ${pendingText}.${valueText}

Pedimos, por gentileza, que verifique a situação. Caso o pagamento já tenha sido realizado, desconsidere esta mensagem e, se possível, encaminhe o comprovante.

Obrigado(a)!
Tesouraria do ${clubName}`;
}

export function buildFamilyMembershipChargeMessage({
  familyName = '',
  memberCharges = [],
  clubName = 'Lions Clube'
} = {}) {
  const charges = (Array.isArray(memberCharges) ? memberCharges : [])
    .map(item => ({
      memberName: String(item?.memberName || '').trim(),
      monthLabels: [...new Set(item?.monthLabels || [])].filter(Boolean),
      openingDebt: Math.max(0, Number(item?.openingDebt || 0)),
      expectedTotal: Math.max(0, Number(item?.expectedTotal || 0))
    }))
    .filter(item => item.memberName && (item.monthLabels.length || item.openingDebt > 0));
  const familyLabel = String(familyName || '').trim() || 'família';
  const total = charges.reduce((sum, item) => sum + item.expectedTotal, 0);
  const lines = charges.map(item => {
    const parts = [];
    if (item.openingDebt > 0) parts.push(`saldo anterior ${money.format(item.openingDebt)}`);
    if (item.monthLabels.length) parts.push(item.monthLabels.join(', '));
    return `• ${item.memberName}: ${parts.join(' + ')} — ${money.format(item.expectedTotal)}`;
  });

  return `Olá, família ${familyLabel}! Tudo bem?

Identificamos valores pendentes para os integrantes abaixo:
${lines.join('\n')}

Total estimado: ${money.format(total)}.

Pedimos, por gentileza, que verifiquem a situação. Caso os pagamentos já tenham sido realizados, desconsiderem esta mensagem e, se possível, encaminhem os comprovantes.

Obrigado(a)!
Tesouraria do ${clubName}`;
}

export function normalizeTreasuryEntryPayload(raw = {}, { defaultAccountId = '', transferCategory = TREASURY_TRANSFER_CATEGORY } = {}) {
  const data = { ...raw };
  const rawKind = String(data.movementKind || '').trim();
  const legacyEntry = Number(data.entry || 0);
  const legacyExit = Number(data.exit || 0);
  const legacyPayload = !rawKind && !Object.prototype.hasOwnProperty.call(data, 'amount');
  if (legacyPayload) {
    if (!legacyEntry && !legacyExit) throw new Error('Informe um valor de entrada ou saída.');
    if (legacyEntry && legacyExit) throw new Error('Informe apenas entrada ou saída, não os dois valores.');
  }
  const movementKind = normalizeTreasuryMovementKind(rawKind, data);
  const statusMode = String(data.statusMode || 'Programado').trim();
  delete data.statusMode;

  if (movementKind === TREASURY_MOVEMENT_KIND.TRANSFER) {
    const sourceAccountId = String(data.sourceAccountId || defaultAccountId || '').trim();
    const destinationAccountId = String(data.destinationAccountId || '').trim();
    const transferAmount = Number(data.transferAmount || data.amount || 0);
    const description = String(data.description || '').trim();
    const notes = String(data.notes || '').trim();
    const date = String(data.date || '').trim();

    if (!sourceAccountId) throw new Error('Selecione a conta de origem da transferência.');
    if (!destinationAccountId) throw new Error('Selecione a conta de destino da transferência.');
    if (sourceAccountId === destinationAccountId) throw new Error('Escolha contas diferentes para origem e destino da transferência.');
    if (!(transferAmount > 0)) throw new Error('Informe o valor da transferência.');

    return {
      movementKind,
      statusMode,
      data: {
        movementKind,
        date,
        description,
        notes,
        category: transferCategory,
        sourceAccountId,
        destinationAccountId,
        transferAmount
      }
    };
  }

  const amount = Number(data.amount || data.entry || data.exit || 0);
  const category = String(data.category || '').trim();
  const accountId = String(data.accountId || defaultAccountId || '').trim();

  if (!accountId) throw new Error(`Selecione a conta ${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'que receberá a entrada' : 'de onde sairá o valor'}.`);
  if (!(amount > 0)) throw new Error(`Informe o valor da ${movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? 'entrada' : 'saída'}.`);
  if (!category) throw new Error('Selecione uma categoria.');

  return {
    movementKind,
    statusMode,
    data: {
      ...data,
      movementKind,
      accountId,
      category,
      amount,
      entry: movementKind === TREASURY_MOVEMENT_KIND.ENTRY ? amount : 0,
      exit: movementKind === TREASURY_MOVEMENT_KIND.EXIT ? amount : 0
    }
  };
}

export function resolveTreasuryEntryStatus({ date = '', entry = 0, statusMode = 'Programado' } = {}, now = new Date()) {
  if (statusMode === 'Efetivado') return Number(entry || 0) > 0 ? 'Recebido' : 'Pago';

  const scheduledDate = new Date(`${date}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return scheduledDate < today ? 'Vencida' : 'Programado';
}


export function resolveTreasuryTransferStatus({ date = '', statusMode = 'Programado' } = {}, now = new Date()) {
  if (statusMode === 'Efetivado') return 'Efetivado';
  return resolveTreasuryEntryStatus({ date, entry: 0, statusMode }, now);
}
