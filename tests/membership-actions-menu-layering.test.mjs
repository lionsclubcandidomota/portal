import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

test('menu de ações da mensalidade eleva somente o card aberto acima dos cards vizinhos', async () => {
  const [css, view] = await Promise.all([
    source('assets/css/components/membership-actions-menu.css'),
    source('assets/js/modules/treasury/view-memberships.js')
  ]);

  assert.match(css, /\.membership-member\s*\{[\s\S]*?z-index:\s*0;/);
  assert.match(css, /\.membership-member-actions,[\s\S]*?\.membership-actions-menu\s*\{[\s\S]*?z-index:\s*auto;/);
  assert.match(css, /\.membership-member\.is-actions-open,[\s\S]*?z-index:\s*var\(--z-dropdown\)\s*!important;/);
  assert.match(css, /\.membership-more-menu\s*\{[\s\S]*?z-index:\s*3\s*!important;/);
  assert.match(view, /classList\.toggle\('is-actions-open', opening\)/);
  assert.match(view, /classList\.remove\('is-actions-open'\)/);
});
