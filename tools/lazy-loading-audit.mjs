import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  collectStaticGraph,
  dynamicModuleSpecifiers,
  resolveLocalSpecifier,
  walkJavaScriptFiles
} from './module-graph-utils.mjs';
import { lazyEntryModules, lazyOnlyModules } from './quality-contracts.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'assets', 'js');
const entryPath = path.join(sourceRoot, 'app.js');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const expectedVersion = packageJson.version;
const failures = [];
const files = await walkJavaScriptFiles(sourceRoot);
const staticGraph = await collectStaticGraph(entryPath);
const staticRelativeFiles = new Set([...staticGraph].map(file => path.relative(projectRoot, file).replaceAll('\\', '/')));
const dynamicTargets = new Set();
let dynamicImportCount = 0;

for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const specifier of dynamicModuleSpecifiers(source)) {
    const target = resolveLocalSpecifier(file, specifier);
    if (!target) continue;
    dynamicImportCount += 1;
    const relativeTarget = path.relative(projectRoot, target).replaceAll('\\', '/');
    dynamicTargets.add(relativeTarget);

    const query = specifier.includes('?') ? specifier.slice(specifier.indexOf('?') + 1) : '';
    const version = new URLSearchParams(query).get('v');
    if (version !== expectedVersion) {
      failures.push(`${path.relative(projectRoot, file).replaceAll('\\', '/')} usa import dinâmico sem ?v=${expectedVersion}: ${specifier}`);
    }
  }
}

for (const modulePath of lazyOnlyModules) {
  if (staticRelativeFiles.has(modulePath)) failures.push(`${modulePath} deixou de ser lazy e voltou ao bootstrap`);
}

for (const modulePath of lazyEntryModules) {
  if (!dynamicTargets.has(modulePath)) failures.push(`${modulePath} não possui ponto de entrada dinâmico ativo`);
}

if (failures.length) {
  console.error(`Auditoria de lazy loading reprovada:\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`Lazy loading aprovado: ${dynamicImportCount} imports dinâmicos versionados, ${lazyEntryModules.length} entradas lazy protegidas e ${lazyOnlyModules.length} módulos fora do bootstrap.`);
