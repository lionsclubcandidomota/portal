import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const SOURCE_ROOTS = Object.freeze([
  '.github',
  'assets',
  'data',
  'docs',
  'public',
  'tests',
  'tools',
  'cloudflare'
]);

export const SOURCE_FILES = Object.freeze([
  '.editorconfig',
  '.gitignore',
  'CHANGELOG.md',
  'REFACTORING.md',
  'RELEASE.md',
  'index.html',
  'INICIAR-HOMOLOGACAO.bat',
  'package.json',
  'release-manifest.json'
]);

export const SITE_ROOTS = Object.freeze([
  'assets/js',
  'assets/templates',
  'public'
]);

export const SITE_FILES = Object.freeze([
  'index.html',
  'assets/css/app.css',
  'data/dados.json'
]);

export const WORKER_ROOT = 'cloudflare/attachment-worker';
export const WORKER_FILES = Object.freeze([
  'README.md',
  'package-lock.json',
  'package.json',
  'wrangler.toml.example',
  'wrangler.ci.toml'
]);
export const WORKER_ROOTS = Object.freeze(['src']);

const EXCLUDED_NAMES = new Set([
  'node_modules',
  'dist',
  '.release-tmp',
  '.wrangler',
  '.wrangler-dist'
]);

export function isSecretOrLocalConfig(relativePath) {
  const normalized = relativePath.replaceAll(path.sep, '/');
  const name = path.posix.basename(normalized);
  return normalized.endsWith('/wrangler.toml')
    || name === 'wrangler.toml'
    || name.startsWith('.dev.vars')
    || name.startsWith('.env');
}

export async function walkFiles(root, relativeDirectory = '') {
  const absoluteDirectory = path.join(root, relativeDirectory);
  const entries = await readdir(absoluteDirectory);
  const files = [];

  for (const entry of entries.sort((first, second) => first.localeCompare(second))) {
    if (EXCLUDED_NAMES.has(entry)) continue;
    const relativePath = path.join(relativeDirectory, entry);
    if (isSecretOrLocalConfig(relativePath)) continue;
    const absolutePath = path.join(root, relativePath);
    const info = await stat(absolutePath);
    if (info.isDirectory()) files.push(...await walkFiles(root, relativePath));
    else if (info.isFile()) files.push(relativePath.replaceAll(path.sep, '/'));
  }

  return files;
}

async function collectFromRoots(root, roots) {
  const groups = await Promise.all(roots.map(relativePath => walkFiles(root, relativePath)));
  return groups.flat();
}

export async function collectSourceFiles(projectRoot, { includeManifest = true } = {}) {
  const rootFiles = SOURCE_FILES.filter(relativePath => includeManifest || relativePath !== 'release-manifest.json');
  return [...new Set([
    ...rootFiles,
    ...await collectFromRoots(projectRoot, SOURCE_ROOTS)
  ])].sort((first, second) => first.localeCompare(second));
}

export async function collectSiteFiles(projectRoot) {
  return [...new Set([
    ...SITE_FILES,
    ...await collectFromRoots(projectRoot, SITE_ROOTS)
  ])].sort((first, second) => first.localeCompare(second));
}

export async function collectWorkerFiles(projectRoot) {
  const workerRoot = path.join(projectRoot, WORKER_ROOT);
  const nestedFiles = await collectFromRoots(workerRoot, WORKER_ROOTS);
  return [...new Set([...WORKER_FILES, ...nestedFiles])]
    .sort((first, second) => first.localeCompare(second));
}
