import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  clearSecureStorageSession,
  connectSecureStorageSession,
  createPrivateStateBackup,
  diagnosePrivateStorageIntegrity,
  listPrivateStateBackups,
  loadPrivatePortalState,
  restorePrivateStateBackup
} from '../assets/js/modules/secure-storage/client.js';
import { recoveryCenterHtml } from '../assets/js/modules/recovery-center/view.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerUrl = 'https://lions-portal-anexos.exemplo.workers.dev';
const state = {
  settings: { secureStorage: { enabled: true, workerUrl } },
  treasury: []
};

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('cliente consulta, cria e restaura backups privados mantendo a revisão otimista', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    calls.push({ pathname, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (pathname === '/api/session') {
      return response({ token: 'session-token', role: 'admin', expiresAt: new Date(Date.now() + 600_000).toISOString() });
    }
    if (pathname === '/api/private-state' && (options.method || 'GET') === 'GET') {
      return response({ found: true, state: { treasury: [{ id: 'mov-1' }] }, revision: 'rev-current', updatedAt: '2026-08-04T20:00:00.000Z' });
    }
    if (pathname === '/api/private-state/backups' && (options.method || 'GET') === 'GET') {
      return response({ backups: [{ key: '__portal/backups/private-state-v1/a.json' }], retention: 20, current: { revision: 'rev-current' } });
    }
    if (pathname === '/api/private-state/backups' && options.method === 'POST') {
      return response({ created: true, backup: { key: '__portal/backups/private-state-v1/manual.json' } }, 201);
    }
    if (pathname === '/api/private-state/integrity') {
      return response({ status: 'ok', attachments: { referenced: 1, existing: 1, missing: [] } });
    }
    if (pathname === '/api/private-state/backups/restore') {
      return response({ found: true, state: { treasury: [{ id: 'mov-old' }] }, revision: 'rev-restored', updatedAt: '2026-08-04T21:00:00.000Z' });
    }
    return response({ error: 'unexpected' }, 500);
  };

  try {
    await connectSecureStorageSession({ state, role: 'admin', credential: 'github-token' });
    await loadPrivatePortalState(state);
    const listed = await listPrivateStateBackups(state);
    const created = await createPrivateStateBackup(state, 'Ponto manual');
    const diagnostic = await diagnosePrivateStorageIntegrity(state);
    const restored = await restorePrivateStateBackup(state, listed.backups[0].key);

    assert.equal(listed.retention, 20);
    assert.equal(created.created, true);
    assert.equal(diagnostic.status, 'ok');
    assert.equal(restored.revision, 'rev-restored');
    const restoreCall = calls.find(call => call.pathname.endsWith('/restore'));
    assert.equal(restoreCall.body.expectedRevision, 'rev-current');
  } finally {
    clearSecureStorageSession();
    globalThis.fetch = originalFetch;
  }
});

test('Worker mantém backups versionados, bloqueia estado vazio e diagnostica anexos', async () => {
  const worker = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/src/index.js'), 'utf8');
  assert.match(worker, /PRIVATE_BACKUP_PREFIX = '__portal\/backups\/private-state-v1\/'/);
  assert.match(worker, /MAX_PRIVATE_BACKUPS = 20/);
  assert.match(worker, /incoming\.protectedRecords === 0/);
  assert.match(worker, /Gravação bloqueada: o novo estado removeria todos os dados privados/);
  assert.match(worker, /\/api\/private-state\/backups\/restore/);
  assert.match(worker, /\/api\/private-state\/integrity/);
  assert.match(worker, /env\.ATTACHMENTS\.head\(key\)/);
  assert.match(worker, /orphaned/);
  assert.match(worker, /checksum/);
});

test('Central de Recuperação apresenta integridade, anexos e linha do tempo do R2', () => {
  const html = recoveryCenterHtml({
    snapshots: [],
    diagnostic: { status: 'ok', errors: 0, warnings: 0, checkedAt: '2026-08-04T20:00:00.000Z', checks: [] },
    remote: {
      available: true,
      loading: false,
      canWrite: true,
      retention: 20,
      backups: [{
        key: '__portal/backups/private-state-v1/backup.json',
        reason: 'publication',
        label: 'Publicação do Portal',
        createdAt: '2026-08-04T20:00:00.000Z',
        size: 1000,
        summary: { treasury: 74, attachments: 9 }
      }],
      diagnostic: {
        status: 'ok',
        errors: [],
        warnings: [],
        current: { updatedAt: '2026-08-04T20:00:00.000Z', summary: { treasury: 74, accounts: 3 } },
        attachments: { referenced: 9, existing: 9, missing: [], orphaned: [] }
      }
    }
  });
  assert.match(html, /Proteção do estado privado/);
  assert.match(html, /74 movimentações/);
  assert.match(html, /9 de 9/);
  assert.match(html, /data-private-backup-restore/);
  assert.match(html, /Criar backup no R2/);
});
