import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export async function walkJavaScriptFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const absolutePath = path.join(directory, entry);
    const info = await stat(absolutePath);
    if (info.isDirectory()) result.push(...await walkJavaScriptFiles(absolutePath));
    else if (absolutePath.endsWith('.js')) result.push(path.resolve(absolutePath));
  }
  return result;
}

export function staticModuleSpecifiers(source) {
  const patterns = [
    /(?:^|[;\n])\s*import\s+(?:[\w*$\s{},]+?\s+from\s+)?["']([^"']+)["']/gm,
    /(?:^|[;\n])\s*export\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/gm
  ];
  return patterns.flatMap(pattern => [...source.matchAll(pattern)].map(match => match[1]));
}

export function dynamicModuleSpecifiers(source) {
  return [...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map(match => match[1]);
}

export function moduleSpecifiers(source) {
  return [...staticModuleSpecifiers(source), ...dynamicModuleSpecifiers(source)];
}

export function resolveLocalSpecifier(importer, specifierWithQuery) {
  const specifier = specifierWithQuery.split('?')[0].split('#')[0];
  if (!specifier.startsWith('.')) return null;
  let resolved = path.resolve(path.dirname(importer), specifier);
  if (!path.extname(resolved)) resolved += '.js';
  return resolved;
}

export async function collectStaticGraph(entry) {
  const pending = [path.resolve(entry)];
  const visited = new Set();

  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    const source = await readFile(current, 'utf8');

    for (const specifier of staticModuleSpecifiers(source)) {
      const resolved = resolveLocalSpecifier(current, specifier);
      if (resolved) pending.push(resolved);
    }
  }

  return visited;
}
