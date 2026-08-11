import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(root, relativePath), 'utf8');

test('agenda da home evita compressão de compromissos online no painel autenticado', async () => {
  const css = await source('assets/css/components/modern-interface.css');

  assert.match(css, /\.dashboard-main-grid\.is-admin-compact \.dashboard-appointments-grid\s*\{\s*grid-template-columns:\s*1fr;/);
  assert.match(css, /\.dashboard-appointments-grid\s*\{[^}]*align-items:\s*start;/s);
});

test('reunião online usa plataforma e acesso na horizontal quando há espaço e empilha no mobile', async () => {
  const css = await source('assets/css/components/modern-interface.css');

  assert.match(css, /\.appointment-home-location \.virtual-location\s*\{[^}]*flex-direction:\s*row;/s);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.appointment-home-location \.virtual-location\s*\{[^}]*flex-direction:\s*column;/);
});
