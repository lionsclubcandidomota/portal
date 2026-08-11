import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(root, relativePath), 'utf8');

test('homologação integrada participa dos portões oficiais e do iniciador local', async () => {
  const packageJson = JSON.parse(await source('package.json'));
  const batch = await source('INICIAR-HOMOLOGACAO.bat');
  const audit = await source('tools/integrated-homologation.mjs');

  assert.equal(packageJson.scripts['audit:integrated'], 'node tools/integrated-homologation.mjs');
  assert.match(packageJson.scripts.quality, /npm run audit:integrated/);
  assert.match(batch, /npm run audit:integrated/);
  assert.match(audit, /leadershipAssignments/);
  assert.match(audit, /integrated-report\.json/);
});

test('área pública de dirigentes usa o histórico vigente sem duplicar cadastros', async () => {
  const leaders = await source('assets/js/modules/leaders.js');
  const leadershipProjection = await source('assets/js/core/public-leadership.js');
  const html = await source('index.html');
  const css = await source('assets/css/pages/leaders.css');

  assert.match(leaders, /currentPublicLeaders/);
  assert.match(leadershipProjection, /state\?\.leadershipAssignments/);
  assert.match(leadershipProjection, /state\?\.birthdays/);
  assert.doesNotMatch(leaders + leadershipProjection, /portalUsers/);
  assert.match(html, /data-view="leaders"/);
  assert.match(css, /\.leaders-grid/);
  assert.match(css, /@media \(max-width:\s*430px\)/);
});

test('homologação visual inclui Dirigentes e verifica os cartões públicos', async () => {
  const audit = await source('tools/visual-audit.mjs');
  assert.match(audit, /id: 'leaders', title: 'Dirigentes'/);
  assert.match(audit, /leaderCardOverflow/);
  assert.match(audit, /\.leader-card/);
});

test('documentação encerra as oito etapas e mantém o esquema 12', async () => {
  const [release, refactoring, schema, changelog, packageSource] = await Promise.all([
    source('RELEASE.md'),
    source('REFACTORING.md'),
    source('docs/data-schema.md'),
    source('CHANGELOG.md'),
    source('package.json')
  ]);
  const packageVersion = JSON.parse(packageSource).version;
  assert.match(release, new RegExp(`Portal Lions v${packageVersion.replaceAll('.', '\\.')}`, 'i'));
  assert.match(refactoring, /ciclo funcional concluído/i);
  assert.match(schema, /Esquema de dados do Portal — v12/);
  assert.match(changelog, /6\.44\.0 — Dirigentes públicos e estabilização final/);
});
