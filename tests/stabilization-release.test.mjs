import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_SCHEMA_VERSION } from '../assets/js/core/portal-schema.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(projectRoot, relativePath), 'utf8'));
}

test('dados oficiais e modelo de instalação usam o mesmo esquema atual', async () => {
  const [official, model] = await Promise.all([
    readJson('data/dados.json'),
    readJson('data/modelo.json')
  ]);

  assert.equal(official.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(official.version, CURRENT_SCHEMA_VERSION);
  assert.equal(model.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(model.version, CURRENT_SCHEMA_VERSION);

  for (const collection of ['accessRoles', 'portalUsers', 'leadershipAssignments']) {
    assert.ok(Array.isArray(model.data?.[collection]), `data/modelo.json deve conter ${collection}`);
  }
});

test('finalizador informa a versão do package.json sem texto de versão obsoleto', async () => {
  const source = await readFile(path.join(projectRoot, 'FINALIZAR-ATUALIZACAO.bat'), 'utf8');
  assert.match(source, /require\(['"]\.\/package\.json['"]\)\.version/);
  assert.match(source, /PORTAL_VERSION/);
  assert.doesNotMatch(source, /Atualizacao 6\.44\.0 concluida/i);
});

test('auditoria de release valida também o modelo de instalação', async () => {
  const source = await readFile(path.join(projectRoot, 'tools/release-audit.mjs'), 'utf8');
  assert.match(source, /data\/modelo\.json/);
  assert.match(source, /modelEnvelope/);
});
