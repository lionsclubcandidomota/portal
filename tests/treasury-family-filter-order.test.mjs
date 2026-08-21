import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('filtro de famílias mantém opções fixas no topo e ordena grupos alfabeticamente', async () => {
  const source = await readFile(path.join(projectRoot, 'assets/js/modules/treasury/memberships.js'), 'utf8');

  assert.match(source, /const sortedFamilyGroups = treasury\.familyGroups\(\)/);
  assert.match(source, /localeCompare\(String\(second\?\.name \|\| ''\), 'pt-BR', \{ sensitivity: 'base' \}\)/);
  assert.match(source, /<option value="all">Todas as famílias<\/option><option value="none"/);
  assert.match(source, /\$\{sortedFamilyGroups\.map\(group =>/);
});
