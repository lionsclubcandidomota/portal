import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicLeadersForYear } from '../assets/js/core/public-leadership.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

test('Usuários e cargos permite expandir e retrair as três áreas principais', async () => {
  const [controller, css] = await Promise.all([
    source('assets/js/modules/access-management.js'),
    source('assets/css/components/access-management.css')
  ]);
  for (const section of ['roles', 'users', 'history']) {
    assert.match(controller, new RegExp(`key: '${section}'`));
  }
  assert.match(controller, /data-access-toggle/);
  assert.match(controller, /aria-expanded/);
  assert.match(controller, /access-section-body/);
  assert.match(css, /\.access-collapsible-section/);
  assert.match(css, /\.access-section-toggle/);
});

test('histórico administrativo usa fotos e permite recolher cada Ano Leonístico', async () => {
  const [controller, css] = await Promise.all([
    source('assets/js/modules/access-management.js'),
    source('assets/css/components/access-management.css')
  ]);
  assert.match(controller, /memberPhotoSourceSet/);
  assert.match(controller, /memberAvatar\(member, \{ historical: true \}\)/);
  assert.match(controller, /data-access-year-toggle/);
  assert.match(controller, /yearOpenState/);
  assert.match(css, /\.access-user-avatar\.is-history-avatar/);
  assert.match(css, /\.leadership-year-heading\[aria-expanded="true"\]/);
});

test('histórico público preserva ex-dirigentes que hoje estão inativos', () => {
  const state = {
    birthdays: [
      { id: 'former', name: 'Ex Dirigente', status: 'Inativo', active: false, photo: './public/members/former.jpg' },
      { id: 'mutual', name: 'Mutuário', status: 'Mútua', active: true }
    ],
    accessRoles: [
      { id: 'old-role', name: 'Presidente', active: false },
      { id: 'mutual-role', name: 'Diretor', active: true }
    ],
    leadershipAssignments: [
      { id: 'a1', memberId: 'former', roleId: 'old-role', lionYear: '2025/2026', startsOn: '2025-07-01', endsOn: '2026-06-30', active: true },
      { id: 'a2', memberId: 'mutual', roleId: 'mutual-role', lionYear: '2025/2026', startsOn: '2025-07-01', endsOn: '2026-06-30', active: true }
    ]
  };
  const leaders = publicLeadersForYear(state, '2025/2026', new Date('2026-08-08T12:00:00'));
  assert.equal(leaders.length, 1);
  assert.equal(leaders[0].member.name, 'Ex Dirigente');
  assert.equal(leaders[0].role.name, 'Presidente');
});

test('área pública destaca o histórico dos Anos Leonísticos anteriores', async () => {
  const [leaders, css] = await Promise.all([
    source('assets/js/modules/leaders.js'),
    source('assets/css/pages/portal-experience.css')
  ]);
  assert.match(leaders, /Histórico dos Anos Leonísticos/);
  assert.match(leaders, /data-leaders-year/);
  assert.match(leaders, /historicalYears/);
  assert.match(css, /\.leaders-history-panel/);
  assert.match(css, /\.leaders-history-year\.is-selected/);
});

test('tela pública não exibe explicação técnica sobre o filtro mensal de aniversários', async () => {
  const birthdays = await source('assets/js/modules/birthdays.js');
  assert.doesNotMatch(birthdays, /Para visitantes, o Portal exibe somente os aniversariantes do mês atual/);
  assert.match(birthdays, /Aniversários de \$\{months\[visitorMonth\]\}/);
});
