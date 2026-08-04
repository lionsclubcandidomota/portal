import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHomologationServer } from '../tools/homologation-server.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const silentLogger = { log() {}, warn() {} };

async function withServer(callback) {
  const instance = await startHomologationServer({
    root: projectRoot,
    port: 0,
    watch: false,
    open: false,
    logger: silentLogger
  });
  try {
    await callback(instance);
  } finally {
    await instance.close();
  }
}

test('servidor próprio entrega o index sem injetar scripts inline', async () => {
  await withServer(async ({ url }) => {
    const response = await fetch(url);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.doesNotMatch(html, /Code injected by live-server/i);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
    assert.match(html, /script-src 'self';/);
  });
});

test('servidor identifica a homologação sem depender de WebSocket externo', async () => {
  await withServer(async ({ url }) => {
    const statusUrl = new URL('/__portal_homologation/status', url);
    const response = await fetch(statusUrl);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.name, 'portal-lions-homologation');
    assert.equal(payload.liveReload, false);
  });
});

test('servidor bloqueia caminhos ocultos e tentativas de navegação fora do projeto', async () => {
  await withServer(async ({ url }) => {
    const hidden = await fetch(new URL('/.editorconfig', url));
    const traversal = await fetch(new URL('/%2e%2e%2fpackage.json', url));

    assert.equal(hidden.status, 404);
    assert.equal(traversal.status, 404);
  });
});

test('cliente de recarga usa endpoint externo da própria origem', async () => {
  const source = await readFile(path.join(projectRoot, 'assets/js/core/homologation-reload.js'), 'utf8');
  assert.match(source, /new EventSource\(EVENTS_PATH\)/);
  assert.match(source, /fetch\(STATUS_PATH/);
  assert.doesNotMatch(source, /WebSocket|unsafe-inline|eval\s*\(/);
});
