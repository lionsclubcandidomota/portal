import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('movimentações expõem contexto e métricas próprias para o mobile', async () => {
  const source = await readFile(path.join(projectRoot, 'assets/js/modules/treasury/movements.js'), 'utf8');
  assert.match(source, /treasury-summary-mobile-context/);
  assert.match(source, /treasury-summary-mobile-metrics/);
  assert.match(source, /Valor da movimentação/);
  assert.match(source, /Saldo previsto ao fim do dia/);
  assert.match(source, /Saldo ao fim do dia/);
  assert.match(source, /mobileBalanceSummary/);
});

test('tesouraria mobile organiza contexto e valores em blocos previsíveis', async () => {
  const css = await readFile(path.join(projectRoot, 'assets/css/pages/treasury-mobile.css'), 'utf8');
  assert.match(css, /treasury-summary-mobile-context,.treasury-summary-mobile-metrics\{display:none!important\}/);
  assert.match(css, /"context context context"/);
  assert.match(css, /"metrics metrics metrics"/);
  assert.match(css, /treasury-record-value-stack\{display:none!important\}/);
  assert.match(css, /#accountChart\.native-chart-host\{min-width:0!important/);
  assert.match(css, /treasury-summary-mobile-metrics\{grid-area:metrics!important;display:grid!important;grid-template-columns:1fr!important/);
  assert.match(css, /treasury-mobile-balance-note\{display:flex!important/);
  assert.match(css, /font-size:\.54rem!important/);
});

test('regras mobile legadas conflitantes foram removidas de responsive-workflows', async () => {
  const css = await readFile(path.join(projectRoot, 'assets/css/pages/responsive-workflows.css'), 'utf8');
  assert.doesNotMatch(css, /@media\s*\(max-width:760px\)\{\.treasury-record-card\{border-left-width/);
  assert.doesNotMatch(css, /@media\s*\(max-width:700px\)\{\.treasury-record-card\.is-membership/);
});
