import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTreasuryEntryFormHtml } from '../assets/js/modules/treasury-admin/entry-form-ui.js';
import {
  TREASURY_BANK_YIELD_CATEGORY,
  TREASURY_ENTRY_MODE,
  calculateBankYieldAdjustment,
  isBankYieldEntry
} from '../assets/js/modules/treasury/movement-domain.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');
const accounts = [{ id: 'a1', name: 'Conta corrente', active: true }];

function form(item = {}) {
  return buildTreasuryEntryFormHtml({
    item,
    accounts,
    categories: ['Doações', TREASURY_BANK_YIELD_CATEGORY],
    isProgrammed: () => false
  });
}

test('rendimento bancário calcula somente a diferença positiva entre os saldos', () => {
  const result = calculateBankYieldAdjustment({ portalBalance: 5198.70, reportedBalance: 5199.70 });
  assert.equal(result.portalBalance, 5198.70);
  assert.equal(result.reportedBalance, 5199.70);
  assert.equal(result.amount, 1);
  assert.equal(result.isPositive, true);

  const lower = calculateBankYieldAdjustment({ portalBalance: 5198.70, reportedBalance: 5190.70 });
  assert.equal(lower.amount, -8);
  assert.equal(lower.isPositive, false);
});

test('formulário de entrada oferece modo de rendimento bancário e saldo informado', () => {
  const html = form({ movementKind: 'entry', entryMode: TREASURY_ENTRY_MODE.BANK_YIELD, bankReportedBalance: 5199.70, entry: 1 });
  assert.match(html, /name="entryMode"/);
  assert.match(html, /value="bank-yield"[^>]*selected/);
  assert.match(html, /name="bankReportedBalance"/);
  assert.match(html, /Rendimento calculado/);
  assert.match(html, /Calcular pelo saldo do banco/);
});

test('lançamento de rendimento mantém metadados auditáveis sem criar campo de usuário no formulário', async () => {
  const entries = await source('assets/js/modules/treasury-admin/entries.js');
  assert.match(entries, /calculateBankYieldAdjustment/);
  assert.match(entries, /rawData\.bankBalanceBefore = adjustment\.portalBalance/);
  assert.match(entries, /rawData\.bankReportedBalance = adjustment\.reportedBalance/);
  assert.match(entries, /rawData\.category = TREASURY_BANK_YIELD_CATEGORY/);
  assert.match(entries, /rawData\.statusMode = 'Efetivado'/);
  assert.doesNotMatch(form({ movementKind: 'entry' }), /name="responsibleUser"|name="userResponsible"/i);
  assert.equal(isBankYieldEntry({ movementKind: 'entry', entryMode: 'bank-yield', entry: 1 }), true);
});

test('modo claro é o padrão e o modo escuro continua alternável e salvo no navegador', async () => {
  const [html, app, tokens, darkCss, build] = await Promise.all([
    source('index.html'),
    source('assets/js/app.js'),
    source('assets/css/tokens.css'),
    source('assets/css/components/dark-theme.css'),
    source('tools/build-css.mjs')
  ]);
  assert.match(html, /id="themeToggle"/);
  assert.match(app, /lions\.portal\.theme/);
  assert.match(app, /localStorage\.setItem\(PORTAL_THEME_KEY/);
  assert.match(app, /storedTheme\(\) \|\| 'light'/);
  assert.doesNotMatch(app, /prefers-color-scheme: dark/);
  assert.match(app, /document\.documentElement\.dataset\.theme/);
  assert.match(tokens, /html\[data-theme="dark"\]/);
  assert.match(darkCss, /\.theme-toggle/);
  assert.match(build, /components\/dark-theme\.css/);
});
