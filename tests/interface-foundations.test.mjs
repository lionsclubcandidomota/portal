import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

test('ajustes e revisão de publicação ficam fora do carregamento inicial', async () => {
  const packageJson = JSON.parse(await source('package.json'));
  const version = packageJson.version.replaceAll('.', '\\.');
  const portalApp = await source('assets/js/modules/portal-app.js');
  const lazySettings = await source('assets/js/modules/lazy-settings.js');
  const reviewController = await source('assets/js/modules/publication-review-controller.js');

  assert.doesNotMatch(portalApp, /from ['"]\.\/settings\.js/);
  assert.doesNotMatch(reviewController, /^import .*publication-review\.js/m);
  assert.match(lazySettings, new RegExp(`import\\('\\.\\/settings\\.js\\?v=${version}'\\)`));
  assert.match(reviewController, new RegExp(`import\\('\\.\\/publication-review\\.js\\?v=${version}'\\)`));
  assert.match(portalApp, /createLazySettingsController/);
});

test('shell principal usa ícones SVG locais e acessíveis', async () => {
  const html = await source('index.html');
  const sprite = await source('assets/icons/ui-icons.svg');
  const navigation = await source('assets/js/modules/navigation.js');

  await access(path.join(projectRoot, 'assets/icons/ui-icons.svg'));
  for (const icon of ['home', 'cake', 'wallet', 'calendar', 'megaphone', 'receipt', 'heart', 'lock', 'settings', 'menu']) {
    assert.match(sprite, new RegExp(`id="${icon}"`));
  }
  for (const icon of ['home', 'cake', 'wallet', 'calendar', 'megaphone', 'lock', 'settings', 'menu']) {
    assert.match(html, new RegExp(`ui-icons\\.svg#${icon}`));
  }
  assert.match(html, /<svg class="ui-icon" aria-hidden="true" focusable="false">/);
  assert.match(navigation, /directorMode \? 'eye' : userMode \? 'users' : access\.authenticated \? 'tools' : 'lock'/);
  const dashboard = await source('assets/js/modules/dashboard.js');
  assert.match(dashboard, /uiIcon\('receipt'/);
  assert.match(dashboard, /uiIcon\('heart'/);
});

test('orçamento CSS registra a redução de sobrescritas da etapa', async () => {
  const audit = await source('tools/css-audit.mjs');
  assert.match(audit, /maxRepeatedContextSelectors:\s*350/);
  assert.match(audit, /maxOverrideRules:\s*450/);
  assert.match(audit, /maxBundleBytes:\s*444_000/);
});


test('auditoria visual opcional não bloqueia ambientes com navegador incompatível', async () => {
  const visualAudit = await source('tools/visual-audit.mjs');
  assert.match(visualAudit, /if \(required\) throw error/);
  assert.match(visualAudit, /Auditoria visual ignorada: o navegador encontrado não conseguiu concluir/);
});
