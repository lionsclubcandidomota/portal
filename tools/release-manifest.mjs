import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collectSourceFiles } from './release-files.mjs';
import { buildFileManifest, comparableManifest } from './release-manifest-lib.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(projectRoot, 'release-manifest.json');

async function buildManifest() {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const portalData = JSON.parse(await readFile(path.join(projectRoot, 'data', 'dados.json'), 'utf8'));
  const files = await collectSourceFiles(projectRoot, { includeManifest: false });

  return buildFileManifest({
    root: projectRoot,
    files,
    application: packageJson.name,
    artifactType: 'source',
    version: packageJson.version,
    schemaVersion: portalData.schemaVersion,
    generatedAt: packageJson.releaseTimestamp
  });
}

const manifest = await buildManifest();
if (process.argv.includes('--check')) {
  let saved;
  try {
    saved = JSON.parse(await readFile(outputPath, 'utf8'));
  } catch {
    console.error('release-manifest.json não foi encontrado ou está inválido. Execute npm run release:manifest.');
    process.exit(1);
  }

  if (JSON.stringify(comparableManifest(saved)) !== JSON.stringify(comparableManifest(manifest))) {
    console.error('O manifesto da versão está desatualizado. Execute npm run release:manifest.');
    process.exit(1);
  }
  console.log(`Manifesto da versão ${manifest.version} validado: ${manifest.summary.files} arquivos, ${manifest.summary.totalBytes} bytes.`);
} else {
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Manifesto da versão ${manifest.version} gerado com ${manifest.summary.files} arquivos.`);
}
