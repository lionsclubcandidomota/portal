import test from 'node:test';
import assert from 'node:assert/strict';
import { movementValueSummary } from '../assets/js/modules/treasury/movements.js';

const movements = [
  { id: 'real-entry', status: 'Realizado', entry: 100, exit: 0 },
  { id: 'real-exit', status: 'Pago', entry: 0, exit: 40 },
  { id: 'scheduled-entry', status: 'Programado', entry: 80, exit: 0 },
  { id: 'scheduled-exit', status: 'Agendado', entry: 0, exit: 25 }
];

const isProgrammed = item => ['programado', 'agendado'].includes(String(item.status).toLowerCase());

test('resumo realizado ignora valores programados', () => {
  assert.deepEqual(movementValueSummary(movements, isProgrammed, 'realized'), {
    scheduled: false,
    entries: 100,
    exits: 40,
    result: 60,
    count: 2
  });
});

test('resumo programado soma entradas e saídas previstas', () => {
  assert.deepEqual(movementValueSummary(movements, isProgrammed, 'scheduled'), {
    scheduled: true,
    entries: 80,
    exits: 25,
    result: 55,
    count: 2
  });
});
