import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTreasuryAdminController } from '../assets/js/modules/treasury-admin.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createController() {
  const state = {
    birthdays: [],
    treasury: [],
    settings: {},
    familyGroups: [],
    treasuryAccounts: [],
    treasuryCategories: []
  };
  const treasury = {
    accounts: () => [{ id: 'a1', name: 'Conta principal', active: true }],
    categories: () => ['Doação'],
    isProgrammed: item => item?.status === 'Programado',
    familyGroupForMember: () => null
  };

  return createTreasuryAdminController({
    getState: () => state,
    treasury,
    modalController: { body: {}, open() {} },
    confirmation: { askConfirmation: async () => true },
    persist() {},
    renderTreasuryView() {},
    renderCurrentView() {},
    closeModal() {},
    toast() {},
    avatar: () => '',
    empty: () => ''
  });
}

test('novo lançamento financeiro exige escolha manual da data', () => {
  const html = createController().treasuryEntryFormHtml({});

  assert.match(html, /name="date" type="date" value=""/);
  assert.match(html, /Data sem preenchimento automático/);
  assert.doesNotMatch(html, /toInputDate|new Date\(\)/);
});

test('edição preserva a data já cadastrada', () => {
  const html = createController().treasuryEntryFormHtml({
    id: 't1',
    date: '2026-09-12',
    accountId: 'a1',
    category: 'Doação'
  });

  assert.match(html, /name="date" type="date" value="2026-09-12"/);
});

test('baixa de mensalidade inicia sem data e sem mês previamente marcado', async () => {
  const source = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/membership-payments.js'),
    'utf8'
  );

  assert.match(source, /name="paymentDate" type="date" value=""/);
  assert.match(source, />0 meses selecionados</);
  assert.match(source, /id="membershipPaymentSubmit"[^>]*disabled/);
  assert.doesNotMatch(source, /defaultMonth/);
  assert.doesNotMatch(source, /paymentDate'\) \|\| today/);
});

test('baixa de mensalidade oferece rateio por valor e cobrança usa somente saldo em aberto', async () => {
  const paymentSource = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/membership-payments.js'),
    'utf8'
  );
  const sharingSource = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/sharing.js'),
    'utf8'
  );

  assert.match(paymentSource, /value="allocate">Ratear um valor recebido/);
  assert.match(paymentSource, /allocateMembershipPayment/);
  assert.doesNotMatch(paymentSource, /Selecionar pendentes|membershipSelectPending/);
  assert.match(paymentSource, /membership-payment-months-section/);
  assert.match(sharingSource, /membershipOutstandingForMonth/);
});
