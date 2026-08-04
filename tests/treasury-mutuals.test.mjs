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
        monthlyAmount: 15,
        startedMonth: '2026-06',
        amountHistory: [
          { fromMonth: '2026-06', amount: 15 },
          { fromMonth: '2026-08', amount: 18 }
        ],
        memberships: [
          { id: 'mship1', memberId: 'm1', joinedMonth: '2026-06', endedMonth: '' },
          { id: 'mship2', memberId: 'm2', joinedMonth: '2026-07', endedMonth: '' },
          { id: 'mship3', memberId: 'm3', joinedMonth: '2026-06', endedMonth: '2026-07' }
        ]
      },
      {
        id: 'mu2',
        name: 'Mútua Especial',
        monthlyAmount: 20,
        startedMonth: '2026-08',
        amountHistory: [{ fromMonth: '2026-08', amount: 20 }],
        memberships: [
          { id: 'mship4', memberId: 'm3', joinedMonth: '2026-08', endedMonth: '' }
        ]
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
        mutualMemberId: 'm1',
        mutualReferenceMonth: '2026-07',
        mutualReferenceDate: '2026-07-01',
        mutualChargeKey: 'mu1::m1::2026-07'
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
  treasury.mutualMonth = '2026-07';
  return { state, treasury };
}

test('esquema v10 preserva mútuas mensais, normaliza participantes e prepara anexos financeiros', () => {
  const migrated = migratePortalPayload({
    schemaVersion: 6,
    data: {
      settings: { clubName: 'Lions', initialized: true },
      birthdays: [{ id: 'm1', name: 'Ana' }],
      treasuryAccounts: [],
      treasuryCategories: ['Mensalidades'],
      familyGroups: [],
      mutualGroups: [{
        id: 'mu1',
        name: 'Mútua antiga',
        referenceDate: '2026-07-01',
        memberCharges: [{ memberId: 'm1', amount: 15 }]
      }],
      treasury: [{
        id: 't1',
        date: '2026-07-10',
        category: 'Mútuas',
        entry: 15,
        mutualGroupId: 'mu1',
        mutualMemberId: 'm1',
        mutualChargeKey: 'mu1::m1'
      }],
      events: [], meetings: [], notices: []
    }
  });

  assert.equal(CURRENT_SCHEMA_VERSION, 10);
  assert.equal(migrated.state.mutualGroups[0].monthlyAmount, 15);
  assert.equal(migrated.state.mutualGroups[0].startedMonth, '2026-07');
  assert.deepEqual(migrated.state.mutualGroups[0].memberships.map(item => item.memberId), ['m1']);
  assert.equal(migrated.state.treasury[0].mutualReferenceMonth, '2026-07');
  assert.equal(migrated.state.treasury[0].mutualChargeKey, 'mu1::m1::2026-07');
  assert.ok(migrated.state.treasuryCategories.includes('Mútuas'));
  assert.ok(migrated.migrations.some(item => item.includes('v6→v7')));
  assert.ok(migrated.migrations.some(item => item.includes('v7→v8')));
  assert.ok(migrated.migrations.some(item => item.includes('v8→v9')));
  assert.equal(migrated.state.birthdays[0].status, 'Ativo');
});

test('grupo gera uma cobrança mensal igual para cada associado elegível', () => {
  const { state, treasury } = setup();
  const model = buildMutualViewModel(state, treasury);

  assert.equal(model.selectedGroup.id, 'mu1');
  assert.equal(model.selectedMonth, '2026-07');
  assert.equal(model.charges.length, 3);
  assert.equal(model.expectedTotal, 45);
  assert.equal(model.receivedTotal, 15);
  assert.equal(model.paidCharges.length, 1);
  assert.equal(model.pendingCharges.length, 2);
  assert.ok(model.charges.every(item => item.amount === 15));
});

test('remoção preserva a competência atual e impede cobranças futuras', () => {
  const { state, treasury } = setup();
  treasury.mutualMonth = '2026-08';
  const model = buildMutualViewModel(state, treasury);

  assert.deepEqual(model.charges.map(item => item.member.id), ['m1', 'm2']);
  assert.equal(model.charges.some(item => item.member.id === 'm3'), false);
  assert.equal(model.expectedTotal, 36);
  assert.ok(model.charges.every(item => item.amount === 18));
});

test('pagamento de mútua é mensal, não é confundido com mensalidade e usa chave completa', () => {
  const { treasury } = setup();
  const payment = treasury.mutualPaymentsFor('mu1', 'm1', '2026-07')[0];

  assert.equal(treasury.isMutualEntry(payment), true);
  assert.equal(treasury.isMembershipEntry(payment), false);
  assert.equal(treasury.mutualIsPaid('mu1', 'm1', '2026-07'), true);
  assert.equal(treasury.mutualIsPaid('mu1', 'm1', '2026-08'), false);
  assert.equal(treasury.mutualChargeKey('mu1', 'm2', '2026-07'), 'mu1::m2::2026-07');
});

test('filtros de situação e pesquisa refinam os associados do grupo e mês selecionados', () => {
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

test('seleção em lote considera somente cobranças abertas da competência atual', () => {
  const { state, treasury } = setup();
  treasury.toggleMutualSelection('mu1::m1::2026-07', true);
  treasury.toggleMutualSelection('mu1::m2::2026-07', true);
  treasury.toggleMutualSelection('mu1::m3::2026-07', true);

  const model = buildMutualViewModel(state, treasury);
  assert.deepEqual(model.selectedCharges.map(item => item.key).sort(), [
    'mu1::m2::2026-07',
    'mu1::m3::2026-07'
  ]);
  assert.equal(model.selectedCharges.reduce((sum, item) => sum + item.amount, 0), 30);
});

test('interface de mútuas oferece todos os grupos, intervalo de competências, accordions e baixa em lote', () => {
  const { state, treasury } = setup();
  const html = renderMutualSection({
    model: buildMutualViewModel(state, treasury),
    adminUnlocked: true,
    avatar: member => `<span>${member.name.slice(0, 1)}</span>`,
    empty: (_icon, text) => text
  });

  assert.match(html, /Controle mensal de mútuas/);
  assert.match(html, /Todos os grupos/);
  assert.match(html, /Mês\/Ano inicial/);
  assert.match(html, /Mês\/Ano final/);
  assert.match(html, /type="month"/);
  assert.match(html, /Gerenciar grupos/);
  assert.match(html, /mutual-group-accordion/);
  assert.match(html, /Selecionar pendentes filtradas/);
  assert.match(html, /Dar baixa selecionadas/);
  assert.match(html, /data-mutual-key="mu1::m2::2026-07"/);
  assert.doesNotMatch(html, /valor individual por associado/i);
});

test('filtro Todos reúne os grupos no período e inicia os accordions recolhidos', () => {
  const { state, treasury } = setup();
  treasury.mutualGroup = 'all';
  treasury.mutualStart = '2026-07';
  treasury.mutualEnd = '2026-08';

  const model = buildMutualViewModel(state, treasury);
  assert.equal(model.allGroupsMode, true);
  assert.equal(model.groupSections.length, 2);
  assert.ok(model.groupSections.every(section => section.expanded === false));
  assert.deepEqual(model.months, ['2026-07', '2026-08']);
  assert.ok(model.charges.some(item => item.group.id === 'mu1' && item.month === '2026-07'));
  assert.ok(model.charges.some(item => item.group.id === 'mu2' && item.month === '2026-08'));
});

test('controlador preserva intervalo e estado individual dos accordions', () => {
  const { treasury } = setup();
  treasury.mutualStart = '2025-01';
  treasury.mutualEnd = '2025-06';
  assert.equal(treasury.mutualStart, '2025-01');
  assert.equal(treasury.mutualEnd, '2025-06');
  assert.equal(treasury.isMutualGroupExpanded('mu1'), false);
  treasury.setMutualGroupExpanded('mu1', true);
  assert.equal(treasury.isMutualGroupExpanded('mu1'), true);
  treasury.collapseMutualGroups();
  assert.equal(treasury.isMutualGroupExpanded('mu1'), false);
});

test('baixa exige data manual e gera um movimento individual por associado e competência', async () => {
  const source = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/mutual-payments.js'),
    'utf8'
  );

  assert.match(source, /name="paymentDate" type="date" required value=""/);
  assert.match(source, /const \[groupId, memberId, month\]/);
  assert.match(source, /selected\.forEach\(item => \{/);
  assert.match(source, /state\(\)\.treasury\.push\(\{/);
  assert.match(source, /mutualGroupId: item\.group\.id/);
  assert.match(source, /mutualMemberId: item\.member\.id/);
  assert.match(source, /mutualReferenceMonth: item\.month/);
  assert.match(source, /coveredMonths: \[item\.month\]/);
  assert.match(source, /groupNames = \[\.\.\.new Set/);
  assert.match(source, /monthReferences = \[\.\.\.new Set/);
  assert.doesNotMatch(source, /Realize a baixa de um grupo e de uma competência por vez/);
  assert.match(source, /category: 'Mútuas'/);
});

test('gestão de grupos usa valor mensal único e histórico de participação', async () => {
  const source = await readFile(
    path.join(projectRoot, 'assets/js/modules/treasury-admin/mutual-groups.js'),
    'utf8'
  );

  assert.match(source, /Valor mensal por participante/);
  assert.match(source, /name="memberIds"/);
  assert.match(source, /memberCanJoinMutual/);
  assert.match(source, /Mútua · Mutuário/);
  assert.match(source, /new FormData\(form\)/);
  assert.match(source, /name="startedMonth" type="month" required/);
  assert.match(source, /membership\.endedMonth = currentMonth/);
  assert.match(source, /joinedMonth: editingGroup \? currentMonth : startedMonth/);
  assert.match(source, /amountHistory/);
  assert.match(source, /persist\('Grupo de mútua criado com cobranças mensais\.'/);
  assert.doesNotMatch(source, /data-mutual-amount-for/);
});

test('estilos cobrem criação de grupos, baixa e movimentos de mútuas', async () => {
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
    '.treasury-record-card.is-mutual'
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(escaped));
    assert.match(bundle, new RegExp(escaped));
  }
  assert.match(source, /@media\(max-width:(?:820|560)px\)/);
  assert.match(build, /pages\/memberships\.css/);
});
