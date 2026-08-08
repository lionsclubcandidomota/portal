import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createLocalBackup } from '../tools/create-local-backup.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

async function exists(relativePath) {
  try {
    await stat(path.join(projectRoot, relativePath));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

test('grafo oficial bloqueia módulos órfãos e faz parte dos portões de qualidade', async () => {
  const packageJson = JSON.parse(await source('package.json'));
  const audit = await source('tools/module-graph-audit.mjs');

  assert.equal(packageJson.scripts['audit:modules'], 'node tools/module-graph-audit.mjs');
  assert.match(packageJson.scripts.quality, /npm run audit:modules/);
  assert.match(audit, /módulo sem uso no Portal/);
  assert.match(audit, /dependência circular/);
  assert.equal(await exists('assets/js/modules/treasury.js'), false);
  assert.equal(await exists('assets/js/modules/treasury-admin/categories.js'), false);
});

test('backup local preserva os JSONs e mantém somente a retenção configurada', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'portal-backup-test-'));
  await mkdir(path.join(temporaryRoot, 'data'), { recursive: true });
  await writeFile(path.join(temporaryRoot, 'package.json'), JSON.stringify({ version: '9.9.9' }), 'utf8');
  await writeFile(path.join(temporaryRoot, 'data', 'dados.json'), '{"schemaVersion":10}\n', 'utf8');
  await writeFile(path.join(temporaryRoot, 'data', 'modelo.json'), '{"schemaVersion":10,"data":{}}\n', 'utf8');

  for (let index = 0; index < 4; index += 1) {
    await createLocalBackup({
      projectRoot: temporaryRoot,
      keep: 2,
      now: new Date(Date.UTC(2026, 7, 7, 18, 0, index))
    });
  }

  const backupsRoot = path.join(temporaryRoot, '.portal-backups');
  const backups = (await readdir(backupsRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  assert.equal(backups.length, 2);

  const latest = path.join(backupsRoot, backups.at(-1));
  assert.equal(await readFile(path.join(latest, 'data', 'dados.json'), 'utf8'), '{"schemaVersion":10}\n');
  const metadata = JSON.parse(await readFile(path.join(latest, 'metadata.json'), 'utf8'));
  assert.equal(metadata.portalVersion, '9.9.9');
  assert.equal(metadata.files.length, 2);
  assert.match(metadata.files[0].sha256, /^[a-f0-9]{64}$/);
});

test('finalização usa um fluxo único, cria backup antes da migração e evita validações duplicadas', async () => {
  const packageJson = JSON.parse(await source('package.json'));
  const batch = await source('FINALIZAR-ATUALIZACAO.bat');
  const gitignore = await source('.gitignore');
  const validate = await source('tools/validate.mjs');
  const prepareRelease = await source('tools/prepare-release.mjs');

  assert.equal(packageJson.scripts['release:prepare'], 'node tools/prepare-release.mjs');
  assert.ok(prepareRelease.indexOf('tools/create-local-backup.mjs') < prepareRelease.indexOf('tools/migrate-official-data.mjs'));
  assert.match(prepareRelease, /\['run', 'quality'\]/);
  assert.match(prepareRelease, /tools\/release-manifest\.mjs/);
  assert.doesNotMatch(prepareRelease, /audit:visual/);
  assert.match(batch, /call npm run release:prepare/);
  assert.doesNotMatch(batch, /call npm test/);
  assert.doesNotMatch(validate, /\['--test', 'tests\/\*\.test\.mjs'\]/);
  assert.doesNotMatch(gitignore, /INICIAR-HOMOLOGACAO\.bat/);
  assert.match(gitignore, /\.portal-backups\//);
});

test('documentação preserva a estabilização anterior e registra o novo ciclo por etapas', async () => {
  const release = await source('RELEASE.md');
  const refactoring = await source('REFACTORING.md');
  const roadmap = await source('docs/evolution-roadmap.md');
  const quality = await source('docs/quality-gates.md');

  assert.match(release, /Portal Lions v6\.46\.5/);
  assert.match(release, /estabilização do pacote/i);
  assert.match(release, /data\/modelo\.json/);
  assert.match(refactoring, /refatoração estrutural das versões 6\.29\.0 a 6\.36\.0 permanece concluída/i);
  assert.match(refactoring, /v6\.45\.0 — novo ciclo, etapa 1/i);
  assert.match(refactoring, /v6\.46\.0 — novo ciclo, etapa 2 final/i);
  assert.match(roadmap, /Etapa 8 — Dirigentes públicos e estabilização final — concluída na v6\.44\.0/);
  assert.match(quality, /audit:modules/);
  assert.match(quality, /backup:local/);
  assert.match(quality, /audit:integrated/);
});
