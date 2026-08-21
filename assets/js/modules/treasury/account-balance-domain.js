function normalizedDate(value = '') {
  const date = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

export function treasuryAccountItems(items = [], accountId = '', primaryAccountId = '') {
  const normalizedAccountId = String(accountId || '').trim();
  const fallbackAccountId = String(primaryAccountId || '').trim();
  if (!normalizedAccountId) return [];

  return (Array.isArray(items) ? items : []).filter(item => (
    String(item?.accountId || fallbackAccountId).trim() === normalizedAccountId
  ));
}

export function treasuryAccountBalanceAtDate({
  items = [],
  accountId = '',
  primaryAccountId = '',
  initialBalance = 0,
  date = '',
  includeProgrammed = false,
  isProgrammed = () => false
} = {}) {
  const cutoff = normalizedDate(date);
  let balance = Number(initialBalance || 0);
  if (!cutoff) return balance;

  treasuryAccountItems(items, accountId, primaryAccountId).forEach(item => {
    const itemDate = normalizedDate(item?.date);
    if (!itemDate || itemDate > cutoff) return;
    if (!includeProgrammed && isProgrammed(item)) return;
    balance += Number(item?.entry || 0) - Number(item?.exit || 0);
  });

  return balance;
}

export function treasuryAccountBalanceTone(balance = 0) {
  const numeric = Number(balance || 0);
  if (numeric < 0) return 'negative';
  if (numeric > 0) return 'positive';
  return 'zero';
}
