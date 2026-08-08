import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CURRENT_SCHEMA_VERSION,
  migratePortalPayload
} from '../assets/js/core/portal-schema.js';
import { createTreasuryController } from '../assets/js/modules/treasury/controller.js';
import {
  buildMutualViewModel,
  renderMutualSection
} from '../assets/js/modules/treasury/mutuals.js';
import { normalize, parseLocalDate, sumTreasury } from '../assets/js/utils.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function setup() {
  const state = {
    settings: {},
    birthdays: [
      { id: 'm1', name: 'Ana', memberNumber: '101', active: true, status: 'Ativo' },
      { id: 'm2', name: 'Bruno', memberNumber: '202', active: true, status: 'Ativo' },
      { id: 'm3', name: 'Carla', memberNumber: '303', active: true, status: 'Mútua' }
    ],
    treasuryAccounts: [{ id: 'a1', name: 'Conta principal', active: true }],
    treasuryCategories: ['Mensalidades', 'Mútuas'],
    familyGroups: [],
    mutualGroups: [
      {
        id: 'mu1',
        name: 'Mútua Social',
        memberships: [
          { id: 'mship1', memberId: 'm1', joinedMonth: '2026-06', endedMonth: '' },
          { id: 'mship2', memberId: 'm2', joinedMonth: '2026-07', endedMonth: '' },
          { id: 'mship3', memberId: 'm3', joinedMonth: '2026-06', endedMonth: '2026-08' }
        ],
        events: [
          {
            id: 'ev1',
            deceasedName: 'Associado do Distrito A',
            occurrenceDate: '2026-07-10',
            createdAt: '2026-07-12T14:30:00.000Z',
            amount: 15,
            participantIds: ['m1', 'm2', 'm3'],
            notes: 'Primeira chamada'
          },
          {
            id: 'ev2',
            deceasedName: 'Associado do Distrito B',
            occurrenceDate: '2026-08-05',
            amount: 18,
            participantIds: ['m1', 'm2'],
            notes: ''
          }
        ]
      },
      {
        id: 'mu2',
        name: 'Mútua Especial',
        memberships: [{ id: 'mship4', memberId: 'm3', joinedMonth: '2026-08', endedMonth: '' }],
        events: [{
          id: 'ev3',
          deceasedName: 'Associado do Distrito C',
          occurrenceDate: '2026-08-20',
          amount: 20,
          participantIds: ['m3'],
          notes: ''
        }]
      }
    ],
    treasury: [
      {
        id: 't1',
        date: '2026-07-15',
        paymentDate: '2026-07-15',
        category: 'Mútuas',
        accountId: 'a1',
        entry: 15,
        exit: 0,
        status: 'Recebido',
        memberId: 'm1',
        memberIds: ['m1'],
        mutualGroupId: 'mu1',
        mutualEventId: 'ev1',
        mutualMemberId: 'm1',
        mutualReferenceDate: '2026-07-10',
        mutualReferenceMonth: '2026-07',
        mutualChargeKey: 'mu1::ev1::m1'
      }
    ]
  };
  const treasury = createTreasuryController({
    getState: () => state,
    parseLocalDate,
    normalize,
    todayStart: () => new Date(2026, 6, 31),
    sumTreasury
  });
  treasury.mutualGroup = 'mu1';
  treasury.mutualStart = '2026-07-01';
  treasury.mutualEnd = '2026-07-31';
  return { state, treasury };
}

test('migração até o esquema atual encerra a cobrança mensal automática e preserva os participantes', () => {
  const migrated = migratePortalPayload({
    schemaVersion: 9,
    data: {
      settings: { clubName: 'Lions', initialized: true },
      birthdays: [{ id: 'm1', name: 'Ana' }],
      treasuryAccounts: [],
      treasuryCategories: ['Mensalidades'],
      familyGroups: [],
      mutualGroups: [{
        id: 'mu1',
        name: 'Mútua antiga',
        monthlyAmount: 15,
        startedMonth: '2026-07',
        amountHistory: [{ fromMonth: '2026-07', amount: 15 }],
        memberships: [{ id: 'mum1', memberId: 'm1', joinedMonth: '2026-07', endedMonth: '' }]
      }],
      treasury: [],
      events: [], meetings: [], notices: []
    }
  });

  assert.equal(CURRENT_SCHEMA_VERSION, 12);
  assert.equal('monthlyAmount' in migrated.state.mutualGroups[0], false);
  assert.equal('startedMonth' in migrated.state.mutualGroups[0], false);
  assert.equal('amountHistory' in migrated.state.mutualGroups[0], false);
  assert.deepEqual(migrated.state.mutualGroups[0].memberships.map(item => item.memberId), ['m1']);
  assert.deepEqual(migrated.state.mutualGroups[0].events, []);
  assert.ok(migrated.migrations.some(item => item.includes('v9→v10')));
});

test('esquema v10 preserva a data local em que a cobrança foi gerada', () => {
  const migrated = migratePortalPayload({
    schemaVersion: 10,
    data: {
      settings: {}, birthdays: [], treasuryAccounts: [], treasuryCategories: [], familyGroups: [], treasury: [],
      mutualGroups: [{
        id: 'mu-date', name: 'Mútua', memberships: [], events: [{
          id: 'ev-date', deceasedName: 'Associado do Distrito', occurrenceDate: '2026-08-01',
          createdDate: '2026-08-07', createdAt: '2026-08-08T01:30:00.000Z', amount: 15, participantIds: []
        }]
      }],
      events: [], meetings: [], notices: []
    }
  });

  assert.equal(migrated.state.mutualGroups[0].events[0].createdDate, '2026-08-07');
  assert.equal(migrated.state.mutualGroups[0].events[0].createdAt, '2026-08-08T01:30:00.000Z');
});

test('consultar participantes preserva o grupo usado para registrar a cobrança', () => {
  const { state, treasury } = setup();
  state.mutualGroups[0].events = [];
  const group = treasury.mutualGroupFor('mu1');
  const participantIds = treasury.mutualActiveMembers('mu1').map(member => String(member.id));

  assert.strictEqual(treasury.mutualGroupFor('mu1'), group);
  group.events.push({
    id: 'ev-new',
    deceasedName: 'Associado do Distrito recém-falecido',
    occurrenceDate: '2026-07-20',
    amount: 25,
    participantIds,
    notes: ''
  });

  const model = buildMutualViewModel(state, treasury);
  assert.equal(state.mutualGroups[0].events.length, 1);
  assert.deepEqual(participantIds, ['m1', 'm2']);
  assert.equal(model.charges.length, 2);
  assert.equal(model.expectedTotal, 50);
});

test('grupo sem falecimento registrado não gera cobrança', () => {
  const { state, treasury } = setup();
  state.mutualGroups[0].events = [];
  const model = buildMutualViewModel(state, treasury);
  assert.equal(model.events.length, 0);
  assert.equal(model.charges.length, 0);
  assert.equal(model.expectedTotal, 0);
});

test('cada falecimento gera uma cobrança para cada participante registrado na ocorrência', () => {
  const { state, treasury } = setup();
  const model = buildMutualViewModel(state, treasury);

  assert.equal(model.selectedGroup.id, 'mu1');
  assert.equal(model.events.length, 1);
  assert.equal(model.charges.length, 3);
  assert.equal(model.expectedTotal, 45);
  assert.equal(model.receivedTotal, 15);
  assert.equal(model.paidCharges.length, 1);
  assert.equal(model.pendingCharges.length, 2);
  assert.ok(model.charges.every(item => item.amount === 15));
});

test('alterar participantes do grupo não modifica uma ocorrência anterior', () => {
  const { state, treasury } = setup();
  state.mutualGroups[0].memberships = [
    { id: 'mship1', memberId: 'm1', joinedMonth: '2026-06', endedMonth: '' }
  ];
  const model = buildMutualViewModel(state, treasury);
  assert.deepEqual(model.charges.map(item => item.member.id), ['m1', 'm2', 'm3']);
});

test('pagamento de mútua usa grupo, falecimento e participante na chave', () => {
  const { treasury } = setup();
  const payment = treasury.mutualPaymentsFor('mu1', 'm1', 'ev1')[0];

  assert.equal(treasury.isMutualEntry(payment), true);
  assert.equal(treasury.isMembershipEntry(payment), false);
  assert.equal(treasury.mutualIsPaid('mu1', 'm1', 'ev1'), true);
  assert.equal(treasury.mutualIsPaid('mu1', 'm1', 'ev2'), false);
  assert.equal(treasury.mutualChargeKey('mu1', 'ev1', 'm2'), 'mu1::ev1::m2');
});

test('filtros de situação e pesquisa refinam as cobranças da ocorrência', () => {
  const { state, treasury } = setup();

  treasury.mutualStatus = 'pending';
  treasury.mutualSearch = 'Bruno';
  let model = buildMutualViewModel(state, treasury);
  assert.deepEqual(model.visibleCharges.map(item => item.member.id), ['m2']);

  treasury.mutualStatus = 'paid';
  treasury.mutualSearch = 'Ana';
  model = buildMutualViewModel(state, treasury);
  assert.deepEqual(model.visibleCharges.map(item => item.member.id), ['m1']);
});

test('seleção em lote considera somente cobranças eventuais em aberto', () => {
  const { state, treasury } = setup();
  treasury.toggleMutualSelection('mu1::ev1::m1', true);
  treasury.toggleMutualSelection('mu1::ev1::m2', true);
  treasury.toggleMutualSelection('mu1::ev1::m3', true);

  const model = buildMutualViewModel(state, treasury);
  assert.deepEqual(model.selectedCharges.map(item => item.key).sort(), [
    'mu1::ev1::m2',
    'mu1::ev1::m3'
  ]);
  assert.equal(model.selectedCharges.reduce((sum, item) => sum + item.amount, 0), 30);
});

test('interface informa que a cobrança ocorre somente por falecimento', () => {
  const { state, treasury } = setup();
  const html = renderMutualSection({
    model: buildMutualViewModel(state, treasury),
    adminUnlocked: true,
    avatar: member => `<span>${member.name.slice(0, 1)}</span>`,
    empty: (_icon, text) => text
  });

  assert.match(html, /Controle de mútuas por falecimento/);
  assert.match(html, /Nenhuma cobrança é criada mensalmente/);
  assert.match(html, /Registrar falecimento/);
  assert.match(html, /Data inicial/);
  assert.match(html, /Data final/);
  assert.match(html, /type="date"/);
  assert.match(html, /Falecimento de Associado do Distrito A/);
  assert.match(html, /Cobrança gerada em 12\/07\/2026/);
  assert.doesNotMatch(html, /Falecimento em 10\/07\/2026/);
  assert.match(html, /data-mutual-key="mu1::ev1::m2"/);
  assert.doesNotMatch(html, /Controle mensal de mútuas/);
});

test('filtro Todos reúne ocorrências de vários grupos no intervalo', () => {
  const { state, treasury } = setup();
  treasury.mutualGroup = 'all';
  treasury.mutualStart = '2026-07-01';
  treasury.mutualEnd = '2026-08-31';

  const model = buildMutualViewModel(state, treasury);
  assert.equal(model.allGroupsMode, true);
  assert.equal(model.groupSections.length, 2);
  assert.ok(model.groupSections.every(section => section.expanded === false));
  assert.equal(model.events.length, 3);
  assert.ok(model.charges.some(item => item.group.id === 'mu1' && item.event.id === 'ev2'));
  assert.ok(model.charges.some(item => item.group.id === 'mu2' && item.event.id === 'ev3'));
});

test('controlador preserva intervalo por data e estado dos accordions', () => {
  const { treasury } = setup();
  treasury.mutualStart = '2025-01-10';
  treasury.mutualEnd = '2025-06-20';
  assert.equal(treasury.mutualStart, '2025-01-10');
  assert.equal(treasury.mutualEnd, '2025-06-20');
  assert.equal(treasury.isMutualGroupExpanded('mu1'), false);
  treasury.setMutualGroupExpanded('mu1', true);
  assert.equal(treasury.isMutualGroupExpanded('mu1'), true);
  treasury.collapseMutualGroups();
  assert.equal(treasury.isMutualGroupExpanded('mu1'), false);
});

test('baixa gera movimento individual vinculado ao falecimento', async () => {
  const source = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/mutual-payments.js'),
    'utf8'
  );

  assert.match(source, /name="paymentDate" type="date" required value=""/);
  assert.match(source, /const \[groupId, eventId, memberId\]/);
  assert.match(source, /mutualEventId: item\.event\.id/);
  assert.match(source, /mutualEventName: item\.event\.deceasedName/);
  assert.match(source, /mutualReferenceDate: item\.event\.occurrenceDate/);
  assert.match(source, /Pagamento de mútua por falecimento/);
  assert.match(source, /category: 'Mútuas'/);
  assert.doesNotMatch(source, /cobranças mensais/i);
});

test('gestão de grupos não possui valor mensal e preserva ocorrências antigas', async () => {
  const source = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/mutual-groups.js'),
    'utf8'
  );

  assert.match(source, /name="memberIds"/);
  assert.match(source, /memberCanJoinMutual/);
  assert.match(source, /Alterações no grupo valem apenas para falecimentos registrados depois/);
  assert.match(source, /events: editingGroup \? \(editingGroup\.events \|\| \[\]\)/);
  assert.match(source, /Grupo de mútua criado sem cobrança automática/);
  assert.doesNotMatch(source, /name="startedMonth"/);
  assert.doesNotMatch(source, /Valor mensal por participante/);
  assert.doesNotMatch(source, /amountHistory/);
});

test('registro de falecimento cria snapshot de participantes e exige confirmação', async () => {
  const source = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/mutual-events.js'),
    'utf8'
  );

  assert.match(source, /Use este formulário somente quando ocorrer o falecimento/);
  assert.match(source, /name="occurrenceDate" type="date" required/);
  assert.match(source, /name="deceasedName" required/);
  assert.match(source, /name="amount"/);
  assert.match(source, /const participantIds = treasury\.mutualActiveMembers/);
  assert.match(source, /participantIds,/);
  assert.match(source, /createdDate: treasury\.currentDate\(\)/);
  assert.match(source, /createdAt: new Date\(\)\.toISOString\(\)/);
  assert.match(source, /confirmation\.askConfirmation/);
  assert.match(source, /Falecimento registrado/);
  assert.match(source, /Depois de gerada, a cobrança é definitiva e não pode ser editada ou excluída/);
  assert.match(source, /uiIcon\('lock'\).*Registro definitivo/);
  assert.doesNotMatch(source, /data-remove-mutual-event/);
  assert.doesNotMatch(source, /Excluir ocorrência de falecimento/);
  assert.doesNotMatch(source, /group\.events = group\.events\.filter/);
});

test('estilos cobrem grupos, ocorrências, baixa e movimentos de mútuas', async () => {
  const [source, bundle, build] = await Promise.all([
    readFile(path.join(projectRoot, 'assets/css/pages/memberships.css'), 'utf8'),
    readFile(path.join(projectRoot, 'assets/css/app.css'), 'utf8'),
    readFile(path.join(projectRoot, 'tools/build-css.mjs'), 'utf8')
  ]);

  for (const selector of [
    '.mutual-toolbar',
    '.mutual-group-accordion',
    '.mutual-member-option',
    '.mutual-event-form',
    '.mutual-event-participants',
    '.mutual-payment-hero',
    '.treasury-record-card.is-mutual'
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(escaped));
    assert.match(bundle, new RegExp(escaped));
  }
  assert.match(source, /@media\(max-width:(?:820|560)px\)/);
  assert.match(build, /pages\/memberships\.css/);
});
