import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssRoot = path.join(projectRoot, 'assets', 'css');

async function doesNotExist(relativePath) {
  try {
    await access(path.join(cssRoot, relativePath), constants.F_OK);
    return false;
  } catch {
    return true;
  }
}

test('camada v3.5 foi separada por responsabilidade sem permanecer em legacy', async () => {
  const expectedSources = [
    ['components/interaction-foundation.css', '.form-validation-alert'],
    ['components/structured-content.css', '.structured-text-toggle'],
    ['pages/admin-operations.css', '.admin-command-header'],
    ['pages/treasury-records.css', '.treasury-card-grid'],
    ['pages/notices.css', '.notice-desktop-table'],
    ['components/publication-progress.css', '.publish-progress-close']
  ];

  for (const [relativePath, selector] of expectedSources) {
    const source = await readFile(path.join(cssRoot, relativePath), 'utf8');
    assert.match(source, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.equal(await doesNotExist('legacy/v35.css'), true);
  assert.equal(await doesNotExist('legacy/improvements-v5.css'), true);
});

test('bundle mantém a ordem histórica das fontes migradas', async () => {
  const build = await readFile(path.join(projectRoot, 'tools', 'build-css.mjs'), 'utf8');
  const ordered = [
    'foundations/application-shell.css',
    'components/interaction-foundation.css',
    'components/structured-content.css',
    'pages/admin-operations.css',
    'pages/treasury-records.css',
    'pages/notices.css',
    'components/publication-progress.css',
    'tokens.css'
  ];

  let lastIndex = -1;
  for (const source of ordered) {
    const currentIndex = build.indexOf(`'${source}'`);
    assert.ok(currentIndex > lastIndex, `${source} deve preservar a ordem da cascata`);
    lastIndex = currentIndex;
  }
  assert.match(build, /components\/responsive-guardrails\.css/);
  assert.match(build, /pages\/responsive-workflows\.css/);
  assert.match(build, /components\/interface-polish\.css/);
  assert.match(build, /pages\/treasury-workflows\.css/);
});

test('auditoria CSS impede o retorno da camada legacy e mede sobrescritas', async () => {
  const audit = await readFile(path.join(projectRoot, 'tools', 'css-audit.mjs'), 'utf8');

  assert.match(audit, /maxLegacyBytes:\s*0/);
  assert.match(audit, /maxLegacySources:\s*0/);
  assert.match(audit, /maxSupersededDeclarations:\s*0/);
  assert.match(audit, /maxRepeatedContextSelectors:\s*280/);
  assert.match(audit, /maxOverrideRules:\s*360/);
  assert.match(audit, /maxSourceBytes:\s*36_000/);
  assert.match(audit, /maxBundleBytes:\s*338_000/);
  assert.doesNotMatch(audit, /maxLegacyLines/);
  assert.doesNotMatch(audit, /maxSharedSelectors/);

  assert.equal(await doesNotExist('legacy/styles.css'), true);
  assert.equal(await doesNotExist('legacy/audit-v4.css'), true);
  assert.equal(await doesNotExist('legacy/refinement-v5.6.css'), true);

  for (const relativePath of [
    'foundations/application-shell.css',
    'components/responsive-guardrails.css',
    'pages/responsive-workflows.css',
    'components/interface-polish.css'
  ]) {
    await access(path.join(cssRoot, relativePath), constants.F_OK);
  }
});
