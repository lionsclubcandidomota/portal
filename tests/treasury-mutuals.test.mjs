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
      { id: 'm1', name: 'Ana', memberNumber: '101', active: true },
      { id: 'm2', name: 'Bruno', memberNumber: '202', active: true },
      { id: 'm3', name: 'Carla', memberNumber: '303', active: true }
    ],
    treasuryAccounts: [{ id: 'a1', name: 'Conta principal', active: true }],
    treasuryCategories: ['Mensalidades', 'Mútuas'],
    familyGroups: [],
    mutualGroups: [
      {
        id: 'mu1',
        name: 'Mútua Social',
        createdDate: '2026-06-01',
        closedDate: '',
        closureReason: '',
        memberships: [
          { id: 'mship1', memberId: 'm1', joinedDate: '2026-06-01', endedDate: '' },
          { id: 'mship2', memberId: 'm2', joinedDate: '2026-06-01', endedDate: '' },
          { id: 'mship3', memberId: 'm3', joinedDate: '2026-06-01', endedDate: '2026-07-31' }
        ],
        events: [
          {
            id: 'e1',
            deceasedName: 'João do Distrito',
            deathDate: '2026-07-10',
            amountPerParticipant: 15,
            participantIds: ['m1', 'm2', 'm3'],
            notes: ''
          },
          {
            id: 'e2',
            deceasedName: 'Maria do Distrito',
            deathDate: '2026-08-05',
            amountPerParticipant: 18,
            participantIds: ['m1', 'm2'],
            notes: ''
          }
        ]
      },
      {
        id: 'mu2',
        name: 'Mútua Especial',
        createdDate: '2026-08-01',
        closedDate: '',
        memberships: [{ id: 'mship4', memberId: 'm3', joinedDate: '2026-08-01', endedDate: '' }],
        events: [{
          id: 'e3',
          deceasedName: 'Pedro do Distrito',
          deathDate: '2026-08-20',
          amountPerParticipant: 20,
          participantIds: ['m3']
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
        mutualEventId: 'e1',
        mutualEventDate: '2026-07-10',
        mutualDeceasedName: 'João do Distrito',
        mutualMemberId: 'm1',
        mutualChargeKey: 'mu1::e1::m1'
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

test('esquema v11 remove recorrência mensal legada e preserva o grupo ativo sem eventos automáticos', () => {
  const migrated = migratePortalPayload({
    schemaVersion: 10,
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

  assert.equal(CURRENT_SCHEMA_VERSION, 11);
  const group = migrated.state.mutualGroups[0];
  assert.equal(group.createdDate, '2026-07-01');
  assert.equal(group.closedDate, '');
  assert.equal(group.monthlyAmount, undefined);
  assert.equal(group.startedMonth, undefined);
  assert.deepEqual(group.memberships.map(item => item.memberId), ['m1']);
  assert.deepEqual(group.events, []);
  assert.match(migrated.migrations.join(' '), /v10→v11/);
});

test('grupo ativo sem falecimento não gera cobrança', () => {
  const { state, treasury } = setup();
  state.mutualGroups[0].events = [];
  const model = buildMutualViewModel(state, treasury);
  assert.equal(model.charges.length, 0);
  assert.equal(model.expectedTotal, 0);
});

test('evento de falecimento gera uma cobrança única para cada participante congelado', () => {
  const { state, treasury } = setup();
  const model = buildMutualViewModel(state, treasury);

  assert.equal(model.charges.length, 3);
  assert.equal(model.expectedTotal, 45);
  assert.equal(model.receivedTotal, 15);
  assert.equal(model.paidCharges.length, 1);
  assert.equal(model.pendingCharges.length, 2);
  assert.ok(model.charges.every(item => item.event.id === 'e1' && item.amount === 15));
});

test('participantes repetidos no estado são deduplicados no grupo e nas cobranças', () => {
  const { state, treasury } = setup();
  state.mutualGroups[0].memberships.push({
    id: 'mship-duplicada',
    memberId: 'm1',
    joinedDate: '2026-06-01',
    endedDate: ''
  });
  state.mutualGroups[0].events[0].participantIds = ['m1', 'm1', 'm2', 'm2'];

  const model = buildMutualViewModel(state, treasury);
  assert.deepEqual(model.groupSections[0].members.map(item => item.member.id), ['m1', 'm2']);
  assert.deepEqual(model.charges.map(item => item.member.id), ['m1', 'm2']);
});

test('alterações futuras no grupo não reescrevem participantes de eventos anteriores', () => {
  const { state, treasury } = setup();
  treasury.mutualStart = '2026-08-01';
  treasury.mutualEnd = '2026-08-31';
  const model = buildMutualViewModel(state, treasury);

  assert.deepEqual(model.charges.map(item => item.member.id), ['m1', 'm2']);
  assert.equal(model.charges.some(item => item.member.id === 'm3'), false);
  assert.equal(model.expectedTotal, 36);
});

test('pagamento de mútua usa grupo, evento e participante e não é confundido com mensalidade', () => {
  const { treasury } = setup();
  const payment = treasury.mutualPaymentsFor('mu1', 'e1', 'm1')[0];

  assert.equal(treasury.isMutualEntry(payment), true);
  assert.equal(treasury.isMembershipEntry(payment), false);
  assert.equal(treasury.mutualIsPaid('mu1', 'e1', 'm1'), true);
  assert.equal(treasury.mutualIsPaid('mu1', 'e1', 'm2'), false);
  assert.equal(treasury.mutualChargeKey('mu1', 'e1', 'm2'), 'mu1::e1::m2');
});

test('filtros de situação e pesquisa refinam as cobranças por evento', () => {
  const { state, treasury } = setup();

  treasury.mutualStatus = 'pending';
  treasury.mutualSearch = 'Bruno';
  let model = buildMutualViewModel(state, treasury);
  assert.deepEqual(model.visibleCharges.map(item => item.member.id), ['m2']);

  treasury.mutualStatus = 'paid';
  treasury.mutualSearch = 'João';
  model = buildMutualViewModel(state, treasury);
  assert.deepEqual(model.visibleCharges.map(item => item.member.id), ['m1']);
});

test('seleção em lote considera somente cobranças abertas do evento', () => {
  const { state, treasury } = setup();
  treasury.toggleMutualSelection('mu1::e1::m1', true);
  treasury.toggleMutualSelection('mu1::e1::m2', true);
  treasury.toggleMutualSelection('mu1::e1::m3', true);

  const model = buildMutualViewModel(state, treasury);
  assert.deepEqual(model.selectedCharges.map(item => item.key).sort(), [
    'mu1::e1::m2',
    'mu1::e1::m3'
  ]);
  assert.equal(model.selectedCharges.reduce((sum, item) => sum + item.amount, 0), 30);
});

test('interface explica cobrança por falecimento e não oferece recorrência mensal', () => {
  const { state, treasury } = setup();
  const html = renderMutualSection({
    model: buildMutualViewModel(state, treasury),
    adminUnlocked: true,
    avatar: member => `<span>${member.name.slice(0, 1)}</span>`,
    empty: (_icon, text) => text
  });

  assert.match(html, /Mútuas por evento de falecimento/);
  assert.match(html, /Registrar falecimento/);
  assert.match(html, /Data inicial/);
  assert.match(html, /type="date"/);
  assert.match(html, /João do Distrito/);
  assert.match(html, /data-mutual-key="mu1::e1::m2"/);
  assert.match(html, /data-mutual-group-view="charges"/);
  assert.match(html, /data-mutual-group-view="participants"/);
  assert.match(html, /data-mutual-group-panel="charges" role="tabpanel"/);
  assert.match(html, /data-mutual-group-panel="participants" role="tabpanel" hidden/);
  assert.match(html, /data-mutual-group-member="m1"/);
  assert.match(html, /Composição atual do grupo/);
  assert.match(html, /mutual-charge-row/);
  assert.doesNotMatch(html, /membership-family-chip/);
  assert.equal(buildMutualViewModel(state, treasury).groupSections[0].members.length, 2);
  assert.doesNotMatch(html, /Controle mensal de mútuas|Valor mensal por participante|competência/i);
});

test('grupo sem evento abre participantes e grupo com cobrança separa as duas visualizações', () => {
  const { state, treasury } = setup();
  state.mutualGroups[0].events = [];
  const emptyEventModel = buildMutualViewModel(state, treasury);
  assert.equal(emptyEventModel.groupSections[0].view, 'participants');

  state.mutualGroups[0].events = [{
    id: 'e4',
    deceasedName: 'Evento novo',
    deathDate: '2026-07-20',
    amountPerParticipant: 10,
    participantIds: ['m1', 'm2']
  }];
  const eventModel = buildMutualViewModel(state, treasury);
  assert.equal(eventModel.groupSections[0].view, 'charges');

  treasury.setMutualGroupView('mu1', 'participants');
  assert.equal(buildMutualViewModel(state, treasury).groupSections[0].view, 'participants');
});

test('filtro Todos reúne eventos dos grupos no período e inicia accordions recolhidos', () => {
  const { state, treasury } = setup();
  treasury.mutualGroup = 'all';
  treasury.mutualStart = '2026-07-01';
  treasury.mutualEnd = '2026-08-31';

  const model = buildMutualViewModel(state, treasury);
  assert.equal(model.allGroupsMode, true);
  assert.equal(model.groupSections.length, 2);
  assert.ok(model.groupSections.every(section => section.expanded === false));
  assert.equal(model.eventCount, 3);
  assert.ok(model.charges.some(item => item.group.id === 'mu1' && item.event.id === 'e1'));
  assert.ok(model.charges.some(item => item.group.id === 'mu2' && item.event.id === 'e3'));
});

test('controlador preserva intervalo por data e estado individual dos accordions', () => {
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
  assert.equal(treasury.mutualGroupView('mu1', true), 'charges');
  treasury.setMutualGroupView('mu1', 'participants');
  assert.equal(treasury.mutualGroupView('mu1', true), 'participants');
});

test('registro de falecimento cria evento único e congela participantes', async () => {
  const source = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/mutual-events.js'),
    'utf8'
  );
  assert.match(source, /Falecimento de associado do distrito/);
  assert.match(source, /amountPerParticipant/);
  assert.match(source, /participantIds: participants\.map/);
  assert.match(source, /mutual-event-workspace/);
  assert.match(source, /mutual-event-participant-list/);
  assert.match(source, /mutual-event-participant/);
  assert.match(source, /setMutualGroupView\(group\.id, 'charges'\)/);
  assert.match(source, /group\.events\.push/);
  assert.match(source, /não cria recorrência/i);
});

test('baixa gera movimento individual vinculado ao evento, sem competência mensal', async () => {
  const source = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/mutual-payments.js'),
    'utf8'
  );

  assert.match(source, /name="paymentDate" type="date" required value=""/);
  assert.match(source, /const \[groupId, eventId, memberId\]/);
  assert.match(source, /mutualEventId: item\.event\.id/);
  assert.match(source, /mutualEventDate: item\.event\.deathDate/);
  assert.match(source, /mutualDeceasedName: item\.event\.deceasedName/);
  assert.doesNotMatch(source, /mutualReferenceMonth|coveredMonths|Pagamento mensal/);
  assert.match(source, /category: 'Mútuas'/);
  assert.match(source, /groupChargesByEvent/);
  assert.match(source, /mutual-payment-event-group/);
  assert.match(source, /setMutualGroupView\(item\.group\.id, 'charges'\)/);
});

test('gestão do grupo cria ativo sem baixa e exige motivo para encerramento', async () => {
  const source = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/mutual-groups.js'),
    'utf8'
  );

  assert.match(source, /Grupo de mutuários criado ativo, sem cobranças automáticas/);
  assert.match(source, /name="createdDate" type="date" required/);
  assert.match(source, /name="closedDate" type="date"/);
  assert.match(source, /name="closureReason"/);
  assert.match(source, /Para dar baixa no grupo, informe a data e o motivo/);
  assert.match(source, /membership\.endedDate = today/);
  assert.doesNotMatch(source, /monthlyAmount|amountHistory|startedMonth|Valor mensal/);
});

test('estilos cobrem grupos, eventos, baixa e movimentos de mútuas', async () => {
  const [source, bundle, build] = await Promise.all([
    readFile(path.join(projectRoot, 'assets/css/pages/memberships.css'), 'utf8'),
    readFile(path.join(projectRoot, 'assets/css/app.css'), 'utf8'),
    readFile(path.join(projectRoot, 'tools/build-css.mjs'), 'utf8')
  ]);

  for (const selector of [
    '.mutual-toolbar',
    '.mutual-group-accordion',
    '.mutual-member-option',
    '.mutual-payment-hero',
    '.mutual-event-workspace',
    '.mutual-event-participant',
    '.mutual-group-view-tabs',
    '.mutual-event-card',
    '.mutual-charge-row',
    '.mutual-group-members',
    '.mutual-group-member-card',
    '.mutual-payment-event-group',
    '.treasury-record-card.is-mutual'
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(escaped));
    assert.match(bundle, new RegExp(escaped));
  }
  assert.match(source, /@media\(max-width:(?:820|560)px\)/);
  assert.match(build, /pages\/memberships\.css/);
});
