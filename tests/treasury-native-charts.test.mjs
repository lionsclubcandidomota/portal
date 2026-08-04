import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCashFlowSeries,
  buildConicGradient,
  chartPercent,
  renderTreasuryCharts
} from '../assets/js/modules/treasury/charts.js';

test('percentual dos gráficos permanece dentro do intervalo válido', () => {
  assert.equal(chartPercent(25, 100), 25);
  assert.equal(chartPercent(-10, 100), 0);
  assert.equal(chartPercent(200, 100), 100);
  assert.equal(chartPercent(10, 0), 0);
});

test('gradiente circular ignora valores inválidos e não produz NaN', () => {
  const gradient = buildConicGradient([
    { value: 75, color: '#00529b' },
    { value: 25, color: '#f2b705' },
    { value: Number.NaN, color: '#fff' }
  ]);

  assert.match(gradient, /^conic-gradient\(/);
  assert.match(gradient, /#00529b 0\.000% 75\.000%/);
  assert.match(gradient, /#f2b705 75\.000% 100\.000%/);
  assert.doesNotMatch(gradient, /NaN/);
});

test('série do fluxo de caixa ignora programados e calcula acumulado', () => {
  const series = buildCashFlowSeries([
    { date: '2026-07-01', entry: 100, exit: 0, status: 'Recebido' },
    { date: '2026-07-02', entry: 0, exit: 40, status: 'Pago' },
    { date: '2026-07-03', entry: 500, exit: 0, status: 'Programado' }
  ], item => item.status === 'Programado');

  assert.equal(series.length, 2);
  assert.equal(series[0].accumulated, 100);
  assert.equal(series[1].net, -40);
  assert.equal(series[1].accumulated, 60);
});

test('gráficos nativos renderizam entradas, categorias e contas sem biblioteca externa', () => {
  const targets = new Map([
    ['#financeChart', { innerHTML: '' }],
    ['#cashFlowChart', { innerHTML: '' }],
    ['#categoryChart', { innerHTML: '' }],
    ['#accountChart', { innerHTML: '' }]
  ]);
  const token = Symbol('chart');
  const treasury = { chartToken: token };

  renderTreasuryCharts({
    root: { querySelector: selector => targets.get(selector) || null },
    state: { settings: { primaryColor: '#00529b', accentColor: '#f2b705' } },
    treasury: { ...treasury, isProgrammed: item => item.status === 'Programado' },
    treasuryChartToken: token,
    totals: { entries: 1500, exits: 500 },
    accountSummaries: [
      { name: 'Banco', balance: 900 },
      { name: 'Caixa', balance: 100 }
    ],
    categories: [
      ['Mensalidades', { entries: 1500, exits: 0 }],
      ['Eventos', { entries: 0, exits: 500 }]
    ],
    periodItems: [
      { date: '2026-07-01', entry: 1000, exit: 0, status: 'Recebido' },
      { date: '2026-07-10', entry: 500, exit: 0, status: 'Recebido' },
      { date: '2026-07-12', entry: 0, exit: 500, status: 'Pago' }
    ],
    isTreasuryView: () => true
  });

  assert.match(targets.get('#financeChart').innerHTML, /native-donut-layout/);
  assert.match(targets.get('#financeChart').innerHTML, /<svg/);
  assert.match(targets.get('#financeChart').innerHTML, /native-chart-insight/);
  assert.match(targets.get('#financeChart').innerHTML, /native-chart-tooltip/);
  assert.match(targets.get('#financeChart').innerHTML, /Entradas/);
  assert.match(targets.get('#cashFlowChart').innerHTML, /native-flow-chart-shell/);
  assert.match(targets.get('#cashFlowChart').innerHTML, /Resultado acumulado/);
  assert.match(targets.get('#categoryChart').innerHTML, /native-category-overview/);
  assert.match(targets.get('#categoryChart').innerHTML, /Maior movimentação/);
  assert.match(targets.get('#categoryChart').innerHTML, /Mensalidades/);
  assert.match(targets.get('#categoryChart').innerHTML, /Eventos/);
  assert.match(targets.get('#accountChart').innerHTML, /Banco/);
  assert.match(targets.get('#accountChart').innerHTML, /Maior saldo/);
  assert.match([...targets.values()].map(target => target.innerHTML).join(''), /tabindex="0"/);
  assert.doesNotMatch([...targets.values()].map(target => target.innerHTML).join(''), /cdn\.jsdelivr|<canvas/i);
});


test('cor personalizada inválida não é injetada no SVG das contas', () => {
  const targets = new Map([
    ['#financeChart', { innerHTML: '' }],
    ['#cashFlowChart', { innerHTML: '' }],
    ['#categoryChart', { innerHTML: '' }],
    ['#accountChart', { innerHTML: '' }]
  ]);
  const token = Symbol('chart-color');

  renderTreasuryCharts({
    root: { querySelector: selector => targets.get(selector) || null },
    state: { settings: { primaryColor: '" onload="alert(1)' } },
    treasury: { chartToken: token, isProgrammed: () => false },
    treasuryChartToken: token,
    totals: { entries: 100, exits: 20 },
    accountSummaries: [{ name: 'Conta principal', balance: 80 }],
    categories: [['Geral', { entries: 100, exits: 20 }]],
    periodItems: [{ date: '2026-07-01', entry: 100, exit: 20 }],
    isTreasuryView: () => true
  });

  assert.match(targets.get('#accountChart').innerHTML, /stroke="#2563eb"/);
  assert.doesNotMatch(targets.get('#accountChart').innerHTML, /onload=/i);
});

test('token antigo impede que uma renderização atrasada altere a tela atual', () => {
  const target = { innerHTML: 'conteúdo atual' };
  renderTreasuryCharts({
    root: { querySelector: () => target },
    state: { settings: {} },
    treasury: { chartToken: Symbol('novo') },
    treasuryChartToken: Symbol('antigo'),
    totals: { entries: 1, exits: 1 },
    accountSummaries: [],
    categories: [],
    isTreasuryView: () => true
  });

  assert.equal(target.innerHTML, 'conteúdo atual');
});
