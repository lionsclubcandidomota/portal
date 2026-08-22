import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { staticModuleSpecifiers } from '../tools/module-graph-utils.mjs';
import { lazyOnlyModules, performanceBudgets } from '../tools/quality-contracts.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

test('auditoria de desempenho segue reexports estáticos e protege a nova margem', async () => {
  const audit = await source('tools/performance-audit.mjs');
  assert.deepEqual(staticModuleSpecifiers("export { feature } from './feature.js';"), ['./feature.js']);
  assert.equal(performanceBudgets.staticJavaScriptBytes, 310_000);
  assert.equal(performanceBudgets.criticalAssetsBytes, 790_000);
  assert.match(audit, /collectStaticGraph/);
  for (const lazyModule of [
    'assets/js/github-admin.js',
    'assets/js/core/portal-media.js',
    'assets/js/modules/publish-center.js',
    'assets/js/modules/recovery-center/controller.js',
    'assets/js/modules/audit-log/view.js'
  ]) {
    assert.ok(lazyOnlyModules.includes(lazyModule), `${lazyModule} deve permanecer no contrato lazy`);
  }
});

test('revisão de publicação separa cálculo obrigatório da interface carregada sob demanda', async () => {
  const [context, auditLog, reviewUi, reviewDomain] = await Promise.all([
    source('assets/js/modules/portal-runtime/context.js'),
    source('assets/js/modules/audit-log/controller.js'),
    source('assets/js/modules/publication-review.js'),
    source('assets/js/modules/publication-review-domain.js')
  ]);
  assert.match(context, /publication-review-domain\.js/);
  assert.match(auditLog, /publication-review-domain\.js/);
  assert.doesNotMatch(context, /publication-review\.js/);
  assert.match(reviewUi, /export \{ buildPublicationReview \} from '.\/publication-review-domain\.js/);
  assert.match(reviewDomain, /export function buildPublicationReview/);
  assert.doesNotMatch(reviewDomain, /uiIcon/);
});

test('recuperação, publicação, escrita no GitHub e mídia pesada ficam fora do bootstrap', async () => {
  const [portalApp, lazyRecovery, lazyPublish, runtimeController, publication] = await Promise.all([
    source('assets/js/modules/portal-app.js'),
    source('assets/js/modules/lazy-recovery-center.js'),
    source('assets/js/modules/lazy-publish-center.js'),
    source('assets/js/modules/portal-runtime/controller.js'),
    source('assets/js/modules/portal-runtime/publication.js')
  ]);
  assert.match(portalApp, /createLazyRecoveryCenterController/);
  assert.match(portalApp, /createLazyPublishCenterController/);
  assert.doesNotMatch(portalApp, /from ['"]\.\/recovery-center\.js/);
  assert.doesNotMatch(portalApp, /from ['"]\.\/publish-center\.js/);
  assert.match(lazyRecovery, /import\('\.\/recovery-center\.js\?v=/);
  assert.match(lazyPublish, /import\('\.\/publish-center\.js\?v=/);
  assert.match(runtimeController, /import\('\.\.\/\.\.\/github-admin\.js\?v=/);
  assert.match(publication, /import\('\.\.\/\.\.\/core\/portal-media\.js\?v=/);
});
