import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { lazyEntryModules, lazyOnlyModules, performanceBudgets } from '../tools/quality-contracts.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

test('pipeline oficial executa auditoria dedicada de lazy loading', async () => {
  const packageJson = JSON.parse(await source('package.json'));
  assert.equal(packageJson.scripts['audit:lazy'], 'node tools/lazy-loading-audit.mjs');
  assert.match(packageJson.scripts.quality, /audit:modules && npm run audit:lazy && npm run audit:integrated/);
});

test('contratos finais centralizam orçamento e fronteiras lazy', async () => {
  assert.deepEqual(performanceBudgets, {
    staticJavaScriptBytes: 310_000,
    cssBytes: 444_000,
    optimizedLogoBytes: 60_000,
    criticalAssetsBytes: 790_000
  });
  assert.ok(lazyEntryModules.length >= 19);
  assert.ok(lazyOnlyModules.length >= lazyEntryModules.length);
  for (const entry of lazyEntryModules) assert.ok(lazyOnlyModules.includes(entry));
});

test('auditoria lazy protege versão de cache, entradas dinâmicas e bootstrap', async () => {
  const audit = await source('tools/lazy-loading-audit.mjs');
  assert.match(audit, /expectedVersion/);
  assert.match(audit, /URLSearchParams/);
  assert.match(audit, /não possui ponto de entrada dinâmico ativo/);
  assert.match(audit, /deixou de ser lazy e voltou ao bootstrap/);
});

test('documentação encerra o ciclo com os contratos de estabilização', async () => {
  const [release, refactoring, lazyDoc, homologation] = await Promise.all([
    source('RELEASE.md'),
    source('REFACTORING.md'),
    source('docs/lazy-loading.md'),
    source('docs/homologation.md')
  ]);
  assert.match(release, /etapa 4/i);
  assert.match(refactoring, /etapa 4/i);
  assert.match(lazyDoc, /v6\.46\.7/);
  assert.match(lazyDoc, /audit:lazy/);
  assert.match(homologation, /audit:lazy/);
});
