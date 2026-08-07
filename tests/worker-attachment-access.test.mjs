import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workerUrl = new URL('../cloudflare/attachment-worker/src/index.js', import.meta.url);

test('Worker define validade segura para tickets de visualização e download de anexos', async () => {
  const worker = await readFile(workerUrl, 'utf8');
  assert.match(worker, /function downloadTtl\(env\)/);
  assert.match(worker, /DOWNLOAD_TTL_SECONDS \|\| 300/);
  assert.match(worker, /Math\.min\(15 \* 60, Math\.max\(60, Math\.floor\(configured\)\)\)/);
  assert.match(worker, /exp:\s*now \+ downloadTtl\(env\)/);
  assert.match(worker, /disposition: body\.disposition === 'attachment' \? 'attachment' : 'inline'/);
});
