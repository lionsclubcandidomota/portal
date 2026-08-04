import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('estrutura principal oferece salto de navegação e regiões nomeadas', () => {
  assert.match(html, /class="skip-link"[^>]+href="#mainContent"/);
  assert.match(html, /<main[^>]+id="mainContent"[^>]+tabindex="-1"/);
  assert.match(html, /<aside[^>]+aria-label="Menu principal"/);
  assert.match(html, /<nav[^>]+aria-label="Atalhos principais"/);
});

test('HTML estático não utiliza manipuladores inline e todos os botões têm type', () => {
  assert.doesNotMatch(html, /\son[a-z]+\s*=/);
  for (const match of html.matchAll(/<button\b[^>]*>/g)) {
    assert.match(match[0], /\btype=/);
  }
});

test('diálogos possuem nome acessível e comportamento modal', () => {
  assert.match(html, /id="modal"[^>]+role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="modalTitle"/);
  assert.match(html, /id="confirmModal"[^>]+role="alertdialog"[^>]+aria-modal="true"[^>]+aria-labelledby="confirmTitle"/);
});
