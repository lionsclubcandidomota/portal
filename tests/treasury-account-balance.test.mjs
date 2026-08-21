import test from 'node:test';
import assert from 'node:assert/strict';
import { treasuryAccountBalanceAtDate } from '../assets/js/modules/treasury/account-balance-domain.js';

const isProgrammed = item => ['Programado', 'Vencida'].includes(item.status);

test('saldo ao fim do dia considera saldo inicial e apenas realizados até a data', () => {
  const items = [
    { accountId: 'a1', date: '2026-08-20', entry: 100, exit: 0, status: 'Recebido' },
    { accountId: 'a1', date: '2026-08-21', entry: 0, exit: 80, status: 'Pago' },
    { accountId: 'a1', date: '2026-08-21', entry: 0, exit: 50, status: 'Pago' },
    { accountId: 'a1', date: '2026-08-22', entry: 500, exit: 0, status: 'Recebido' },
    { accountId: 'a1', date: '2026-08-21', entry: 60, exit: 0, status: 'Programado' }
  ];

  assert.equal(treasuryAccountBalanceAtDate({
    items,
    accountId: 'a1',
    primaryAccountId: 'a1',
    initialBalance: 20,
    date: '2026-08-21',
    isProgrammed
  }), -10);
});

test('saldo previsto ao fim do dia inclui operações programadas até a data', () => {
  const items = [
    { accountId: 'a1', date: '2026-08-21', entry: 100, exit: 0, status: 'Recebido' },
    { accountId: 'a1', date: '2026-08-21', entry: 0, exit: 140, status: 'Programado' },
    { accountId: 'a1', date: '2026-08-22', entry: 300, exit: 0, status: 'Programado' }
  ];

  assert.equal(treasuryAccountBalanceAtDate({
    items,
    accountId: 'a1',
    initialBalance: 10,
    date: '2026-08-21',
    includeProgrammed: true,
    isProgrammed
  }), -30);
});

test('transferência movimenta os saldos históricos das duas contas no mesmo dia', () => {
  const items = [
    { accountId: 'origem', date: '2026-08-21', entry: 0, exit: 90, status: 'Pago', transferGroupId: 'tr1' },
    { accountId: 'destino', date: '2026-08-21', entry: 90, exit: 0, status: 'Recebido', transferGroupId: 'tr1' }
  ];

  assert.equal(treasuryAccountBalanceAtDate({
    items,
    accountId: 'origem',
    initialBalance: 100,
    date: '2026-08-21',
    isProgrammed
  }), 10);
  assert.equal(treasuryAccountBalanceAtDate({
    items,
    accountId: 'destino',
    initialBalance: 5,
    date: '2026-08-21',
    isProgrammed
  }), 95);
});
