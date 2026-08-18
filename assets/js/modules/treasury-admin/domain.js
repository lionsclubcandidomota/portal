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

export function buildMembershipChargeMessage({
  memberName = '',
  monthLabels = [],
  expectedTotal = 0,
  clubName = 'Lions Clube'
} = {}) {
  const months = [...new Set(monthLabels)].filter(Boolean);
  const firstName = String(memberName || '').trim().split(/\s+/)[0] || memberName;
  const plural = months.length > 1;
  const valueText = Number(expectedTotal || 0) > 0
    ? ` O valor estimado do período é ${money.format(Number(expectedTotal))}.`
    : '';

  return `Olá, ${firstName}! Tudo bem?

Identificamos mensalidade${plural ? 's' : ''} pendente${plural ? 's' : ''} referente${plural ? 's' : ''} a ${months.join(', ')}.${valueText}

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
      expectedTotal: Math.max(0, Number(item?.expectedTotal || 0))
    }))
    .filter(item => item.memberName && item.monthLabels.length);
  const familyLabel = String(familyName || '').trim() || 'família';
  const total = charges.reduce((sum, item) => sum + item.expectedTotal, 0);
  const lines = charges.map(item => `• ${item.memberName}: ${item.monthLabels.join(', ')} — ${money.format(item.expectedTotal)}`);

  return `Olá, família ${familyLabel}! Tudo bem?

Identificamos mensalidades pendentes para os integrantes abaixo:
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
