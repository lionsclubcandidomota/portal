import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

async function walk(directory, extension) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const fullPath = path.join(directory, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) result.push(...await walk(fullPath, extension));
    else if (!extension || fullPath.endsWith(extension)) result.push(fullPath);
  }
  return result;
}

const jsFiles = [
  ...await walk(path.join(projectRoot, 'assets', 'js'), '.js'),
  ...await walk(path.join(projectRoot, 'tools'), '.mjs'),
  ...await walk(path.join(projectRoot, 'tests'), '.mjs')
];

for (const file of jsFiles) {
  const source = await readFile(file, 'utf8');
  const relative = path.relative(projectRoot, file);
  const lines = source.split(/\r?\n/);
  const normalizedRelative = relative.split(path.sep).join('/');
  const isApplicationSource = normalizedRelative.startsWith('assets/js/');

  if (/\bdebugger\s*;/.test(source)) failures.push(`${relative}: contém debugger.`);
  if (/\bvar\s+[A-Za-z_$]/.test(source)) failures.push(`${relative}: utilize let ou const em vez de var.`);
  if (isApplicationSource && /console\.log\s*\(/.test(source)) {
    failures.push(`${relative}: remova console.log antes da entrega.`);
  }
  if (lines.length > 520 && normalizedRelative.startsWith('assets/js/modules/')) {
    failures.push(`${relative}: excede o limite arquitetural de 520 linhas (${lines.length}).`);
  }

  if (isApplicationSource) {
    const buttonTags = [...source.matchAll(/<button\b[^>]*>/gi)].map(match => match[0]);
    for (const tag of buttonTags) {
      if (!/\btype\s*=/.test(tag)) failures.push(`${relative}: botão sem atributo type: ${tag}`);
    }
  }
}

const indexPath = path.join(projectRoot, 'index.html');
const index = await readFile(indexPath, 'utf8');
if (/\son[a-z]+\s*=/.test(index)) failures.push('index.html: eventos inline não são permitidos.');

const ids = [...index.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, indexValue) => ids.indexOf(id) !== indexValue);
if (duplicateIds.length) failures.push(`index.html: IDs duplicados: ${[...new Set(duplicateIds)].join(', ')}.`);

const modernCssFiles = (await walk(path.join(projectRoot, 'assets', 'css'), '.css'))
  .filter(file => !file.includes(`${path.sep}legacy${path.sep}`) && !file.endsWith(`${path.sep}app.css`));
for (const file of modernCssFiles) {
  const basename = path.basename(file);
  if (/-v\d/i.test(basename)) {
    failures.push(`${path.relative(projectRoot, file)}: arquivos modernos não devem carregar versão no nome.`);
  }
}

if (failures.length) {
  console.error(`Falhas de qualidade:\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`Lint interno aprovado: ${jsFiles.length} arquivos JavaScript e ${modernCssFiles.length} fontes CSS modernas.`);
