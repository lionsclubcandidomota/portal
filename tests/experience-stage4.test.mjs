import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTreasuryController } from '../assets/js/modules/treasury/controller.js';
import { buildFamilyMembershipChargeMessage } from '../assets/js/modules/treasury-admin/domain.js';
import { normalize, parseLocalDate, sumTreasury } from '../assets/js/utils.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

function createController() {
  const state = { treasury: [], settings: {}, birthdays: [] };
  return createTreasuryController({
    getState: () => state,
    parseLocalDate,
    normalize,
    todayStart: () => new Date(2026, 7, 7),
    sumTreasury,
    pageSize: 8
  });
}

test('filtros, pesquisa, páginas e recolhimento de programados permanecem no controlador', () => {
  const controller = createController();
  controller.movementFilter = 'overdue';
  controller.movementSearch = 'evento beneficente';
  controller.scheduledPage = 3;
  controller.completedPage = 2;
  controller.scheduledExpanded = false;

  assert.equal(controller.movementFilter, 'overdue');
  assert.equal(controller.movementSearch, 'evento beneficente');
  assert.equal(controller.scheduledPage, 3);
  assert.equal(controller.completedPage, 2);
  assert.equal(controller.scheduledExpanded, false);
  assert.equal(controller.toggleScheduledExpanded(), true);

  controller.reset();
  assert.equal(controller.movementFilter, 'all');
  assert.equal(controller.movementSearch, '');
  assert.equal(controller.scheduledPage, 1);
  assert.equal(controller.completedPage, 1);
  assert.equal(controller.scheduledExpanded, true);
});

test('mensagem familiar reúne integrantes, meses e total estimado', () => {
  const text = buildFamilyMembershipChargeMessage({
    familyName: 'Família Silva',
    clubName: 'Lions Teste',
    memberCharges: [
      { memberName: 'Ana Silva', monthLabels: ['julho de 2026'], expectedTotal: 50 },
      { memberName: 'Carlos Silva', monthLabels: ['julho de 2026', 'agosto de 2026'], expectedTotal: 70 }
    ]
  });

  assert.match(text, /Olá, família Família Silva!/);
  assert.match(text, /Ana Silva: julho de 2026 — R\$\s*50,00/);
  assert.match(text, /Carlos Silva: julho de 2026, agosto de 2026 — R\$\s*70,00/);
  assert.match(text, /Total estimado: R\$\s*120,00/);
  assert.match(text, /Tesouraria do Lions Teste/);
});

test('cobrança oferece envio individual ou para toda a família', async () => {
  const [sharing, memberships] = await Promise.all([
    source('assets/js/modules/treasury-admin/sharing.js'),
    source('assets/js/modules/treasury/memberships.js')
  ]);

  assert.match(sharing, /data-membership-charge-target="member"/);
  assert.match(sharing, /data-membership-charge-target="family"/);
  assert.match(sharing, /Somente o associado/);
  assert.match(sharing, /Toda a família/);
  assert.match(sharing, /familyGroupForMember/);
  assert.match(memberships, /Escolher associado ou família/);
});

test('gráficos abrem pelo próprio card e continuam acessíveis pelo teclado', async () => {
  const [shell, charts] = await Promise.all([
    source('assets/js/modules/treasury/view-shell.js'),
    source('assets/js/modules/treasury/view-charts.js')
  ]);

  assert.match(shell, /data-treasury-chart-card="\$\{id\}"[^>]*aria-expanded/);
  assert.match(shell, /data-treasury-chart-card="\$\{id\}"[^>]*tabindex="0"/);
  assert.match(charts, /card\.addEventListener\('click', expandCard\)/);
  assert.match(charts, /card\.addEventListener\('keydown', expandCard\)/);
  assert.match(charts, /\['Enter', ' '\]\.includes\(event\.key\)/);
});

test('programados podem ser recolhidos e edição restaura o contexto da Tesouraria', async () => {
  const [movements, entries, app, lazyActions] = await Promise.all([
    source('assets/js/modules/treasury/movements.js'),
    source('assets/js/modules/treasury-admin/entries.js'),
    source('assets/js/modules/portal-app.js'),
    source('assets/js/modules/lazy-entity-actions.js')
  ]);

  assert.match(movements, /data-scheduled-toggle/);
  assert.match(movements, /treasury\.toggleScheduledExpanded\(\)/);
  assert.match(movements, /treasury\.movementFilter/);
  assert.match(movements, /treasury\.movementSearch/);
  assert.match(movements, /filterButton\('overdue', 'Vencidas'\)/);
  assert.match(entries, /captureInterfaceContext\?\.\(\)/);
  assert.match(entries, /restoreInterfaceContext\?\.\(interfaceSnapshot/);
  assert.match(entries, /renderTreasuryView\(\)/);
  assert.match(app, /captureInterfaceContext: interfaceContext\.capture/);
  assert.match(lazyActions, /restoreInterfaceContext/);
});

test('camada visual da Tesouraria usa acabamento leve e responsivo', async () => {
  const css = await source('assets/css/components/modern-interface.css');
  assert.match(css, /Evolução funcional — etapa 4: Tesouraria e cobranças/);
  assert.match(css, /\.treasury-experience\{/);
  assert.match(css, /treasury-chart-card\.is-collapsed/);
  assert.match(css, /treasury-chart-card\[aria-expanded=true\]\{grid-column:span 6\}/);
  assert.match(css, /@media\(max-width:900px\)\{\.treasury-experience \.treasury-chart-card\[aria-expanded=true\]\{grid-column:span 12\}/);
  assert.match(css, /treasury-scheduled-section\.is-collapsed/);
  assert.match(css, /\.membership-charge-choice-grid/);
  assert.match(css, /@media\(max-width:700px\)/);
});
