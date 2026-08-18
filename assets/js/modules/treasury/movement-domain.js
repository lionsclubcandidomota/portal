export const TREASURY_MOVEMENT_KIND = Object.freeze({
  ENTRY: 'entry',
  EXIT: 'exit',
  TRANSFER: 'transfer'
});

export const TREASURY_TRANSFER_CATEGORY = 'Transferência entre contas';

const MOVEMENT_KINDS = new Set(Object.values(TREASURY_MOVEMENT_KIND));

export function treasuryMovementKind(item = {}) {
  const rawKind = String(item?.movementKind || '').trim().toLowerCase();
  if (item?.transferGroupId || rawKind === TREASURY_MOVEMENT_KIND.TRANSFER) return TREASURY_MOVEMENT_KIND.TRANSFER;
  if (rawKind === TREASURY_MOVEMENT_KIND.EXIT) return TREASURY_MOVEMENT_KIND.EXIT;
  if (rawKind === TREASURY_MOVEMENT_KIND.ENTRY) return TREASURY_MOVEMENT_KIND.ENTRY;
  return Number(item?.exit || 0) > 0 && Number(item?.entry || 0) <= 0
    ? TREASURY_MOVEMENT_KIND.EXIT
    : TREASURY_MOVEMENT_KIND.ENTRY;
}

export function normalizeTreasuryMovementKind(value, fallbackItem = {}) {
  const normalized = String(value || '').trim().toLowerCase();
  return MOVEMENT_KINDS.has(normalized)
    ? normalized
    : treasuryMovementKind({ ...fallbackItem, movementKind: '' });
}

export function isTreasuryTransfer(item) {
  return treasuryMovementKind(item) === TREASURY_MOVEMENT_KIND.TRANSFER;
}

export function isTreasuryEntry(item) {
  return treasuryMovementKind(item) === TREASURY_MOVEMENT_KIND.ENTRY;
}

export function isTreasuryExit(item) {
  return treasuryMovementKind(item) === TREASURY_MOVEMENT_KIND.EXIT;
}

export function treasuryMovementLabel(kindOrItem) {
  const kind = typeof kindOrItem === 'string'
    ? normalizeTreasuryMovementKind(kindOrItem)
    : treasuryMovementKind(kindOrItem);
  if (kind === TREASURY_MOVEMENT_KIND.EXIT) return 'Saída';
  if (kind === TREASURY_MOVEMENT_KIND.TRANSFER) return 'Transferência';
  return 'Entrada';
}

export function treasuryMovementAmount(item = {}) {
  const kind = treasuryMovementKind(item);
  if (kind === TREASURY_MOVEMENT_KIND.TRANSFER) return Math.max(0, Number(item?.transferAmount || item?.exit || item?.entry || 0));
  return Math.max(0, Number(kind === TREASURY_MOVEMENT_KIND.EXIT ? item?.exit : item?.entry || 0));
}

export function treasuryMovementLogicalKey(item = {}, fallbackIndex = 0) {
  if (isTreasuryTransfer(item)) {
    const groupId = String(item?.transferGroupId || '').trim();
    if (groupId) return `transfer:${groupId}`;
  }
  const id = String(item?.id || '').trim();
  return id ? `movement:${id}` : `movement-index:${fallbackIndex}`;
}

export function uniqueTreasuryMovementCount(items = []) {
  const seen = new Set();
  (Array.isArray(items) ? items : []).forEach((item, index) => seen.add(treasuryMovementLogicalKey(item, index)));
  return seen.size;
}

export function financialTreasuryItems(items = []) {
  return (Array.isArray(items) ? items : []).filter(item => !isTreasuryTransfer(item));
}
