import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTreasuryEntryFormHtml } from '../assets/js/modules/treasury-admin/entry-form-ui.js';
import { normalizeTreasuryEntryPayload } from '../assets/js/modules/treasury-admin/domain.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const accounts = [
  { id: 'a1', name: 'Conta corrente', active: true },
  { id: 'a2', name: 'Caixa', active: true }
];

function form(item = {}) {
  return buildTreasuryEntryFormHtml({
    item,
    accounts,
    categories: ['Doação', 'Manutenção'],
    isProgrammed: () => false
  });
}

test('movimentações oferecem atalhos explícitos para entrada, saída e transferência', async () => {
  const view = await readFile(path.join(projectRoot, 'assets/js/modules/treasury/view-shell.js'), 'utf8');
  assert.match(view, /data-new-treasury-kind="entry"/);
  assert.match(view, /data-new-treasury-kind="exit"/);
  assert.match(view, /data-new-treasury-kind="transfer"/);
});

test('formulário usa uma única entrada de valor para receita ou despesa', () => {
  const html = form({ movementKind: 'entry' });
  assert.match(html, /value="entry"[^>]*checked/);
  assert.match(html, /name="amount"/);
  assert.doesNotMatch(html, /name="entry"/);
  assert.doesNotMatch(html, /name="exit"/);
  assert.match(html, /Valor da entrada/);
});

test('transferência mostra origem, destino e valor próprio', () => {
  const html = form({ movementKind: 'transfer' });
  assert.match(html, /value="transfer"[^>]*checked/);
  assert.match(html, /name="sourceAccountId"/);
  assert.match(html, /name="destinationAccountId"/);
  assert.match(html, /name="transferAmount"/);
});

test('normalização converte valor único para entrada ou saída corretamente', () => {
  const income = normalizeTreasuryEntryPayload({ movementKind: 'entry', accountId: 'a1', category: 'Doação', amount: '75' });
  const expense = normalizeTreasuryEntryPayload({ movementKind: 'exit', accountId: 'a1', category: 'Manutenção', amount: '20' });
  assert.equal(income.data.entry, 75);
  assert.equal(income.data.exit, 0);
  assert.equal(expense.data.entry, 0);
  assert.equal(expense.data.exit, 20);
});
