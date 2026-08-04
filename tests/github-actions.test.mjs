import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSourceFiles } from '../tools/release-files.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

test('workflow de qualidade valida Portal e Worker sem permissão de escrita', async () => {
  const workflow = await read('.github/workflows/quality-gates.yml');

  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version:\s*['"]22['"]/);
  assert.match(workflow, /npm run release:check/);
  assert.match(workflow, /working-directory:\s*cloudflare\/attachment-worker/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run check/);
  assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN|GITHUB_TOKEN|secrets\./i);
  assert.doesNotMatch(workflow, /wrangler\s+deploy(?![^\n]*--dry-run)/i);
});

test('workflow de release gera artefatos sem realizar deploy de produção', async () => {
  const workflow = await read('.github/workflows/release-artifacts.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /tags:\s*\n\s*- ['"]v\*['"]/);
  assert.match(workflow, /npm ci --prefix cloudflare\/attachment-worker/);
  assert.match(workflow, /npm run check --prefix cloudflare\/attachment-worker/);
  assert.match(workflow, /npm run release:build/);
  assert.match(workflow, /git diff --exit-code/);
  assert.match(workflow, /actions\/upload-artifact@v6/);
  assert.match(workflow, /dist\/\*\.zip/);
  assert.match(workflow, /dist\/checksums\.sha256/);
  assert.match(workflow, /if-no-files-found:\s*error/);
  assert.doesNotMatch(workflow, /cloudflare\/wrangler-action|CLOUDFLARE_API_TOKEN|secrets\./i);
});

test('configuração de CI faz bundle do Worker com arquivo público de exemplo', async () => {
  const workerPackage = JSON.parse(await read('cloudflare/attachment-worker/package.json'));

  assert.match(workerPackage.scripts.check, /wrangler deploy --dry-run/);
  assert.match(workerPackage.scripts.check, /--config wrangler\.ci\.toml/);
  assert.doesNotMatch(workerPackage.scripts.check, /--remote|secret|token/i);

  const ciConfig = await read('cloudflare/attachment-worker/wrangler.ci.toml');
  assert.match(ciConfig, /bucket_name = \"[a-z0-9][a-z0-9-]*[a-z0-9]\"/);
  assert.doesNotMatch(ciConfig, /SEU_BUCKET_R2|lions-portal-documentos\"/);
});

test('workflows fazem parte do pacote de código-fonte, mas não do site público', async () => {
  const files = await collectSourceFiles(projectRoot);

  assert.ok(files.includes('.github/workflows/quality-gates.yml'));
  assert.ok(files.includes('.github/workflows/release-artifacts.yml'));
});
