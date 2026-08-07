import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cacheVersionsFromSource,
  synchronizeCacheVersions
} from '../tools/sync-version.mjs';
import {
  collectSiteFiles,
  collectSourceFiles,
  collectWorkerFiles,
  isSecretOrLocalConfig
} from '../tools/release-files.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('sincronizador reconhece e corrige sufixos de cache com quatro partes', () => {
  const source = '<script src="app.js?v=6.29.0.1"></script><link href="app.css?v=6.29.0">';
  assert.deepEqual(cacheVersionsFromSource(source), ['6.29.0.1', '6.29.0']);
  assert.equal(
    synchronizeCacheVersions(source, '6.30.0'),
    '<script src="app.js?v=6.30.0"></script><link href="app.css?v=6.30.0">'
  );
});

test('layout de release separa site, Worker e código-fonte', async () => {
  const siteFiles = await collectSiteFiles(projectRoot);
  const workerFiles = await collectWorkerFiles(projectRoot);
  const sourceFiles = await collectSourceFiles(projectRoot);

  assert.ok(siteFiles.includes('index.html'));
  assert.ok(siteFiles.includes('assets/css/app.css'));
  assert.ok(siteFiles.includes('assets/js/app.js'));
  assert.ok(siteFiles.includes('data/dados.json'));
  assert.equal(siteFiles.includes('data/modelo.json'), false);
  assert.equal(siteFiles.some(file => file.startsWith('tests/')), false);
  assert.equal(siteFiles.some(file => file.startsWith('tools/')), false);
  assert.ok(workerFiles.includes('src/index.js'));
  assert.ok(sourceFiles.includes('tests/release-pipeline.test.mjs'));
  assert.ok(sourceFiles.includes('tools/release-build.mjs'));
  assert.ok(sourceFiles.includes('.github/workflows/quality-gates.yml'));
  assert.ok(sourceFiles.includes('.github/workflows/release-artifacts.yml'));
});

test('arquivos locais e secretos nunca entram nos pacotes', () => {
  for (const file of [
    'wrangler.toml',
    'cloudflare/attachment-worker/wrangler.toml',
    '.env',
    '.env.production',
    '.dev.vars',
    'cloudflare/attachment-worker/.dev.vars.local'
  ]) {
    assert.equal(isSecretOrLocalConfig(file), true, file);
  }
});

test('package expõe um pipeline completo e verificável de release', async () => {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.match(packageJson.scripts.check, /npm test/);
  assert.match(packageJson.scripts['release:build'], /release-build\.mjs/);
  assert.match(packageJson.scripts['release:dist:verify'], /release-dist-verify\.mjs/);
  assert.match(packageJson.releaseTimestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
