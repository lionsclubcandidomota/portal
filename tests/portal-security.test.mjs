import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSecuritySummary,
  findSensitivePortalFields,
  normalizeGitHubToken,
  stripSensitivePortalFields
} from '../assets/js/core/portal-security.js';
import {
  CURRENT_SCHEMA_VERSION,
  createPortalEnvelope,
  migratePortalPayload
} from '../assets/js/core/portal-schema.js';

test('remove credenciais legadas e segredos aninhados sem alterar os demais dados', () => {
  const original = {
    settings: {
      clubName: 'Lions',
      adminUser: 'legacy',
      adminPassword: 'legacy-secret'
    },
    integration: {
      apiKey: 'secret-key',
      enabled: true
    },
    notices: [{ id: 'n1', title: 'Aviso' }]
  };

  const clean = stripSensitivePortalFields(original);
  assert.equal(clean.settings.clubName, 'Lions');
  assert.equal('adminUser' in clean.settings, false);
  assert.equal('adminPassword' in clean.settings, false);
  assert.deepEqual(clean.integration, { enabled: true });
  assert.equal(original.settings.adminPassword, 'legacy-secret');
  assert.deepEqual(findSensitivePortalFields(clean), []);
});

test('migração v4 elimina credenciais antes de criar o estado v5', () => {
  const migrated = migratePortalPayload({
    app: 'Lions',
    schemaVersion: 4,
    version: 4,
    data: {
      settings: {
        clubName: 'Clube',
        initialized: true,
        adminUser: 'admin',
        adminPassword: 'secret'
      }
    }
  });

  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.sourceSchemaVersion, 4);
  assert.equal('adminUser' in migrated.state.settings, false);
  assert.equal('adminPassword' in migrated.state.settings, false);
  assert.ok(migrated.migrations.some(item => item.includes('v4→v5')));
});

test('envelope remove segredos tanto dos dados quanto dos metadados', () => {
  const envelope = createPortalEnvelope({
    settings: { clubName: 'Clube', initialized: true, token: 'state-secret' }
  }, {
    updatedAt: '2026-07-30T22:00:00.000Z',
    githubToken: 'metadata-secret'
  });

  assert.equal(envelope.updatedAt, '2026-07-30T22:00:00.000Z');
  assert.equal('githubToken' in envelope, false);
  assert.equal('token' in envelope.data.settings, false);
  assert.deepEqual(createSecuritySummary(envelope).sensitivePaths, []);
});

test('normalização do token rejeita entradas vazias, curtas ou com espaços', () => {
  assert.equal(normalizeGitHubToken('  github_pat_example123  '), 'github_pat_example123');
  assert.throws(() => normalizeGitHubToken(''), /Informe um token/);
  assert.throws(() => normalizeGitHubToken('curto'), /muito curto/);
  assert.throws(() => normalizeGitHubToken('token com espaço'), /espaços/);
});
