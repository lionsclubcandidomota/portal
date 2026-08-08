import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');
const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

test('Painel de Publicação usa fluxo visual em três etapas e ações claras', async () => {
  const [html, css, controller] = await Promise.all([
    source('index.html'),
    source('assets/css/components/publication-center.css'),
    source('assets/js/modules/publish-center.js')
  ]);

  assert.match(html, /class="sync-header-popover publication-workspace"/);
  assert.match(html, /data-publication-status-count/);
  assert.match(html, /data-sync-step="review"[\s\S]*data-sync-step="send"[\s\S]*data-sync-step="publish"/);
  assert.match(html, /Conferir mudanças/);
  assert.match(html, /Publicar agora/);
  assert.match(css, /\.publication-workspace\s*\{/);
  assert.match(css, /\.publication-status-card\s*\{/);
  assert.match(css, /\.publication-workspace-actions\s*\{/);
  assert.match(controller, /uiIcon\('upload'\)/);
  assert.match(controller, /data-publication-status-count/);
});

test('Tesouraria possui camada responsiva dedicada para celulares', async () => {
  const [css, build] = await Promise.all([
    source('assets/css/pages/treasury-mobile.css'),
    source('tools/build-css.mjs')
  ]);

  assert.match(build, /pages\/treasury-mobile\.css/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /scroll-snap-type:x proximity/);
  assert.match(css, /\.treasury-record-actions\{display:grid!important/);
  assert.match(css, /\.admin-form-actions\{position:sticky/);
  assert.match(css, /\.modal-card:has\(\.admin-entity-form\)/);
});

test('cadastro de Mútuas diferencia associados e mutuários sem quebrar o layout', async () => {
  const [manager, css, build] = await Promise.all([
    source('assets/js/modules/treasury-admin/mutual-groups.js'),
    source('assets/css/pages/mutual-registration.css'),
    source('tools/build-css.mjs')
  ]);

  assert.match(manager, /mutual-member-option \$\{checked \? 'is-selected'/);
  assert.match(manager, /mutual-member-kind \$\{mutualMember \? 'is-mutual' : 'is-associate'\}/);
  assert.match(manager, /mutual-selected-count/);
  assert.match(css, /\.mutual-member-options\{display:grid/);
  assert.match(css, /\.mutual-member-option\.is-mutual/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(build, /pages\/mutual-registration\.css/);
});

test('áreas financeiras e administrativas usam ícones SVG locais em vez de emojis', async () => {
  const files = [
    'assets/js/modules/publication-review.js',
    'assets/js/modules/publish-center.js',
    'assets/js/modules/treasury/mutuals.js',
    'assets/js/modules/treasury/movements.js',
    'assets/js/modules/treasury-admin/accounts.js',
    'assets/js/modules/treasury-admin/attachments.js',
    'assets/js/modules/treasury-admin/sharing.js',
    'assets/js/modules/treasury-admin/family-groups.js',
    'assets/js/modules/treasury-admin/member-selector.js',
    'assets/js/modules/treasury-admin/mutual-events.js',
    'assets/js/modules/treasury-admin/mutual-groups.js',
    'assets/js/modules/treasury-admin/entries.js',
    'assets/js/modules/treasury-admin/membership-payments.js',
    'assets/js/modules/treasury-admin/mutual-payments.js',
    'assets/js/modules/finance-privacy.js'
  ];

  for (const file of files) {
    const content = await source(file);
    assert.equal(emojiPattern.test(content), false, `${file} ainda contém emoji de interface`);
  }
});

test('sprite local contém os ícones necessários à etapa final', async () => {
  const icons = await source('assets/icons/ui-icons.svg');
  for (const icon of [
    'eye-off', 'image', 'file-text', 'chart-bar', 'chart-pie', 'percent',
    'trend-up', 'trend-down', 'message', 'family', 'dove', 'paperclip'
  ]) {
    assert.match(icons, new RegExp(`id="${icon}"`));
  }
});

test('camada mobile e cadastro de Mútuas fazem parte do bundle final', async () => {
  const bundle = await source('assets/css/app.css');
  assert.match(bundle, /Portal Lions v6\.46 — experiência móvel da Tesouraria/);
  assert.match(bundle, /Portal Lions v6\.46 — cadastro de grupos de Mútua/);
  assert.match(bundle, /\.publication-workspace\s*\{/);
});
