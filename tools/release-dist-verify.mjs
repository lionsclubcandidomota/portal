import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sha256, verifyFileManifest } from './release-manifest-lib.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist');

async function run() {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const summary = JSON.parse(await readFile(path.join(distRoot, 'release-summary.json'), 'utf8'));
  const failures = [];

  if (summary.generatedAt !== packageJson.releaseTimestamp) {
    failures.push(`timestamp do release divergente: ${summary.generatedAt}`);
  }

  if (summary.version !== packageJson.version) {
    failures.push(`dist usa a versão ${summary.version}; esperado ${packageJson.version}`);
  }

  for (const artifact of summary.artifacts || []) {
    const zipPath = path.join(distRoot, artifact.zip);
    try {
      const content = await readFile(zipPath);
      if (sha256(content) !== artifact.sha256) failures.push(`hash divergente: ${artifact.zip}`);
      if ((await stat(zipPath)).size !== artifact.bytes) failures.push(`tamanho divergente: ${artifact.zip}`);
    } catch {
      failures.push(`ZIP ausente: ${artifact.zip}`);
    }

    if (artifact.folder) {
      try {
        const root = path.join(distRoot, artifact.folder);
        const manifest = JSON.parse(await readFile(path.join(root, 'release-manifest.json'), 'utf8'));
        if (!await verifyFileManifest(root, manifest)) failures.push(`manifesto inválido: ${artifact.folder}`);
      } catch {
        failures.push(`artefato descompactado inválido: ${artifact.folder}`);
      }
    }
  }

  if (failures.length) {
    console.error(`Verificação de dist reprovada:\n${failures.map(item => `- ${item}`).join('\n')}`);
    process.exit(1);
  }

  console.log(`Dist da versão ${summary.version} validado: ${summary.artifacts.length} artefatos.`);
}

run().catch(error => {
  console.error(`Não foi possível validar dist: ${error.message}`);
  process.exit(1);
});
