import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collectStaticGraph } from './module-graph-utils.mjs';
import { lazyOnlyModules, performanceBudgets as budgets } from './quality-contracts.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryPath = path.join(projectRoot, 'assets', 'js', 'app.js');
const cssPath = path.join(projectRoot, 'assets', 'css', 'app.css');
const indexPath = path.join(projectRoot, 'index.html');
const optimizedLogoPath = path.join(projectRoot, 'public', 'logo-ui.webp');

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
