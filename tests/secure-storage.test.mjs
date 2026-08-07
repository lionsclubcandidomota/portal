import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectSecureTreasuryObjectKeys,
  isSecureTreasuryAttachment,
  legacyTreasuryAttachmentPath,
  normalizeSecureStorageWorkerUrl,
  secureStorageProfileFromState
} from '../assets/js/modules/secure-storage/client.js';
import { migratePortalPayload } from '../assets/js/core/portal-schema.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('configuração do armazenamento aceita somente Worker Cloudflare HTTPS ou homologação local', () => {
  assert.equal(
    normalizeSecureStorageWorkerUrl('https://lions-portal-anexos.exemplo.workers.dev/'),
    'https://lions-portal-anexos.exemplo.workers.dev'
  );
  assert.equal(
    normalizeSecureStorageWorkerUrl('http://localhost:8787'),
    'http://localhost:8787'
  );
  assert.throws(
    () => normalizeSecureStorageWorkerUrl('https://servidor-nao-autorizado.example.com'),
    /Cloudflare Worker|URL HTTPS válida/
  );
});

test('perfil seguro e referências R2 não expõem URL pública permanente', () => {
  const state = {
    settings: {
      secureStorage: {
        version: 1,
        enabled: true,
        workerUrl: 'https://lions-portal-anexos.exemplo.workers.dev'
      }
    },
    treasury: [{
      id: 'mov-1',
      attachments: [{
        id: 'att-1',
        name: 'Comprovante.pdf',
        storage: 'r2',
        objectKey: 'treasury/mov-1/att-1-abc123.pdf'
      }]
    }]
  };
  const profile = secureStorageProfileFromState(state);
  assert.equal(profile.enabled, true);
  assert.equal(isSecureTreasuryAttachment(state.treasury[0].attachments[0]), true);
  assert.deepEqual([...collectSecureTreasuryObjectKeys(state)], ['treasury/mov-1/att-1-abc123.pdf']);
  assert.equal(legacyTreasuryAttachmentPath(state.treasury[0].attachments[0]), '');
});

test('esquema v11 preserva metadados R2 e migra anexos públicos antigos', () => {
  const migrated = migratePortalPayload({
    schemaVersion: 9,
    version: 9,
    data: {
      settings: { clubName: 'Portal', initialized: true },
      birthdays: [],
      treasuryAccounts: [],
      treasuryCategories: [],
      familyGroups: [],
      mutualGroups: [],
      events: [],
      meetings: [],
      notices: [],
      treasury: [{
        id: 'mov-1',
        attachments: [
          { id: 'r2', storage: 'r2', objectKey: 'treasury/mov-1/r2-a1.pdf', name: 'R2.pdf' },
          { id: 'legacy', url: './public/treasury/mov-1/legacy.pdf', name: 'Legado.pdf' }
        ]
      }]
    }
  });
  assert.equal(migrated.schemaVersion, 11);
  assert.equal(migrated.state.treasury[0].attachments[0].storage, 'r2');
  assert.equal(migrated.state.treasury[0].attachments[0].url, undefined);
  assert.equal(migrated.state.treasury[0].attachments[1].url, './public/treasury/mov-1/legacy.pdf');
  assert.match(migrated.migrations.join(' '), /v9→v10/);
  assert.match(migrated.migrations.join(' '), /v10→v11/);
});

test('Worker usa binding R2, segredo de sessão e autorização por perfil', async () => {
  const worker = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/src/index.js'), 'utf8');
  const wrangler = await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/wrangler.toml.example'), 'utf8');
  const publication = await readFile(path.join(projectRoot, 'assets/js/modules/portal-runtime/publication.js'), 'utf8');
  const privateSync = await readFile(path.join(projectRoot, 'assets/js/modules/portal-runtime/private-sync.js'), 'utf8');

  assert.match(wrangler, /\[\[r2_buckets\]\]/);
  assert.match(wrangler, /binding = "ATTACHMENTS"/);
  assert.doesNotMatch(wrangler, /SESSION_SECRET\s*=/);
  assert.match(await readFile(path.join(projectRoot, 'cloudflare/attachment-worker/README.md'), 'utf8'), /wrangler secret put SESSION_SECRET/);
  assert.match(worker, /requireSession\(request, env, \['admin'\]\)/);
  assert.match(worker, /requireSession\(request, env, \['admin', 'director'\]\)/);
  assert.match(worker, /DIRECTOR_PASSWORD_ITERATIONS = 100000/);
  assert.doesNotMatch(worker, /iterations:\s*Math\.max\(100000, Number\(iterations \|\| 210000\)\)/);
  assert.match(worker, /directorPbkdf2Iterations/);
  assert.match(worker, /env\.ATTACHMENTS\.put/);
  assert.match(worker, /attachment-access/);
  assert.doesNotMatch(worker, /(?:ghp_|github_pat_)[A-Za-z0-9_]+/);
  assert.match(privateSync, /prepareSecureTreasuryAttachmentsForPublication/);
  assert.match(privateSync, /deleteSecureTreasuryObjects/);
  assert.match(publication, /deletedPublicPaths/);
  assert.match(publication, /createPublicPortalState/);
  assert.match(publication, /pendingDeletedPublicPaths/);
  assert.doesNotMatch(publication, /savePrivatePortalState/);
});
