import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_SCHEMA_VERSION,
  PortalSchemaError,
  createPortalEnvelope,
  detectPortalSchemaVersion,
  migratePortalPayload,
  normalizePortalStateShape,
  validatePortalState
} from '../assets/js/core/portal-schema.js';

const minimalState = () => ({
  settings: { clubName: 'Lions Teste', initialized: true },
  birthdays: [],
  treasuryAccounts: [],
  treasuryCategories: ['Mensalidades'],
  familyGroups: [],
  mutualGroups: [],
  treasury: [],
  events: [],
  meetings: [],
  notices: []
});

test('migra estado local legado sem envelope para o esquema atual', () => {
  const result = migratePortalPayload({
    settings: { clubName: 'Legado' },
    treasury: [{ id: 't1' }]
  });

  assert.equal(result.sourceSchemaVersion, 0);
  assert.equal(result.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(result.migrated, true);
  assert.equal(result.state.settings.clubName, 'Legado');
  assert.equal(result.state.treasury.length, 1);
  assert.deepEqual(result.state.events, []);
});

test('migra backup v1 preservando os dados existentes', () => {
  const result = migratePortalPayload({
    app: 'Lions',
    version: 1,
    exportedAt: '2025-01-01T00:00:00.000Z',
    data: { settings: { clubName: 'Backup antigo' }, notices: [{ id: 'n1' }] }
  });

  assert.equal(result.sourceSchemaVersion, 1);
  assert.equal(result.state.settings.clubName, 'Backup antigo');
  assert.equal(result.state.notices[0].id, 'n1');
  assert.ok(result.migrations.some(item => item.includes('v1→v2')));
});

test('consolida propriedades que existiam fora de data no modelo v2', () => {
  const result = migratePortalPayload({
    app: 'Lions',
    version: 2,
    data: {
      settings: { clubName: 'Clube', initialized: true },
      treasury: []
    },
    treasuryAccounts: [{ id: 'acc-1', name: 'Conta' }],
    settings: { membershipFamilyPrimaryFee: 45 }
  });

  assert.equal(result.state.settings.clubName, 'Clube');
  assert.equal(result.state.settings.membershipFamilyPrimaryFee, 45);
  assert.equal(result.state.treasuryAccounts[0].id, 'acc-1');
});

test('rejeita esquema de uma versão futura para evitar perda de dados', () => {
  assert.throws(
    () => migratePortalPayload({ schemaVersion: 99, data: minimalState() }),
    error => error instanceof PortalSchemaError
      && error.code === 'UNSUPPORTED_FUTURE_SCHEMA'
      && error.details.supportedSchemaVersion === CURRENT_SCHEMA_VERSION
  );
});

test('cria envelope atual com metadados e dados normalizados', () => {
  const payload = createPortalEnvelope(minimalState(), {
    updatedAt: '2026-07-30T20:00:00.000Z',
    deploymentId: 'deploy-1'
  });

  assert.equal(payload.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(payload.version, CURRENT_SCHEMA_VERSION);
  assert.equal(payload.updatedAt, '2026-07-30T20:00:00.000Z');
  assert.equal(payload.deploymentId, 'deploy-1');
  assert.equal(payload.data.settings.clubName, 'Lions Teste');
});

test('o ciclo envelope → migração é idempotente', () => {
  const first = createPortalEnvelope({
    ...minimalState(),
    customModule: { enabled: true }
  });
  const migrated = migratePortalPayload(first);
  const second = createPortalEnvelope(migrated.state);

  assert.deepEqual(second.data, first.data);
  assert.equal(migrated.migrated, false);
  assert.equal(migrated.state.customModule.enabled, true);
});

test('normalização corrige coleções inválidas sem remover campos desconhecidos', () => {
  const normalized = normalizePortalStateShape({
    settings: null,
    birthdays: 'inválido',
    treasuryCategories: null,
    futureFeature: { value: 10 }
  });

  assert.deepEqual(normalized.birthdays, []);
  assert.ok(normalized.treasuryCategories.includes('Mensalidades'));
  assert.ok(normalized.treasuryCategories.includes('Mútuas'));
  assert.deepEqual(normalized.mutualGroups, []);
  assert.equal(normalized.futureFeature.value, 10);
  assert.equal(typeof normalized.settings, 'object');
});

test('validador informa erros estruturais sem alterar o estado', () => {
  const invalid = { settings: {}, treasury: {} };
  const validation = validatePortalState(invalid);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('treasury deve ser uma lista.'));
  assert.deepEqual(invalid, { settings: {}, treasury: {} });
});

test('detecção prioriza schemaVersion explícito e reconhece envelopes legados', () => {
  assert.equal(detectPortalSchemaVersion({ schemaVersion: 3, version: 1, data: {} }), 3);
  assert.equal(detectPortalSchemaVersion({ app: 'Lions', version: 2, data: {} }), 2);
  assert.equal(detectPortalSchemaVersion({ settings: {} }), 0);
});
