import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryPath = path.join(projectRoot, 'assets', 'js', 'app.js');
const cssPath = path.join(projectRoot, 'assets', 'css', 'app.css');
const indexPath = path.join(projectRoot, 'index.html');
const optimizedLogoPath = path.join(projectRoot, 'public', 'logo-ui.webp');

const budgets = Object.freeze({
  staticJavaScriptBytes: 220_000,
  cssBytes: 400_000,
  optimizedLogoBytes: 60_000,
  criticalAssetsBytes: 655_000
});

function staticImportSpecifiers(source) {
  const matches = source.matchAll(/\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g);
  return [...matches].map(match => match[1]);
}

async function collectStaticGraph(entry) {
  const pending = [path.resolve(entry)];
  const visited = new Set();

  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    const source = await readFile(current, 'utf8');

    for (const specifierWithQuery of staticImportSpecifiers(source)) {
      const specifier = specifierWithQuery.split('?')[0];
      if (!specifier.startsWith('.')) continue;
      let resolved = path.resolve(path.dirname(current), specifier);
      if (!path.extname(resolved)) resolved += '.js';
      pending.push(resolved);
    }
  }

  return visited;
}

const [graph, cssInfo, logoInfo, indexHtml, entrySource] = await Promise.all([
  collectStaticGraph(entryPath),
  stat(cssPath),
  stat(optimizedLogoPath),
  readFile(indexPath, 'utf8'),
  readFile(entryPath, 'utf8')
]);
const staticJavaScriptSizes = await Promise.all([...graph].map(async file => (await stat(file)).size));
const staticJavaScriptBytes = staticJavaScriptSizes.reduce((total, size) => total + size, 0);
const criticalAssetsBytes = staticJavaScriptBytes + cssInfo.size + logoInfo.size;
const failures = [];
const lazyOnlyModules = [
  'assets/js/modules/agenda.js',
  'assets/js/modules/leaders.js',
  'assets/js/modules/admin-panel.js',
  'assets/js/modules/entity-forms.js',
  'assets/js/modules/reports/controller.js',
  'assets/js/modules/settings.js',
  'assets/js/modules/publication-review.js',
  'assets/js/modules/treasury-admin.js',
  'assets/js/modules/treasury/controller.js',
  'assets/js/modules/treasury/view.js',
  'assets/js/modules/treasury/charts.js'
];
const staticRelativeFiles = new Set([...graph].map(file => path.relative(projectRoot, file).replaceAll('\\', '/')));
for (const modulePath of lazyOnlyModules) {
  if (staticRelativeFiles.has(modulePath)) failures.push(`${modulePath} voltou ao carregamento inicial`);
}

if (staticJavaScriptBytes > budgets.staticJavaScriptBytes) {
  failures.push(`JavaScript inicial: ${staticJavaScriptBytes}/${budgets.staticJavaScriptBytes} bytes`);
}
if (cssInfo.size > budgets.cssBytes) failures.push(`CSS: ${cssInfo.size}/${budgets.cssBytes} bytes`);
if (logoInfo.size > budgets.optimizedLogoBytes) failures.push(`logo otimizado: ${logoInfo.size}/${budgets.optimizedLogoBytes} bytes`);
if (criticalAssetsBytes > budgets.criticalAssetsBytes) {
  failures.push(`ativos críticos: ${criticalAssetsBytes}/${budgets.criticalAssetsBytes} bytes`);
}
if (/from\s+["']\.\/birthday-artwork\.js/.test(entrySource)) {
  failures.push('o módulo de criação da homenagem voltou ao carregamento estático inicial');
}
if (/birthday-template\.(?:png|webp)/.test(indexHtml)) {
  failures.push('o template de aniversário não deve ser pré-carregado no HTML');
}
if (!/logo-ui\.webp/.test(indexHtml)) failures.push('o HTML não usa o logotipo otimizado');

console.log(`Desempenho: ${graph.size} módulos estáticos (${staticJavaScriptBytes} bytes), CSS ${cssInfo.size} bytes, logo ${logoInfo.size} bytes, ativos críticos ${criticalAssetsBytes} bytes.`);
if (failures.length) {
  console.error(`Orçamento de desempenho excedido:\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}
