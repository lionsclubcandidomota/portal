import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  currentPublicLeaders,
  publicLeadershipSummary,
  renderLeaders
} from '../assets/js/modules/leaders.js?v=6.44.0';

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(rootPath, relativePath), 'utf8');

function sampleState() {
  return {
    birthdays: [
      { id: 'member-president', name: 'Ana Presidente', birthDate: '1980-01-01', active: true, status: 'Ativo', memberNumber: '123' },
      { id: 'member-treasurer', name: 'Bruno Tesoureiro', birthDate: '1981-01-01', active: true, status: 'Ativo' },
      { id: 'member-inactive', name: 'Carlos Inativo', birthDate: '1982-01-01', active: false, status: 'Inativo' }
    ],
    accessRoles: [
      { id: 'role-president', name: 'Presidente', active: true, permissions: [] },
      { id: 'role-treasurer', name: 'Tesoureiro', active: true, permissions: [] }
    ],
    leadershipAssignments: [
      { id: 'a2', memberId: 'member-treasurer', roleId: 'role-treasurer', lionYear: '2026/2027', startsOn: '2026-07-01', endsOn: '2027-06-30', active: true, notes: 'Não publicar esta observação.' },
      { id: 'a1', memberId: 'member-president', roleId: 'role-president', lionYear: '2026/2027', startsOn: '2026-07-01', endsOn: '2027-06-30', active: true },
      { id: 'a3', memberId: 'member-inactive', roleId: 'role-treasurer', lionYear: '2026/2027', startsOn: '2026-07-01', endsOn: '2027-06-30', active: true },
      { id: 'a4', memberId: 'member-president', roleId: 'role-president', lionYear: '2025/2026', startsOn: '2025-07-01', endsOn: '2026-06-30', active: true }
    ]
  };
}

test('área pública usa somente designações vigentes e ordena os principais cargos', () => {
  const leaders = currentPublicLeaders(sampleState(), new Date('2026-08-08T12:00:00'));
  assert.deepEqual(leaders.map(item => item.role.name), ['Presidente', 'Tesoureiro']);
  assert.deepEqual(leaders.map(item => item.member.name), ['Ana Presidente', 'Bruno Tesoureiro']);
});

test('resumo público usa o Ano Leonístico vigente sem expor dados internos', () => {
  const state = sampleState();
  const summary = publicLeadershipSummary(state, new Date('2026-08-08T12:00:00'));
  assert.equal(summary.lionYear, '2026/2027');
  assert.equal(summary.count, 2);
  assert.equal(summary.roleCount, 2);

  const root = { innerHTML: '' };
  renderLeaders(state, { root, empty: (_icon, text) => `<div>${text}</div>`, at: new Date('2026-08-08T12:00:00') });
  assert.match(root.innerHTML, /Dirigentes do AL 2026\/2027/);
  assert.match(root.innerHTML, /Ana Presidente/);
  assert.match(root.innerHTML, /Tesoureiro/);
  assert.doesNotMatch(root.innerHTML, /123/);
  assert.doesNotMatch(root.innerHTML, /Não publicar esta observação/);
});

test('área pública apresenta estado vazio quando a diretoria ainda não foi publicada', () => {
  const root = { innerHTML: '' };
  renderLeaders({ birthdays: [], accessRoles: [], leadershipAssignments: [] }, {
    root,
    empty: (_icon, text) => `<div class="empty-test">${text}</div>`,
    at: new Date('2026-08-08T12:00:00')
  });
  assert.match(root.innerHTML, /empty-test/);
  assert.match(root.innerHTML, /ainda não foram publicados/);
});

test('navegação oferece acesso público aos Dirigentes', async () => {
  const [html, navigation, renderer] = await Promise.all([
    source('index.html'),
    source('assets/js/modules/navigation.js'),
    source('assets/js/modules/portal-view-renderer.js')
  ]);
  assert.match(html, /data-view="leaders"[\s\S]*?<span class="nav-label">Dirigentes<\/span>/);
  assert.match(navigation, /leaders:\s*'Dirigentes'/);
  assert.match(renderer, /leaders:\s*renderLeadersView/);
});
