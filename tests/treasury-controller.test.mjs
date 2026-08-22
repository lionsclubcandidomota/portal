import test from 'node:test';
import assert from 'node:assert/strict';
import { createTreasuryController } from '../assets/js/modules/treasury/controller.js';
import {
  normalize,
  parseLocalDate,
  sumTreasury
} from '../assets/js/utils.js';

function createController(state) {
  return createTreasuryController({
    getState: () => state,
    parseLocalDate,
    normalize,
    todayStart: () => new Date(2026, 6, 30),
    sumTreasury,
    pageSize: 2
  });
}

test('inicializa contas padrão sem compartilhar referências mutáveis', () => {
  const firstState = { treasury: [], settings: {}, birthdays: [] };
  const secondState = { treasury: [], settings: {}, birthdays: [] };
  const first = createController(firstState);
  const second = createController(secondState);

  first.accounts()[0].name = 'Conta alterada';
  assert.equal(second.accounts()[0].name, 'Conta corrente');
});

test('categorias usadas são incorporadas e mensalidades não poluem a lista', () => {
  const state = {
    settings: {},
    birthdays: [],
    treasuryCategories: ['Doação'],
    treasury: [
      { entry: 100, category: 'Mensalidades', memberId: 'm1' },
      { exit: 20, category: 'Transporte' }
    ]
  };
  const controller = createController(state);

  assert.deepEqual(controller.categories(), ['Doação', 'Transporte']);
});

test('resumo por conta combina saldo inicial, realizados e programados', () => {
  const state = {
    settings: {},
    birthdays: [],
    treasuryAccounts: [
      { id: 'a1', name: 'Principal', type: 'Conta corrente', initialBalance: 100, active: true }
    ],
    treasury: [
      { accountId: 'a1', entry: 200, exit: 0, status: 'Recebido', date: '2026-07-01' },
      { accountId: 'a1', entry: 0, exit: 50, status: 'Pago', date: '2026-07-02' },
      { accountId: 'a1', entry: 30, exit: 0, status: 'Programado', date: '2026-08-01' }
    ]
  };
  const summary = createController(state).accountSummaries()[0];

  assert.equal(summary.entries, 200);
  assert.equal(summary.exits, 50);
  assert.equal(summary.balance, 250);
  assert.equal(summary.projectedBalance, 280);
});

test('paginação mantém página dentro dos limites', () => {
  const controller = createController({ treasury: [], settings: {}, birthdays: [] });
  const result = controller.pagination([1, 2, 3, 4, 5], 9, 'completed');
  assert.equal(result.page, 3);
  assert.deepEqual(result.visible, [5]);
  assert.match(result.html, /Página <strong>3<\/strong> de 3/);
});

test('gráficos podem ser minimizados individualmente e expandidos em conjunto', () => {
  const controller = createController({ treasury: [], settings: {}, birthdays: [] });

  assert.equal(controller.collapsedChartCount, 4);
  assert.equal(controller.isChartCollapsed('finance'), true);
  assert.equal(controller.isChartCollapsed('cash-flow'), true);
  assert.equal(controller.isChartCollapsed('category'), true);
  assert.equal(controller.isChartCollapsed('account'), true);
  assert.equal(controller.toggleChart('finance'), false);
  assert.equal(controller.isChartCollapsed('finance'), false);
  assert.equal(controller.collapsedChartCount, 3);
  assert.equal(controller.toggleChart('finance'), true);
  assert.equal(controller.collapsedChartCount, 4);

  controller.collapseAllCharts(['finance', 'category']);
  assert.equal(controller.collapsedChartCount, 2);
  controller.expandAllCharts();
  assert.equal(controller.collapsedChartCount, 0);
});

test('movimentações é a seção padrão e estados antigos de lançamentos são migrados', () => {
  const state = { treasury: [], settings: {}, birthdays: [] };
  const defaultController = createController(state);
  assert.equal(defaultController.section, 'movements');

  const migrated = createTreasuryController({
    getState: () => state,
    parseLocalDate,
    normalize,
    todayStart: () => new Date(2026, 6, 30),
    sumTreasury,
    initialSection: 'launches'
  });
  assert.equal(migrated.section, 'movements');
  migrated.section = 'launches';
  assert.equal(migrated.section, 'movements');
});

test('conta padrão de mensalidades prioriza a conta ativa marcada', () => {
  const state = {
    settings: {},
    birthdays: [],
    treasury: [],
    treasuryAccounts: [
      { id: 'a1', name: 'Conta corrente', active: true },
      { id: 'a2', name: 'Aplicação', active: true, membershipDefault: true },
      { id: 'a3', name: 'Inativa', active: false, membershipDefault: true }
    ]
  };

  assert.equal(createController(state).membershipDefaultAccount()?.id, 'a2');
});

test('conta padrão de mensalidades mantém compatibilidade usando a primeira ativa quando não configurada', () => {
  const state = {
    settings: {},
    birthdays: [],
    treasury: [],
    treasuryAccounts: [
      { id: 'a0', name: 'Inativa', active: false },
      { id: 'a1', name: 'Primeira ativa', active: true },
      { id: 'a2', name: 'Segunda ativa', active: true }
    ]
  };

  assert.equal(createController(state).membershipDefaultAccount()?.id, 'a1');
});
