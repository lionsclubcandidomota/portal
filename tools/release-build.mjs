import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  collectSiteFiles,
  collectSourceFiles,
  collectWorkerFiles,
  isSecretOrLocalConfig,
  WORKER_ROOT
} from './release-files.mjs';
import { buildFileManifest, sha256, verifyFileManifest } from './release-manifest-lib.mjs';
import { createZip } from './zip.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist');

async function copyFiles(sourceRoot, destinationRoot, files) {
  for (const relativePath of files) {
    if (isSecretOrLocalConfig(relativePath)) {
      throw new Error(`Arquivo local ou secreto bloqueado no release: ${relativePath}`);
    }
    const sourcePath = path.join(sourceRoot, relativePath);
    const destinationPath = path.join(destinationRoot, relativePath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await cp(sourcePath, destinationPath);
  }
}

async function writeManifest(destinationRoot, manifest) {
  await writeFile(
    path.join(destinationRoot, 'release-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
}

async function buildArtifact({
  name,
  application,
  artifactType,
  sourceRoot,
  files,
  version,
  schemaVersion = null,
  generatedAt
}) {
  const folderName = `${name}-v${version}`;
  const destinationRoot = path.join(distRoot, folderName);
  await mkdir(destinationRoot, { recursive: true });
  await copyFiles(sourceRoot, destinationRoot, files);

  const manifest = await buildFileManifest({
    root: destinationRoot,
    files,
    application,
    artifactType,
    version,
    schemaVersion,
    generatedAt
  });
  await writeManifest(destinationRoot, manifest);

  if (!await verifyFileManifest(destinationRoot, manifest)) {
    throw new Error(`Falha ao validar o manifesto do artefato ${folderName}.`);
  }

  const zipFiles = [...files, 'release-manifest.json'];
  const zipPath = path.join(distRoot, `${folderName}.zip`);
  await createZip({
    root: destinationRoot,
    files: zipFiles,
    outputPath: zipPath,
    prefix: `${folderName}/`
  });

  return {
    artifactType,
    folder: folderName,
    zip: path.basename(zipPath),
    files: manifest.summary.files,
    bytes: (await stat(zipPath)).size,
    sha256: sha256(await readFile(zipPath))
  };
}

async function run() {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const workerPackage = JSON.parse(await readFile(path.join(projectRoot, WORKER_ROOT, 'package.json'), 'utf8'));
  const portalData = JSON.parse(await readFile(path.join(projectRoot, 'data', 'dados.json'), 'utf8'));

  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  const siteFiles = await collectSiteFiles(projectRoot);
  const workerFiles = await collectWorkerFiles(projectRoot);
  const sourceFiles = await collectSourceFiles(projectRoot, { includeManifest: true });

  const artifacts = [];
  artifacts.push(await buildArtifact({
    name: 'portal-site',
    application: packageJson.name,
    artifactType: 'portal-site',
    sourceRoot: projectRoot,
    files: siteFiles,
    version: packageJson.version,
    schemaVersion: portalData.schemaVersion,
    generatedAt: packageJson.releaseTimestamp
  }));
  artifacts.push(await buildArtifact({
    name: 'cloudflare-worker',
    application: workerPackage.name,
    artifactType: 'cloudflare-worker',
    sourceRoot: path.join(projectRoot, WORKER_ROOT),
    files: workerFiles,
    version: workerPackage.version,
    generatedAt: packageJson.releaseTimestamp
  }));

  const sourceZipName = `portal-main-v${packageJson.version}.zip`;
  const sourceZipPath = path.join(distRoot, sourceZipName);
  await createZip({
    root: projectRoot,
    files: sourceFiles,
    outputPath: sourceZipPath,
    prefix: `portal-main-v${packageJson.version}/`
  });
  artifacts.push({
    artifactType: 'source',
    zip: sourceZipName,
    files: sourceFiles.length,
    bytes: (await stat(sourceZipPath)).size,
    sha256: sha256(await readFile(sourceZipPath))
  });

  const summary = {
    application: packageJson.name,
    version: packageJson.version,
    generatedAt: packageJson.releaseTimestamp,
    artifacts
  };
  await writeFile(path.join(distRoot, 'release-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(
    path.join(distRoot, 'checksums.sha256'),
    `${artifacts.map(artifact => `${artifact.sha256}  ${artifact.zip}`).join('\n')}\n`,
    'utf8'
  );
  await writeFile(path.join(distRoot, 'README.md'), `# Pacotes da versão ${packageJson.version}\n\n- \`portal-site-v${packageJson.version}.zip\`: arquivos prontos para publicar no GitHub Pages.\n- \`cloudflare-worker-v${workerPackage.version}.zip\`: código do Worker para Cloudflare.\n- \`${sourceZipName}\`: código-fonte completo para manutenção.\n- \`checksums.sha256\`: hashes SHA-256 para conferência dos ZIPs.\n\nOs diretórios descompactados ao lado dos ZIPs são gerados para inspeção e homologação.\n`, 'utf8');

  console.log(`Release ${packageJson.version} gerado em dist com ${artifacts.length} artefatos.`);
  for (const artifact of artifacts) {
    console.log(`- ${artifact.zip}: ${artifact.files} arquivos, ${artifact.bytes} bytes, sha256 ${artifact.sha256}`);
  }
}

run().catch(error => {
  console.error(`Falha ao gerar o release: ${error.message}`);
  process.exit(1);
});
