import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMembershipChargeMessage, buildFamilyMembershipChargeMessage } from '../assets/js/modules/treasury-admin/domain.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('cobrança individual pode cobrar apenas saldo anterior sem criar competências retroativas', () => {
  const message = buildMembershipChargeMessage({
    memberName: 'Ana Teste',
    monthLabels: [],
    openingDebt: 120,
    expectedTotal: 120,
    clubName: 'Lions Clube de Teste'
  });

  assert.match(message, /saldo anterior em aberto de R\$\s*120,00/);
  assert.match(message, /total estimado em aberto é R\$\s*120,00/);
  assert.doesNotMatch(message, /referente a/);
});

test('cobrança familiar soma saldo anterior e competências sem duplicar o débito', () => {
  const message = buildFamilyMembershipChargeMessage({
    familyName: 'Família Teste',
    clubName: 'Lions Clube de Teste',
    memberCharges: [
      { memberName: 'Ana', monthLabels: ['agosto de 2026'], openingDebt: 70, expectedTotal: 120 },
      { memberName: 'Bruno', monthLabels: [], openingDebt: 30, expectedTotal: 30 }
    ]
  });

  assert.match(message, /Ana: saldo anterior R\$\s*70,00 \+ agosto de 2026 — R\$\s*120,00/);
  assert.match(message, /Bruno: saldo anterior R\$\s*30,00 — R\$\s*30,00/);
  assert.match(message, /Total estimado: R\$\s*150,00/);
});

test('valores em aberto das mensalidades usam a mesma proteção do olho financeiro', async () => {
  const memberships = await readFile(path.join(projectRoot, 'assets/js/modules/treasury/memberships.js'), 'utf8');
  assert.match(memberships, /sensitive-money membership-outstanding-value/);
  assert.match(memberships, /Saldo anterior em aberto<\/small><strong class="sensitive-money"/);
  assert.doesNotMatch(memberships, /Configurado:\s*\$\{escapeHtml\(money\.format\(progress\.openingDebt\)\)\}/);
});

test('baixa permite abater saldo anterior antes das competências mensais', async () => {
  const payments = await readFile(path.join(projectRoot, 'assets/js/modules/treasury-admin/membership-payments.js'), 'utf8');
  assert.match(payments, /name="includeOpeningDebt"/);
  assert.match(payments, /membershipOpeningDebtAllocations/);
  assert.match(payments, /requestedAmount - openingAmount/);
});
