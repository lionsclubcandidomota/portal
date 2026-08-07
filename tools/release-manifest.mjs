import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(projectRoot, 'release-manifest.json');
const excluded = new Set(['release-manifest.json']);
const includedRoots = [
  'assets',
  'data',
  'docs',
  'public',
  'tests',
  'tools'
];
const includedFiles = [
  '.editorconfig',
  '.gitignore',
  'CHANGELOG.md',
  'REFACTORING.md',
  'RELEASE.md',
  'index.html',
  'INICIAR-HOMOLOGACAO.bat',
  'FINALIZAR-ATUALIZACAO.bat',
  'package.json'
];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory)) {
    const absolutePath = path.join(directory, entry);
    const info = await stat(absolutePath);
    if (info.isDirectory()) files.push(...await walk(absolutePath));
    else files.push(absolutePath);
  }
  return files;
}

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function collectFiles() {
  const roots = await Promise.all(includedRoots.map(async relativePath => {
    const absolutePath = path.join(projectRoot, relativePath);
    return walk(absolutePath);
  }));
  const files = [
    ...includedFiles.map(relativePath => path.join(projectRoot, relativePath)),
    ...roots.flat()
  ];

  return [...new Set(files)]
    .filter(file => !excluded.has(path.relative(projectRoot, file).replaceAll(path.sep, '/')))
    .sort((first, second) => first.localeCompare(second));
}

async function buildManifest() {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const portalData = JSON.parse(await readFile(path.join(projectRoot, 'data', 'dados.json'), 'utf8'));
  const files = [];

  for (const absolutePath of await collectFiles()) {
    const content = await readFile(absolutePath);
    const relativePath = path.relative(projectRoot, absolutePath).replaceAll(path.sep, '/');
    files.push({
      path: relativePath,
      bytes: content.byteLength,
      sha256: hash(content)
    });
  }

  const extensionCount = extension => files.filter(file => file.path.endsWith(extension)).length;
  return {
    application: packageJson.name,
    version: packageJson.version,
    schemaVersion: portalData.schemaVersion,
    generatedAt: new Date().toISOString(),
    summary: {
      files: files.length,
      javascript: extensionCount('.js') + extensionCount('.mjs'),
      css: extensionCount('.css'),
      tests: files.filter(file => file.path.startsWith('tests/')).length,
      memberImages: files.filter(file => /^public\/members\/[^/]+$/.test(file.path)).length,
      memberThumbnails: files.filter(file => file.path.startsWith('public/members/thumbs/')).length,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0)
    },
    files
  };
}

function comparable(manifest) {
  return {
    application: manifest.application,
    version: manifest.version,
    schemaVersion: manifest.schemaVersion,
    summary: manifest.summary,
    files: manifest.files
  };
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

  if (JSON.stringify(comparable(saved)) !== JSON.stringify(comparable(manifest))) {
    console.error('O manifesto da versão está desatualizado. Execute npm run release:manifest.');
    process.exit(1);
  }
  console.log(`Manifesto da versão ${manifest.version} validado: ${manifest.summary.files} arquivos, ${manifest.summary.totalBytes} bytes.`);
} else {
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Manifesto da versão ${manifest.version} gerado com ${manifest.summary.files} arquivos.`);
}
