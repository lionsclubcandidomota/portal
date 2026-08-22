import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(root, relativePath), 'utf8');

test('central administrativa apresenta catálogo visual dos seis relatórios', async () => {
  const view = await source('assets/js/modules/admin-dashboard/view.js');
  const catalog = await source('assets/js/modules/reports/catalog.js');
  assert.match(view, /Central de relatórios/);
  assert.match(view, /admin-report-options/);
  assert.match(view, /data-report-type/);
  assert.match(view, /adminReportSelectionDescription/);
  for (const key of ['movements', 'memberships', 'mutuals', 'birthdays', 'agenda', 'notices']) {
    assert.match(catalog, new RegExp(`${key}:`));
  }
});

test('central de relatórios possui seleção responsiva e estado visual acessível', async () => {
  const css = await source('assets/css/pages/admin-dashboard.css');
  const controller = await source('assets/js/modules/reports/controller.js');
  assert.match(css, /\.admin-report-options\{display:grid/);
  assert.match(css, /\.admin-report-option\.is-selected/);
  assert.match(css, /@media\(max-width:720px\).*\.admin-report-options,.admin-report-selection\{grid-template-columns:1fr\}/s);
  assert.match(controller, /aria-pressed/);
  assert.match(controller, /selectType\(/);
});
