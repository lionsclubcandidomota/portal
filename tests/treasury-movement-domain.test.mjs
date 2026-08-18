import test from 'node:test';
import assert from 'node:assert/strict';
import { sumTreasury } from '../assets/js/utils.js';
import { summarizeMovementFilter } from '../assets/js/modules/treasury/movements.js';
import {
  TREASURY_MOVEMENT_KIND,
  financialTreasuryItems,
  isTreasuryEntry,
  isTreasuryExit,
  isTreasuryTransfer,
  treasuryMovementAmount,
  treasuryMovementKind,
  uniqueTreasuryMovementCount
} from '../assets/js/modules/treasury/movement-domain.js';
import {
  consolidateTreasuryMovements,
  resolveTransferParts
} from '../assets/js/modules/treasury/movement-transfer-domain.js';

const transferPair = [
  {
    id: 'src',
    date: '2026-08-18',
    movementKind: 'transfer',
    transferGroupId: 'tt1',
    transferRole: 'source',
    sourceAccountId: 'a1',
    destinationAccountId: 'a2',
    accountId: 'a1',
    transferAmount: 120,
    entry: 0,
    exit: 120,
    status: 'Efetivado',
    description: 'Reforço do caixa'
  },
  {
    id: 'dst',
    date: '2026-08-18',
    movementKind: 'transfer',
    transferGroupId: 'tt1',
    transferRole: 'destination',
    sourceAccountId: 'a1',
    destinationAccountId: 'a2',
    accountId: 'a2',
    transferAmount: 120,
    entry: 120,
    exit: 0,
    status: 'Efetivado',
    description: 'Reforço do caixa'
  }
];

test('domínio identifica entrada, saída e transferência inclusive em lançamentos antigos', () => {
  assert.equal(treasuryMovementKind({ entry: 50, exit: 0 }), TREASURY_MOVEMENT_KIND.ENTRY);
  assert.equal(treasuryMovementKind({ entry: 0, exit: 30 }), TREASURY_MOVEMENT_KIND.EXIT);
  assert.equal(treasuryMovementKind(transferPair[0]), TREASURY_MOVEMENT_KIND.TRANSFER);
  assert.equal(isTreasuryEntry({ entry: 50 }), true);
  assert.equal(isTreasuryExit({ exit: 30 }), true);
  assert.equal(isTreasuryTransfer(transferPair[1]), true);
});

test('par contábil de transferência vira uma única operação lógica', () => {
  const logical = consolidateTreasuryMovements(transferPair);
  assert.equal(logical.length, 1);
  assert.equal(logical[0].transferRole, 'paired');
  assert.equal(logical[0].sourceAccountId, 'a1');
  assert.equal(logical[0].destinationAccountId, 'a2');
  assert.equal(treasuryMovementAmount(logical[0]), 120);
  assert.equal(uniqueTreasuryMovementCount(transferPair), 1);
});

test('origem e destino da transferência são resolvidos de forma consistente', () => {
  const parts = resolveTransferParts([...transferPair].reverse());
  assert.equal(parts.source.id, 'src');
  assert.equal(parts.destination.id, 'dst');
});

test('transferência altera contas mas não entra como receita ou despesa geral', () => {
  const rawTotals = sumTreasury(transferPair);
  assert.equal(rawTotals.entries, 120);
  assert.equal(rawTotals.exits, 120);
  assert.equal(rawTotals.balance, 0);

  const financialTotals = sumTreasury(financialTreasuryItems(transferPair));
  assert.equal(financialTotals.entries, 0);
  assert.equal(financialTotals.exits, 0);
  assert.equal(financialTotals.balance, 0);
});

test('consolidação preserva operações comuns e conta transferência uma única vez', () => {
  const items = [
    { id: 'e1', movementKind: 'entry', entry: 80, exit: 0 },
    { id: 'x1', movementKind: 'exit', entry: 0, exit: 25 },
    ...transferPair
  ];
  const logical = consolidateTreasuryMovements(items);
  assert.equal(logical.length, 3);
  assert.equal(logical.filter(isTreasuryEntry).length, 1);
  assert.equal(logical.filter(isTreasuryExit).length, 1);
  assert.equal(logical.filter(isTreasuryTransfer).length, 1);
});


test('resumo financeiro trata transferência como operação neutra no resultado geral', () => {
  const items = [
    { id: 'e1', movementKind: 'entry', entry: 80, exit: 0, status: 'Recebido' },
    { id: 'x1', movementKind: 'exit', entry: 0, exit: 25, status: 'Pago' },
    ...transferPair
  ];
  const treasury = { isProgrammed: () => false };
  const summary = summarizeMovementFilter(items, 'all', treasury);
  assert.equal(summary.entries, 80);
  assert.equal(summary.exits, 25);
  assert.equal(summary.result, 55);
  assert.equal(summary.count, 3);
});
