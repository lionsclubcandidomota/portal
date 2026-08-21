import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { accountBalanceChart } from '../assets/js/modules/treasury/account-balance-chart.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('gráfico de saldo por conta mantém todos os blocos em uma única coluna estrutural', async () => {
  const css = await readFile(path.join(projectRoot, 'assets/css/components/native-charts.css'), 'utf8');
  assert.match(css, /native-account-balance-shell>\*\{grid-column:1\/-1\}/);
  assert.match(css, /native-donut-layout>\.native-chart-insight\{grid-column:2\}/);
  assert.doesNotMatch(css, /}\.native-chart-insight\{grid-column:2\}/);
});

test('cards do gráfico distinguem saldo atual, projetado e situação da conta', () => {
  const html = accountBalanceChart([
    { name: 'Conta corrente', balance: -120, projectedBalance: -80, active: true },
    { name: 'Aplicação', balance: 500, projectedBalance: 620, active: true }
  ]);
  assert.match(html, /native-account-balance-values/);
  assert.match(html, /Saldo atual/);
  assert.match(html, /Saldo projetado/);
  assert.match(html, />Negativa</);
  assert.match(html, />Positiva</);
});
