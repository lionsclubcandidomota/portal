import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CSS_SOURCES } from './build-css.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssRoot = path.join(projectRoot, 'assets', 'css');
const budget = Object.freeze({
  maxSources: 33,
  maxExactDuplicateRules: 0,
  maxRepeatedContextSelectors: 350,
  maxOverrideRules: 450,
  maxLegacySources: 0,
  maxLegacyBytes: 0,
  maxSourceBytes: 38_000,
  maxBundleBytes: 430_000
});

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').replace(/\s*([:;,>+~{}])\s*/g, '$1').trim();
}

function findClosingBrace(source, openIndex) {
  let depth = 1;
  let quote = '';
  for (let index = openIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractRules(source, context = [], output = []) {
  const css = stripComments(source);
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf('{', cursor);
    if (open === -1) break;
    const prelude = normalize(css.slice(cursor, open));
    const close = findClosingBrace(css, open);
    if (close === -1) break;
    const body = css.slice(open + 1, close);

    if (/^@(media|supports|container|layer)\b/i.test(prelude)) {
      extractRules(body, [...context, prelude], output);
    } else if (prelude && !prelude.startsWith('@') && !/^(from|to|\d+%)$/i.test(prelude)) {
      output.push({
        context: context.join(' > '),
        selector: prelude,
        declarations: normalize(body)
      });
    }
    cursor = close + 1;
  }
  return output;
}

const allRules = [];
const sourceBytes = new Map();
let legacyBytes = 0;
let legacySources = 0;
for (const relativePath of CSS_SOURCES) {
  const source = await readFile(path.join(cssRoot, relativePath), 'utf8');
  const bytes = Buffer.byteLength(source);
  sourceBytes.set(relativePath, bytes);
  if (relativePath.startsWith('legacy/')) {
    legacyBytes += bytes;
    legacySources += 1;
  }
  for (const rule of extractRules(source)) allRules.push({ ...rule, source: relativePath });
}

const exactRules = new Map();
const selectorDefinitions = new Map();
for (const rule of allRules) {
  const exactKey = `${rule.context}|${rule.selector}|${rule.declarations}`;
  exactRules.set(exactKey, (exactRules.get(exactKey) || 0) + 1);

  const selectorKey = `${rule.context}|${rule.selector}`;
  selectorDefinitions.set(selectorKey, (selectorDefinitions.get(selectorKey) || 0) + 1);
}

const exactDuplicateRules = [...exactRules.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
const repeatedContextSelectors = [...selectorDefinitions.values()].filter(count => count > 1).length;
const overrideRules = [...selectorDefinitions.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
const largestSource = [...sourceBytes.entries()].sort((first, second) => second[1] - first[1])[0] || ['', 0];
const bundleBytes = Buffer.byteLength(await readFile(path.join(cssRoot, 'app.css'), 'utf8'));
const failures = [];

if (CSS_SOURCES.length > budget.maxSources) failures.push(`fontes CSS: ${CSS_SOURCES.length}/${budget.maxSources}`);
if (exactDuplicateRules > budget.maxExactDuplicateRules) failures.push(`regras exatamente duplicadas: ${exactDuplicateRules}/${budget.maxExactDuplicateRules}`);
if (repeatedContextSelectors > budget.maxRepeatedContextSelectors) failures.push(`seletores redefinidos no mesmo contexto: ${repeatedContextSelectors}/${budget.maxRepeatedContextSelectors}`);
if (overrideRules > budget.maxOverrideRules) failures.push(`regras de sobrescrita: ${overrideRules}/${budget.maxOverrideRules}`);
if (legacySources > budget.maxLegacySources) failures.push(`fontes legadas: ${legacySources}/${budget.maxLegacySources}`);
if (legacyBytes > budget.maxLegacyBytes) failures.push(`peso legado: ${legacyBytes}/${budget.maxLegacyBytes} bytes`);
if (largestSource[1] > budget.maxSourceBytes) failures.push(`maior fonte CSS: ${largestSource[0]} com ${largestSource[1]}/${budget.maxSourceBytes} bytes`);
if (bundleBytes > budget.maxBundleBytes) failures.push(`bundle CSS: ${bundleBytes}/${budget.maxBundleBytes} bytes`);

console.log(`CSS: ${allRules.length} regras, ${exactDuplicateRules} duplicatas exatas, ${repeatedContextSelectors} seletores redefinidos, ${overrideRules} sobrescritas, ${legacySources} fontes legadas (${legacyBytes} bytes), maior fonte ${largestSource[0]} (${largestSource[1]} bytes), bundle ${bundleBytes} bytes.`);
if (failures.length) {
  console.error(`Orçamento CSS excedido:\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}
