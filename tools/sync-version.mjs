import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const expectedVersion = packageJson.version;
const checkOnly = process.argv.includes('--check');

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

const files = [
  path.join(projectRoot, 'index.html'),
  ...await walk(path.join(projectRoot, 'assets', 'js'), '.js')
];
const mismatches = [];
let updates = 0;

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const versions = [...source.matchAll(/\?v=(\d+\.\d+\.\d+)/g)].map(match => match[1]);
  const invalid = versions.filter(version => version !== expectedVersion);

  if (invalid.length) {
    if (checkOnly) {
      mismatches.push(`${path.relative(projectRoot, file)}: ${[...new Set(invalid)].join(', ')}`);
      continue;
    }

    const updated = source.replace(/\?v=\d+\.\d+\.\d+/g, `?v=${expectedVersion}`);
    await writeFile(file, updated, 'utf8');
    updates += 1;
  }
}

if (mismatches.length) {
  console.error(`Versões de cache divergentes de ${expectedVersion}:\n${mismatches.join('\n')}`);
  process.exit(1);
}

if (checkOnly) console.log(`Versão de cache validada: ${expectedVersion}.`);
else console.log(`Versão ${expectedVersion} sincronizada em ${updates} arquivo(s).`);
