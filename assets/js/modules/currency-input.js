export function parseCurrencyInput(value) {
  const raw = String(value ?? '').trim().replace(/\s/g, '').replace(/R\$/gi, '');
  if (!raw) return 0;
  const normalizedValue = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const number = Number(normalizedValue);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function currencyInputValue(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
