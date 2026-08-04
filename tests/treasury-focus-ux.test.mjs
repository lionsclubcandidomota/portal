import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTreasuryAdminController } from '../assets/js/modules/treasury-admin.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createAdminController() {
  const state = {
    birthdays: [],
    treasury: [],
    settings: {},
    familyGroups: [],
    treasuryAccounts: [],
    treasuryCategories: ['Doação']
  };
  const treasury = {
    accounts: () => [{ id: 'a1', name: 'Conta principal', active: true }],
    categories: () => state.treasuryCategories,
    isProgrammed: () => false,
    isMembershipEntry: () => false,
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

test('tesouraria remove a seção redundante e destaca o novo lançamento em movimentações', async () => {
  const view = await readFile(path.join(projectRoot, 'assets/js/modules/treasury/view-shell.js'), 'utf8');

  assert.doesNotMatch(view, /data-treasury-section="launches"/);
  assert.match(view, /data-treasury-section="movements"/);
  assert.match(view, /Registrar nova movimentação/);
  assert.match(view, /treasury-primary-action-button/);
  assert.doesNotMatch(view, /manageTreasuryCategoriesLaunch|id="manageTreasuryCategories"/);
});

test('gerenciamento de categorias fica integrado ao campo do formulário', () => {
  const html = createAdminController().treasuryEntryFormHtml({});

  assert.match(html, /id="treasuryEntryCategory"/);
  assert.match(html, /id="inlineCategoryToggle"/);
  assert.match(html, /id="inlineCategoryManager"/);
  assert.match(html, /Adicionar/);
  assert.match(html, /Renomear selecionada/);
  assert.match(html, /Excluir selecionada/);
  assert.match(html, /sem interromper o cadastro da movimentação/);
});

test('dashboard financeiro mantém os quatro gráficos com controles de expansão', async () => {
  const view = await readFile(path.join(projectRoot, 'assets/js/modules/treasury/view-shell.js'), 'utf8');

  for (const chartId of ['financeChart', 'cashFlowChart', 'categoryChart', 'accountChart']) {
    assert.match(view, new RegExp(`hostId: '${chartId}'`));
  }
  assert.match(view, /data-treasury-chart-toggle/);
  assert.match(view, /Os gráficos iniciam recolhidos/);
  assert.match(view, /id="treasuryExpandCharts"/);
  assert.match(view, /id="treasuryCollapseCharts"/);
});

test('estilos de foco financeiro estão consolidados e responsivos', async () => {
  const [source, bundle] = await Promise.all([
    readFile(path.join(projectRoot, 'assets/css/pages/treasury-navigation.css'), 'utf8'),
    readFile(path.join(projectRoot, 'assets/css/app.css'), 'utf8')
  ]);

  for (const selector of [
    '.treasury-hub-grid.is-simplified',
    '.treasury-primary-action',
    '.treasury-category-form-field',
    '.inline-category-manager'
  ]) {
    assert.match(source, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(bundle, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /@media\(max-width:520px\)/);
});
