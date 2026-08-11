import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { moduleSpecifiers, resolveLocalSpecifier, walkJavaScriptFiles } from './module-graph-utils.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'assets', 'js');
const entryPath = path.join(sourceRoot, 'app.js');
const failures = [];

const files = (await walkJavaScriptFiles(sourceRoot)).sort((first, second) => first.localeCompare(second));
const fileSet = new Set(files);
const graph = new Map();

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const dependencies = [];
  for (const specifier of moduleSpecifiers(source)) {
    const dependency = resolveLocalSpecifier(file, specifier);
    if (!dependency) continue;
    if (!fileSet.has(dependency)) {
      failures.push(`${path.relative(projectRoot, file)} importa módulo ausente: ${specifier}`);
      continue;
    }
    dependencies.push(dependency);
  }
  graph.set(file, [...new Set(dependencies)]);
}

const reachable = new Set();
const pending = [entryPath];
while (pending.length) {
  const current = pending.pop();
  if (reachable.has(current)) continue;
  reachable.add(current);
  for (const dependency of graph.get(current) || []) pending.push(dependency);
}

const unreachable = files.filter(file => !reachable.has(file));
for (const file of unreachable) {
  failures.push(`módulo sem uso no Portal: ${path.relative(projectRoot, file).replaceAll(path.sep, '/')}`);
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const cycles = [];

function visit(file) {
  if (visiting.has(file)) {
    const start = stack.indexOf(file);
    cycles.push([...stack.slice(start), file]);
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  stack.push(file);
  for (const dependency of graph.get(file) || []) visit(dependency);
  stack.pop();
  visiting.delete(file);
  visited.add(file);
}
visit(entryPath);

for (const cycle of cycles) {
  failures.push(`dependência circular: ${cycle.map(file => path.relative(projectRoot, file).replaceAll(path.sep, '/')).join(' -> ')}`);
}

if (failures.length) {
  console.error(`Auditoria do grafo de módulos reprovada:\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}

const edgeCount = [...graph.values()].reduce((total, dependencies) => total + dependencies.length, 0);
console.log(`Grafo de módulos aprovado: ${files.length} módulos alcançáveis, ${edgeCount} dependências e nenhuma referência órfã ou circular.`);
