import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

test('publicação usa o ícone de duas setas durante a atualização do portal', async () => {
  const [controller, css] = await Promise.all([
    source('assets/js/modules/publish-center.js'),
    source('assets/css/components/publication-center.css')
  ]);

  assert.match(controller, /status === 'publishing'[\s\S]*?statusIcon\.innerHTML = uiIcon\('refresh'\)/);
  assert.doesNotMatch(controller, /status === 'publishing'[\s\S]*?statusIcon\.innerHTML = uiIcon\('upload'\)/);
  assert.match(css, /\.sync-header\.is-busy \.publish-progress-icon \.ui-icon\{animation:publishCenterSpin/);
  assert.doesNotMatch(css, /\.sync-header\.is-busy \.publish-progress-icon\{animation:publishCenterSpin/);
  assert.doesNotMatch(css, /\.sync-popover-status-icon\.is-busy\{[^}]*animation:/);
});

test('workflow próprio do GitHub Pages usa actions compatíveis com Node 24', async () => {
  const workflow = await source('.github/workflows/pages.yml');

  assert.match(workflow, /actions\/checkout@v5/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(workflow, /branches:\s*\n\s*- main/);
});
