import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderHtmlIfChanged } from '../assets/js/modules/visual-helpers.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

test('renderização incremental evita substituir HTML idêntico', () => {
  let writes = 0;
  let current = '';
  const element = {
    get innerHTML() { return current; },
    set innerHTML(value) { writes += 1; current = value; }
  };

  assert.equal(renderHtmlIfChanged(element, '<p>Um</p>'), true);
  assert.equal(renderHtmlIfChanged(element, '<p>Um</p>'), false);
  assert.equal(renderHtmlIfChanged(element, '<p>Dois</p>'), true);
  assert.equal(writes, 2);
  assert.equal(current, '<p>Dois</p>');
});

test('listas com atualização frequente usam renderização incremental', async () => {
  const files = await Promise.all([
    source('assets/js/modules/birthdays.js'),
    source('assets/js/modules/notices.js'),
    source('assets/js/modules/treasury/movements.js'),
    source('assets/js/modules/treasury/charts.js')
  ]);

  for (const content of files) {
    assert.match(content, /renderHtmlIfChanged/);
  }
});

test('painel administrativo e navegação financeira usam ícones SVG locais', async () => {
  const adminView = await source('assets/js/modules/admin-dashboard/view.js');
  const treasuryView = await source('assets/js/modules/treasury/view-shell.js');
  const sprite = await source('assets/icons/ui-icons.svg');

  for (const icon of ['plus', 'handshake', 'file-text', 'printer', 'download', 'upload', 'lifebuoy', 'history', 'bank', 'transfer', 'users', 'search']) {
    assert.match(sprite, new RegExp(`id="${icon}"`));
  }

  assert.match(adminView, /uiIcon\('lifebuoy'\)/);
  assert.match(adminView, /uiIcon\('printer'\)/);
  assert.match(treasuryView, /uiIcon\('transfer'\)/);
  assert.match(treasuryView, /uiIcon\('bank'\)/);
  assert.doesNotMatch(adminView, /🖨️|⬇️ Baixar CSV|🛟|🛠️|👁️/);
});

test('estado de carregamento deixa a camada visual final e passa ao componente correto', async () => {
  const modern = await source('assets/css/components/modern-interface.css');
  const interaction = await source('assets/css/components/interaction-foundation.css');

  assert.doesNotMatch(modern, /\.feature-loading\s*\{/);
  assert.match(interaction, /\.feature-loading\s*\{/);
  assert.match(interaction, /\.feature-loading-spinner\s*\{/);
});
