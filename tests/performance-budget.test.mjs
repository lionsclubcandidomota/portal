import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

test('logotipo leve é usado no carregamento inicial sem remover o original', async () => {
  const html = await source('index.html');
  const optimized = await stat(path.join(projectRoot, 'public/logo-ui.webp'));
  const original = await stat(path.join(projectRoot, 'public/logo.png'));

  assert.match(html, /src="\.\/public\/logo-ui\.webp"/);
  assert.match(html, /width="44" height="44"/);
  assert.ok(optimized.size < 60_000);
  assert.ok(original.size > optimized.size);
});

test('arte de aniversário é carregada apenas quando o usuário solicita', async () => {
  const portalApp = await source('assets/js/modules/portal-app.js');
  const lazyArtwork = await source('assets/js/modules/lazy-birthday-artwork.js');
  const indexHtml = await source('index.html');
  const packageJson = JSON.parse(await source('package.json'));

  assert.doesNotMatch(portalApp, /from ['"]\.\/birthday-artwork\.js/);
  assert.match(portalApp, /createLazyBirthdayArtworkShare/);
  assert.match(lazyArtwork, new RegExp(`import\\('\\.\\/birthday-artwork\\.js\\?v=${packageJson.version.replaceAll('.', '\\.')}'\\)`));
  assert.doesNotMatch(indexHtml, /birthday-template\.png/);
});

test('fotos das listas usam carregamento tardio e dimensões estáveis', async () => {
  const helpers = await source('assets/js/modules/visual-helpers.js');
  assert.match(helpers, /loading="lazy"/);
  assert.match(helpers, /decoding="async"/);
  assert.match(helpers, /width="40" height="40"/);
  assert.match(helpers, /srcset=/);
  assert.match(helpers, /fetchpriority="low"/);
});

test('orçamento de desempenho faz parte da validação oficial', async () => {
  const packageJson = JSON.parse(await source('package.json'));
  const audit = await source('tools/performance-audit.mjs');

  assert.equal(packageJson.scripts['audit:performance'], 'node tools/performance-audit.mjs');
  assert.equal(packageJson.scripts.check, 'npm run quality');
  assert.match(packageJson.scripts.quality, /audit:performance/);
  assert.equal(packageJson.scripts['audit:media'], 'node tools/media-audit.mjs');
  assert.match(packageJson.scripts.quality, /audit:media/);
  assert.match(audit, /staticJavaScriptBytes:\s*220_000/);
  assert.match(audit, /criticalAssetsBytes:\s*655_000/);
});


test('áreas pesadas permanecem fora do grafo inicial', async () => {
  const portalApp = await source('assets/js/modules/portal-app.js');
  const renderer = await source('assets/js/modules/portal-view-renderer.js');
  const lazyEntities = await source('assets/js/modules/lazy-entity-actions.js');
  const lazyAdmin = await source('assets/js/modules/lazy-admin-panel.js');
  const lazyTreasury = await source('assets/js/modules/lazy-treasury-controller.js');

  for (const forbidden of ['./treasury/controller.js', './treasury-admin.js', './entity-forms.js', './admin-panel.js', './reports/controller.js']) {
    assert.doesNotMatch(portalApp, new RegExp(`from ['\"]${forbidden.replaceAll('.', '\\.')}[?'"]`));
  }
  const packageJson = JSON.parse(await source('package.json'));
  const version = packageJson.version.replaceAll('.', '\\.');
  assert.match(lazyEntities, new RegExp(`import\\('\\.\\/treasury-admin\\.js\\?v=${version}'\\)`));
  assert.match(lazyEntities, new RegExp(`import\\('\\.\\/entity-forms\\.js\\?v=${version}'\\)`));
  assert.match(lazyAdmin, new RegExp(`import\\('\\.\\/admin-panel\\.js\\?v=${version}'\\)`));
  assert.match(renderer, new RegExp(`import\\('\\.\\/agenda\\.js\\?v=${version}'\\)`));
  assert.match(renderer, new RegExp(`import\\('\\.\\/treasury\\/view\\.js\\?v=${version}'\\)`));
  assert.match(lazyTreasury, new RegExp(`import\\('\\.\\/treasury\\/controller\\.js\\?v=${version}'\\)`));
});
