import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE_VERSION_PATTERN = /\?v=(\d+\.\d+\.\d+(?:\.\d+)*)/g;

async function walk(directory, extension) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const fullPath = path.join(directory, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) result.push(...await walk(fullPath, extension));
    else if (fullPath.endsWith(extension)) result.push(fullPath);
  }
  return result;
}

export function cacheVersionsFromSource(source) {
  return [...source.matchAll(CACHE_VERSION_PATTERN)].map(match => match[1]);
}

export function synchronizeCacheVersions(source, expectedVersion) {
  return source.replace(CACHE_VERSION_PATTERN, `?v=${expectedVersion}`);
}

async function runCli() {
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const expectedVersion = packageJson.version;
  const checkOnly = process.argv.includes('--check');
  const files = [
    path.join(projectRoot, 'index.html'),
    ...await walk(path.join(projectRoot, 'assets', 'js'), '.js')
  ];
  const mismatches = [];
  let updates = 0;

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const versions = cacheVersionsFromSource(source);
    const invalid = versions.filter(version => version !== expectedVersion);

    if (!invalid.length) continue;
    if (checkOnly) {
      mismatches.push(`${path.relative(projectRoot, file)}: ${[...new Set(invalid)].join(', ')}`);
      continue;
    }

    const updated = synchronizeCacheVersions(source, expectedVersion);
    await writeFile(file, updated, 'utf8');
    updates += 1;
  }

  if (mismatches.length) {
    console.error(`Versões de cache divergentes de ${expectedVersion}:\n${mismatches.join('\n')}`);
    process.exit(1);
  }

  if (checkOnly) console.log(`Versão de cache validada: ${expectedVersion}.`);
  else console.log(`Versão ${expectedVersion} sincronizada em ${updates} arquivo(s).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
