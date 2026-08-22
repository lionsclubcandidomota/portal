const FEE_FIELDS = Object.freeze([
  'membershipMonthlyFee',
  'membershipFamilyPrimaryFee',
  'membershipFamilyAdditionalFee'
]);

function moneyValue(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round((amount + Number.EPSILON) * 100) / 100) : 0;
}

function validMonth(value) {
  const month = String(value || '').trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : '';
}

function feeValues(source = {}) {
  return Object.fromEntries(FEE_FIELDS.map(field => [field, moneyValue(source?.[field])]));
}

function sameFees(first, second) {
  return FEE_FIELDS.every(field => moneyValue(first?.[field]) === moneyValue(second?.[field]));
}

export function nextMembershipFeeMonth(date = new Date()) {
  const current = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (Number.isNaN(current.getTime())) return '';
  const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function normalizeMembershipFeeHistory(settings = {}) {
  const source = Array.isArray(settings?.membershipFeeHistory) ? settings.membershipFeeHistory : [];
  return source
    .map((entry, index) => {
      const effectiveFrom = validMonth(entry?.effectiveFrom);
      if (!effectiveFrom) return null;
      return {
        effectiveFrom,
        changedAt: String(entry?.changedAt || ''),
        previous: feeValues(entry?.previous),
        values: feeValues(entry?.values),
        _index: index
      };
    })
    .filter(Boolean)
    .sort((first, second) => (
      first.effectiveFrom.localeCompare(second.effectiveFrom)
      || first.changedAt.localeCompare(second.changedAt)
      || first._index - second._index
    ));
}

export function membershipFeeForMonth(settings = {}, field, month) {
  if (!FEE_FIELDS.includes(field)) return 0;
  const reference = validMonth(month);
  let amount = moneyValue(settings?.[field]);
  if (!reference) return amount;

  const history = normalizeMembershipFeeHistory(settings);
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const change = history[index];
    if (reference >= change.effectiveFrom) continue;
    amount = moneyValue(change.previous?.[field]);
  }
  return amount;
}


function fieldForRole(role) {
  const normalized = String(role || '').trim().toLocaleLowerCase('pt-BR');
  if (normalized === 'individual') return 'membershipMonthlyFee';
  if (normalized === 'titular') return 'membershipFamilyPrimaryFee';
  if (normalized === 'familiar') return 'membershipFamilyAdditionalFee';
  return '';
}

function evidenceAmountForMonth(entries, month) {
  const values = entries.filter(entry => entry.month === month).map(entry => entry.amount);
  if (!values.length) return null;
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || values.lastIndexOf(second[0]) - values.lastIndexOf(first[0]))[0][0];
}

export function inferLegacyMembershipFeeForMonth(state = {}, field, month, currentMonth) {
  if (!FEE_FIELDS.includes(field)) return null;
  const target = validMonth(month);
  const current = validMonth(currentMonth);
  if (!target || !current || target > current) return null;
  const history = normalizeMembershipFeeHistory(state?.settings || {});
  if (history.length) return null;

  const evidence = [];
  for (const item of Array.isArray(state?.treasury) ? state.treasury : []) {
    for (const allocation of Array.isArray(item?.memberAllocations) ? item.memberAllocations : []) {
      if (fieldForRole(allocation?.role) !== field) continue;
      const detailed = Array.isArray(allocation?.monthAllocations) ? allocation.monthAllocations : [];
      if (detailed.length) {
        detailed.forEach(monthAllocation => {
          const reference = validMonth(monthAllocation?.month);
          const amount = moneyValue(monthAllocation?.expectedAmount);
          if (reference && reference <= current && amount > 0) evidence.push({ month: reference, amount });
        });
        continue;
      }
      const amount = moneyValue(allocation?.monthlyAmount);
      if (!(amount > 0)) continue;
      (Array.isArray(allocation?.months) ? allocation.months : []).forEach(referenceValue => {
        const reference = validMonth(referenceValue);
        if (reference && reference <= current) evidence.push({ month: reference, amount });
      });
    }
  }
  if (!evidence.length) return null;

  const months = [...new Set(evidence.map(entry => entry.month))].sort();
  const previous = months.filter(reference => reference <= target).at(-1);
  const reference = previous || months.find(candidate => candidate >= target);
  return reference ? evidenceAmountForMonth(evidence, reference) : null;
}

export function registerMembershipFeeChange(settings = {}, nextValues = {}, date = new Date()) {
  const previous = feeValues(settings);
  const values = feeValues({ ...settings, ...nextValues });
  if (sameFees(previous, values)) return { changed: false, effectiveFrom: '' };

  const effectiveFrom = nextMembershipFeeMonth(date);
  if (!effectiveFrom) return { changed: false, effectiveFrom: '' };

  const history = normalizeMembershipFeeHistory(settings).map(({ _index, ...entry }) => entry);
  history.push({
    effectiveFrom,
    changedAt: (date instanceof Date ? date : new Date(date)).toISOString(),
    previous,
    values
  });

  settings.membershipFeeHistory = history;
  for (const field of FEE_FIELDS) settings[field] = values[field];
  return { changed: true, effectiveFrom };
}

export const MEMBERSHIP_FEE_FIELDS = FEE_FIELDS;
