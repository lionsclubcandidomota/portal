import {
  TREASURY_MOVEMENT_KIND,
  TREASURY_TRANSFER_CATEGORY,
  isTreasuryTransfer,
  treasuryMovementAmount,
  treasuryMovementLogicalKey
} from './movement-domain.js';

export function transferEntriesFor(items = [], transferGroupId = '') {
  const groupId = String(transferGroupId || '').trim();
  if (!groupId) return [];
  return (Array.isArray(items) ? items : []).filter(item => String(item?.transferGroupId || '').trim() === groupId);
}


export function treasuryOperationEntryIds(items = [], item = {}) {
  if (!isTreasuryTransfer(item)) {
    const id = String(item?.id || '').trim();
    return id ? [id] : [];
  }
  const groupId = String(item?.transferGroupId || '').trim();
  const transferItems = groupId ? transferEntriesFor(items, groupId) : [item];
  return [...new Set(transferItems.map(entry => String(entry?.id || '').trim()).filter(Boolean))];
}

export function resolveTransferParts(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  return {
    source: list.find(item => item?.transferRole === 'source' || Number(item?.exit || 0) > 0) || list[0] || null,
    destination: list.find(item => item?.transferRole === 'destination' || Number(item?.entry || 0) > 0) || list[1] || list[0] || null
  };
}

export function consolidateTreasuryMovements(items = []) {
  const sourceItems = Array.isArray(items) ? items : [];
  const groups = new Map();
  sourceItems.forEach(item => {
    if (!isTreasuryTransfer(item)) return;
    const groupId = String(item?.transferGroupId || '').trim();
    if (!groupId) return;
    groups.set(groupId, [...(groups.get(groupId) || []), item]);
  });

  const seen = new Set();
  const result = [];
  sourceItems.forEach((item, index) => {
    if (!isTreasuryTransfer(item)) {
      result.push(item);
      return;
    }

    const groupId = String(item?.transferGroupId || '').trim();
    const key = groupId ? `transfer:${groupId}` : treasuryMovementLogicalKey(item, index);
    if (seen.has(key)) return;
    seen.add(key);

    const { source, destination } = resolveTransferParts(groupId ? (groups.get(groupId) || [item]) : [item]);
    const reference = source || destination || item;
    result.push({
      ...reference,
      id: source?.id || destination?.id || item?.id,
      movementKind: TREASURY_MOVEMENT_KIND.TRANSFER,
      category: reference?.category || TREASURY_TRANSFER_CATEGORY,
      transferGroupId: groupId || reference?.transferGroupId || '',
      transferRole: 'paired',
      sourceAccountId: source?.sourceAccountId || source?.accountId || reference?.sourceAccountId || '',
      destinationAccountId: source?.destinationAccountId || destination?.accountId || reference?.destinationAccountId || '',
      transferAmount: treasuryMovementAmount(source || destination || item),
      transferLabel: source?.transferLabel || destination?.transferLabel || reference?.transferLabel || reference?.description || 'Transferência entre contas',
      description: source?.transferLabel || destination?.transferLabel || reference?.transferLabel || reference?.description || 'Transferência entre contas',
      notes: source?.notes || destination?.notes || reference?.notes || '',
      entry: 0,
      exit: 0,
      attachments: Array.isArray(source?.attachments) && source.attachments.length
        ? source.attachments
        : (Array.isArray(destination?.attachments) ? destination.attachments : []),
      transferSourceEntryId: source?.id || '',
      transferDestinationEntryId: destination?.id || ''
    });
  });
  return result;
}

export function buildTreasuryTransferPair({
  transferGroupId = '',
  sourceEntryId = '',
  destinationEntryId = '',
  date = '',
  category = TREASURY_TRANSFER_CATEGORY,
  notes = '',
  status = 'Efetivado',
  description = 'Transferência entre contas',
  sourceAccountId = '',
  destinationAccountId = '',
  transferAmount = 0,
  attachments = []
} = {}, { createId = () => '' } = {}) {
  const amount = Math.max(0, Number(transferAmount || 0));
  const groupId = String(transferGroupId || '').trim();
  const sourceId = String(sourceEntryId || '').trim() || createId('source');
  const destinationId = String(destinationEntryId || '').trim() || createId('destination');
  const label = String(description || '').trim() || 'Transferência entre contas';
  const shared = {
    date: String(date || '').trim(),
    category: String(category || '').trim() || TREASURY_TRANSFER_CATEGORY,
    notes: String(notes || '').trim(),
    status: String(status || '').trim() || 'Efetivado',
    transferGroupId: groupId,
    movementKind: TREASURY_MOVEMENT_KIND.TRANSFER,
    transferLabel: label,
    sourceAccountId: String(sourceAccountId || '').trim(),
    destinationAccountId: String(destinationAccountId || '').trim(),
    transferAmount: amount,
    memberId: '',
    memberIds: [],
    coveredMonths: []
  };

  return [
    {
      id: sourceId,
      ...shared,
      accountId: shared.sourceAccountId,
      description: label,
      entry: 0,
      exit: amount,
      transferRole: 'source',
      attachments: Array.isArray(attachments) ? attachments : []
    },
    {
      id: destinationId,
      ...shared,
      accountId: shared.destinationAccountId,
      description: label,
      entry: amount,
      exit: 0,
      transferRole: 'destination',
      attachments: []
    }
  ];
}
