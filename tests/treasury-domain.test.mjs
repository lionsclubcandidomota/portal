import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsToReference,
  createStatusHelpers,
  currencyInputValue,
  filterItemsByPeriod,
  monthRange,
  parseCurrencyInput,
  periodBounds
} from '../assets/js/modules/treasury/domain.js';
import { parseLocalDate } from '../assets/js/utils.js';

const fixedToday = () => new Date(2026, 6, 30);

test('intervalo mensal atravessa a virada do ano sem lacunas', () => {
  assert.deepEqual(monthRange('2025-11', '2026-02'), [
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02'
  ]);
  assert.deepEqual(addMonthsToReference('2025-12', 3), [
    '2025-12',
    '2026-01',
    '2026-02'
  ]);
});

test('conversão monetária aceita padrão brasileiro e mantém duas casas', () => {
  assert.equal(parseCurrencyInput('R$ 1.234,56'), 1234.56);
  assert.equal(parseCurrencyInput('80,5'), 80.5);
  assert.equal(parseCurrencyInput('-10'), 0);
  assert.equal(currencyInputValue(80.5), '80,50');
});

test('filtro de período personalizado inclui os limites informados', () => {
  const bounds = periodBounds({
    selectedPeriod: 'custom',
    customStart: '2026-07-10',
    customEnd: '2026-07-20',
    parseDate: parseLocalDate,
    todayStart: fixedToday
  });
  const items = [
    { id: 'before', date: '2026-07-09' },
    { id: 'start', date: '2026-07-10' },
    { id: 'middle', date: '2026-07-15' },
    { id: 'end', date: '2026-07-20' },
    { id: 'after', date: '2026-07-21' }
  ];

  assert.deepEqual(
    filterItemsByPeriod(items, bounds, parseLocalDate).map(item => item.id),
    ['start', 'middle', 'end']
  );
});

test('status diferencia programado futuro, vencido e realizado', () => {
  const status = createStatusHelpers({ parseDate: parseLocalDate, todayStart: fixedToday });
  assert.equal(status.isProgrammed({ status: 'Agendado', date: '2026-07-31' }), true);
  assert.equal(status.isOverdue({ status: 'Pendente', date: '2026-07-29' }), true);
  assert.equal(status.statusLabel({ status: 'Realizado', entry: 100, date: '2026-07-20' }), 'Recebido');
  assert.equal(status.statusLabel({ status: 'Realizado', exit: 100, date: '2026-07-20' }), 'Pago');
});
