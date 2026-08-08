import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTreasuryController } from '../assets/js/modules/treasury/controller.js';
import { buildMutualViewModel, renderMutualSection } from '../assets/js/modules/treasury/mutuals.js';
import { normalize, parseLocalDate, sumTreasury } from '../assets/js/utils.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

function setupMutualGroup() {
  const state = {
    settings: {},
    birthdays: [
      { id: 'associate-1', name: 'Ana Associada', memberNumber: '1001', active: true, status: 'Ativo' },
      { id: 'mutual-1', name: 'Bruno Mutuário', memberNumber: '', active: true, status: 'Mútua' },
      { id: 'associate-2', name: 'Carla Associada', memberNumber: '1002', active: true, status: 'Ativo' }
    ],
    treasuryAccounts: [],
    treasuryCategories: [],
    familyGroups: [],
    mutualGroups: [{
      id: 'group-1',
      name: 'Mútua 658',
      memberships: [
        { id: 'membership-1', memberId: 'associate-1', joinedMonth: '2026-01', endedMonth: '' },
        { id: 'membership-2', memberId: 'mutual-1', joinedMonth: '2026-01', endedMonth: '' },
        { id: 'membership-3', memberId: 'associate-2', joinedMonth: '2026-01', endedMonth: '' }
      ],
      events: []
    }],
    treasury: []
  };
  const treasury = createTreasuryController({
    getState: () => state,
    parseLocalDate,
    normalize,
    todayStart: () => new Date(2026, 7, 8),
    sumTreasury
  });
  treasury.mutualGroup = 'group-1';
  return { state, treasury };
}

test('grupo de Mútua expõe todos os participantes ativos e separa os tipos', () => {
  const { state, treasury } = setupMutualGroup();
  const model = buildMutualViewModel(state, treasury);
  const section = model.groupSections[0];

  assert.equal(section.activeParticipants.length, 3);
  assert.equal(section.associateCount, 2);
  assert.equal(section.mutualCount, 1);
  assert.deepEqual(section.activeParticipants.map(item => item.kind), ['associate', 'mutual', 'associate']);
});

test('accordion da Mútua mostra participantes, associados e mutuários ao expandir', () => {
  const { state, treasury } = setupMutualGroup();
  const html = renderMutualSection({
    model: buildMutualViewModel(state, treasury),
    adminUnlocked: true,
    avatar: member => `<span class="avatar">${member.name.slice(0, 1)}</span>`,
    empty: (_icon, text) => `<p>${text}</p>`
  });

  assert.match(html, /Quem participa das próximas cobranças/);
  assert.match(html, /Ana Associada/);
  assert.match(html, /Bruno Mutuário/);
  assert.match(html, /Carla Associada/);
  assert.match(html, /mutual-participant-type is-associate">Associado/);
  assert.match(html, /mutual-participant-type is-mutual">Mutuário/);
  assert.match(html, /3 participante\(s\): 2 associado\(s\) · 1 mutuário\(s\)/);
});

test('listas existentes de famílias e Mútuas iniciam recolhidas ao criar novo grupo', async () => {
  const [families, mutuals] = await Promise.all([
    source('assets/js/modules/treasury-admin/family-groups.js'),
    source('assets/js/modules/treasury-admin/mutual-groups.js')
  ]);

  assert.match(families, /const existingListExpanded = Boolean\(editingGroup\)/);
  assert.match(families, /data-family-list-toggle aria-expanded="\$\{existingListExpanded\}"/);
  assert.match(families, /id="\$\{existingListId\}" \$\{existingListExpanded \? '' : 'hidden'\}/);
  assert.match(families, /Recolhida para priorizar o cadastro de novos integrantes/);

  assert.match(mutuals, /const existingListExpanded = Boolean\(editingGroup\)/);
  assert.match(mutuals, /data-mutual-list-toggle aria-expanded="\$\{existingListExpanded\}"/);
  assert.match(mutuals, /id="\$\{existingListId\}" \$\{existingListExpanded \? '' : 'hidden'\}/);
  assert.match(mutuals, /Recolhida para deixar o cadastro de participantes em destaque/);
});

test('listas recolhíveis continuam acessíveis e abrem automaticamente durante edição', async () => {
  const [families, mutuals] = await Promise.all([
    source('assets/js/modules/treasury-admin/family-groups.js'),
    source('assets/js/modules/treasury-admin/mutual-groups.js')
  ]);

  for (const text of [families, mutuals]) {
    assert.match(text, /aria-controls="\$\{existingListId\}"/);
    assert.match(text, /getAttribute\('aria-expanded'\) !== 'true'/);
    assert.match(text, /classList\.toggle\('is-expanded', opening\)/);
    assert.match(text, /existingListContent\.hidden = !opening/);
  }
});

test('camada visual diferencia participantes e padroniza os recolhimentos', async () => {
  const [memberships, interfaceCss, bundle] = await Promise.all([
    source('assets/css/pages/memberships.css'),
    source('assets/css/components/modern-interface.css'),
    source('assets/css/app.css')
  ]);

  for (const selector of [
    '.mutual-participants-panel',
    '.mutual-participant-card.is-mutual',
    '.mutual-participant-type.is-associate',
    '.mutual-participant-type.is-mutual'
  ]) {
    assert.match(memberships, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(bundle, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const selector of ['.management-list-toggle', '.management-list-content', '.management-list-chevron']) {
    assert.match(interfaceCss, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(bundle, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
