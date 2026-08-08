import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

test('gerenciador de Mútuas usa contador próprio sem colidir com a seleção de cobranças', async () => {
  const manager = await source('assets/js/modules/treasury-admin/mutual-groups.js');

  assert.match(manager, /data-mutual-group-selected-count/);
  assert.match(manager, /form\?\.querySelector\('\[data-mutual-group-selected-count\]'\)/);
  assert.match(manager, /const number = selectedCount\?\.querySelector\('strong'\)/);
  assert.doesNotMatch(manager, /id="mutualSelectedCount"/);
});

test('estrutura da Tesouraria mantém todos os painéis dentro do contêiner principal', async () => {
  const shell = await source('assets/js/modules/treasury/view-shell.js');

  assert.match(shell, /treasury-mobile-nav-intro/);
  assert.match(shell, /Todas as opções estão disponíveis abaixo/);
  const start = shell.indexOf('function renderTreasuryHub');
  const end = shell.indexOf('function renderPrimaryMovementAction');
  const hubFunction = shell.slice(start, end);
  assert.doesNotMatch(hubFunction, /<\/section><\/div>`/);
  assert.match(hubFunction, /<\/section>`/);
  assert.match(shell, /<\/section><\/div>`;\s*\n}/s);
});

test('navegação móvel da Tesouraria mostra as quatro áreas sem gesto horizontal oculto', async () => {
  const [mobile, bundle] = await Promise.all([
    source('assets/css/pages/treasury-mobile.css'),
    source('assets/css/app.css')
  ]);

  for (const css of [mobile, bundle]) {
    assert.match(css, /\.treasury-mobile-nav-intro\{display:flex/);
    assert.match(css, /\.treasury-hub-grid\.is-simplified\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  }
  assert.doesNotMatch(mobile, /\.treasury-hub-grid\.is-simplified\{display:flex!important/);
});

test('registro de falecimento apresenta participantes em lista responsiva', async () => {
  const manager = await source('assets/js/modules/treasury-admin/mutual-events.js');
  const styles = await source('assets/css/pages/mutual-registration.css');

  assert.match(manager, /full-row mutual-event-participant-preview/);
  assert.match(manager, /mutual-event-participant-list/);
  assert.match(manager, /treasury\.memberIsMutual\(member\)/);
  assert.match(manager, /mutual-event-participant-empty/);
  assert.match(styles, /\.mutual-event-participant-list/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /\.mutual-event-form \.admin-form-actions/);
});

test('modal administrativo sempre reabre no topo', async () => {
  const modal = await source('assets/js/modules/modal.js');

  assert.match(modal, /const resetScrollPosition = \(\) =>/);
  assert.match(modal, /modalBody\.scrollTop = 0/);
  assert.match(modal, /modalCard\.scrollTop = 0/);
  assert.match(modal, /requestAnimationFrame\(resetScrollPosition\)/);
});

test('participantes das Mútuas mantêm altura legível e não são cortados', async () => {
  const styles = await source('assets/css/pages/mutual-registration.css');

  assert.match(styles, /grid-auto-rows:minmax\(84px,max-content\)/);
  assert.match(styles, /\.mutual-member-option\{[\s\S]*min-height:84px!important/);
  assert.match(styles, /\.mutual-member-option-label\{[\s\S]*min-height:84px!important/);
});

test('registro de falecimento ocupa a largura disponível e lista todos os participantes', async () => {
  const [manager, styles] = await Promise.all([
    source('assets/js/modules/treasury-admin/mutual-events.js'),
    source('assets/css/pages/mutual-registration.css')
  ]);

  assert.doesNotMatch(manager, /slice\(0,\s*8\)/);
  assert.doesNotMatch(manager, /participante\(s\) não exibido\(s\)/);
  assert.match(manager, /\$\{members\.map\(member =>/);
  assert.match(styles, /\.mutual-event-form-grid>\.full-row/);
  assert.match(styles, /grid-column:1\/-1!important/);
  assert.match(styles, /\.mutual-event-form \.mutual-event-participants\{[\s\S]*width:100%/);
  assert.match(styles, /justify-content:stretch/);
  assert.match(styles, /\.mutual-event-form \.mutual-event-participant-list\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
