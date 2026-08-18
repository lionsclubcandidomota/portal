import test from 'node:test';
import assert from 'node:assert/strict';
import { sumTreasury } from '../assets/js/utils.js';
import {
  normalizeTreasuryEntryPayload,
  resolveTreasuryTransferStatus
} from '../assets/js/modules/treasury-admin/domain.js';
import {
  buildTreasuryTransferPair,
  consolidateTreasuryMovements,
  resolveTransferParts,
  transferEntriesFor,
  treasuryOperationEntryIds
} from '../assets/js/modules/treasury/movement-transfer-domain.js';
import {
  financialTreasuryItems,
  isTreasuryTransfer
} from '../assets/js/modules/treasury/movement-domain.js';

test('módulo lazy de formulários administrativos resolve dependências de transferência', async () => {
  const module = await import('../assets/js/modules/entity-forms.js');
  assert.equal(typeof module.createEntityFormsController, 'function');
});

test('transferência rejeita mesma conta e valor inválido antes de persistir', () => {
  assert.throws(() => normalizeTreasuryEntryPayload({
    movementKind: 'transfer',
    sourceAccountId: 'a1',
    destinationAccountId: 'a1',
    transferAmount: 100
  }), /contas diferentes/i);

  assert.throws(() => normalizeTreasuryEntryPayload({
    movementKind: 'transfer',
    sourceAccountId: 'a1',
    destinationAccountId: 'a2',
    transferAmount: 0
  }), /valor da transferência/i);
});

test('status de transferência diferencia efetivada, programada e vencida', () => {
  const now = new Date(2026, 7, 18, 12, 0, 0);
  assert.equal(resolveTreasuryTransferStatus({ date: '2026-08-18', statusMode: 'Efetivado' }, now), 'Efetivado');
  assert.equal(resolveTreasuryTransferStatus({ date: '2026-08-20', statusMode: 'Programado' }, now), 'Programado');
  assert.equal(resolveTreasuryTransferStatus({ date: '2026-08-10', statusMode: 'Programado' }, now), 'Vencida');
});

test('construtor de transferência cria par simétrico e preserva IDs durante edição', () => {
  const pair = buildTreasuryTransferPair({
    transferGroupId: 'tt-edit',
    sourceEntryId: 'src-existing',
    destinationEntryId: 'dst-existing',
    date: '2026-08-18',
    status: 'Efetivado',
    description: 'Reforço do caixa',
    sourceAccountId: 'a1',
    destinationAccountId: 'a2',
    transferAmount: 125,
    attachments: [{ id: 'file-1', name: 'comprovante.pdf' }]
  });

  assert.equal(pair.length, 2);
  const { source, destination } = resolveTransferParts(pair);
  assert.equal(source.id, 'src-existing');
  assert.equal(destination.id, 'dst-existing');
  assert.equal(source.exit, 125);
  assert.equal(source.entry, 0);
  assert.equal(destination.entry, 125);
  assert.equal(destination.exit, 0);
  assert.equal(source.accountId, 'a1');
  assert.equal(destination.accountId, 'a2');
  assert.equal(source.attachments.length, 1);
  assert.equal(destination.attachments.length, 0);
  assert.equal(transferEntriesFor(pair, 'tt-edit').length, 2);
});


test('edição e exclusão lógica localizam sempre os dois lados da transferência', () => {
  const pair = buildTreasuryTransferPair({
    transferGroupId: 'tt-remove',
    sourceEntryId: 'src-remove',
    destinationEntryId: 'dst-remove',
    status: 'Efetivado',
    sourceAccountId: 'a1',
    destinationAccountId: 'a2',
    transferAmount: 60
  });
  const collection = [
    { id: 'income', movementKind: 'entry', entry: 20, exit: 0 },
    ...pair,
    { id: 'expense', movementKind: 'exit', entry: 0, exit: 10 }
  ];

  assert.deepEqual(
    treasuryOperationEntryIds(collection, pair[0]).sort(),
    ['dst-remove', 'src-remove']
  );
  assert.deepEqual(treasuryOperationEntryIds(collection, collection[0]), ['income']);
});

test('transferência efetivada movimenta saldos das contas e permanece neutra no clube', () => {
  const pair = buildTreasuryTransferPair({
    transferGroupId: 'tt-realized',
    date: '2026-08-18',
    status: 'Efetivado',
    sourceAccountId: 'a1',
    destinationAccountId: 'a2',
    transferAmount: 200
  }, { createId: role => `id-${role}` });

  const sourceTotals = sumTreasury(pair.filter(item => item.accountId === 'a1'));
  const destinationTotals = sumTreasury(pair.filter(item => item.accountId === 'a2'));
  const clubTotals = sumTreasury(financialTreasuryItems(pair));

  assert.equal(sourceTotals.balance, -200);
  assert.equal(destinationTotals.balance, 200);
  assert.equal(clubTotals.entries, 0);
  assert.equal(clubTotals.exits, 0);
  assert.equal(clubTotals.balance, 0);
});

test('transferência programada altera apenas saldo projetado das contas', () => {
  const pair = buildTreasuryTransferPair({
    transferGroupId: 'tt-future',
    date: '2026-08-20',
    status: 'Programado',
    sourceAccountId: 'a1',
    destinationAccountId: 'a2',
    transferAmount: 90
  }, { createId: role => `future-${role}` });

  const sourceTotals = sumTreasury(pair.filter(item => item.accountId === 'a1'));
  const destinationTotals = sumTreasury(pair.filter(item => item.accountId === 'a2'));

  assert.equal(sourceTotals.balance, 0);
  assert.equal(sourceTotals.programmedExits, 90);
  assert.equal(sourceTotals.projectedBalance, -90);
  assert.equal(destinationTotals.balance, 0);
  assert.equal(destinationTotals.programmedEntries, 90);
  assert.equal(destinationTotals.projectedBalance, 90);
});

test('consolidação mantém transferência como uma operação após criação ou edição', () => {
  const pair = buildTreasuryTransferPair({
    transferGroupId: 'tt-logical',
    sourceEntryId: 'src-logical',
    destinationEntryId: 'dst-logical',
    status: 'Efetivado',
    sourceAccountId: 'a1',
    destinationAccountId: 'a2',
    transferAmount: 45
  });
  const logical = consolidateTreasuryMovements([
    { id: 'income', movementKind: 'entry', entry: 30, exit: 0 },
    ...pair
  ]);

  assert.equal(logical.length, 2);
  assert.equal(logical.filter(isTreasuryTransfer).length, 1);
  assert.equal(logical.find(isTreasuryTransfer)?.transferAmount, 45);
});
