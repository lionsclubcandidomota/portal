import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  availablePublicLionYears,
  publicLeadersForYear,
  publicLeadershipSummary
} from '../assets/js/core/public-leadership.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8');

function leadershipState() {
  return {
    birthdays: [
      { id: 'm1', name: 'Ana Lions', birthDate: '1980-08-10', active: true, status: 'Ativo' },
      { id: 'm2', name: 'Bruno Lions', birthDate: '1982-08-20', active: true, status: 'Ativo' }
    ],
    accessRoles: [
      { id: 'president', name: 'Presidente', active: true, permissions: [] },
      { id: 'treasurer', name: 'Tesoureiro', active: true, permissions: [] }
    ],
    leadershipAssignments: [
      { id: 'a1', memberId: 'm1', roleId: 'president', lionYear: '2025/2026', startsOn: '2025-07-01', endsOn: '2026-06-30', active: true },
      { id: 'a2', memberId: 'm2', roleId: 'treasurer', lionYear: '2026/2027', startsOn: '2026-07-01', endsOn: '2027-06-30', active: true }
    ]
  };
}

test('botão de atualização fica no rodapé do menu lateral e preserva a tela', async () => {
  const [html, css, controller] = await Promise.all([
    source('index.html'),
    source('assets/css/pages/portal-experience.css'),
    source('assets/js/modules/portal-refresh.js')
  ]);
  assert.match(html, /<div class="sidebar-footer">[\s\S]*id="portalRefreshButton"/);
  assert.match(html, /Manter tela e posição/);
  assert.doesNotMatch(html, /topbar-session[\s\S]{0,500}id="portalRefreshButton"/);
  assert.match(css, /\.sidebar-refresh-button\s*\{/);
  assert.match(css, /grid-template-columns:38px 1fr 38px/);
  assert.match(css, /\.sidebar-refresh-button\.is-loading \.sidebar-refresh-icon \.ui-icon\{animation:portalRefreshSpin/);
  assert.doesNotMatch(css, /\.sidebar-refresh-button\.is-loading \.sidebar-refresh-icon\{animation:portalRefreshSpin/);
  assert.doesNotMatch(controller, /location\.reload/);
});

test('dashboard e Dirigentes compartilham banner institucional com marca d’água', async () => {
  const [dashboard, leaders, css] = await Promise.all([
    source('assets/js/modules/dashboard.js'),
    source('assets/js/modules/leaders.js'),
    source('assets/css/pages/portal-experience.css')
  ]);
  assert.match(dashboard, /institutional-banner/);
  assert.match(dashboard, /dashboard-hero-watermark/);
  assert.match(dashboard, /width="190" height="190"/);
  assert.match(leaders, /institutional-banner-watermark/);
  assert.match(css, /\.institutional-banner\s*\{/);
  assert.match(css, /\.dashboard-hero-logo-wrap\s*\{/);
});

test('histórico público de dirigentes lista anos anteriores sem expor acessos', () => {
  const state = leadershipState();
  const now = new Date(2026, 7, 8, 12);
  assert.deepEqual(availablePublicLionYears(state, now), ['2026/2027', '2025/2026']);
  const historical = publicLeadersForYear(state, '2025/2026', now);
  assert.equal(historical.length, 1);
  assert.equal(historical[0].member.name, 'Ana Lions');
  assert.equal(historical[0].role.name, 'Presidente');
  const summary = publicLeadershipSummary(state, now, '2025/2026');
  assert.equal(summary.historical, true);
  assert.equal(summary.lionYear, '2025/2026');
  assert.equal('username' in historical[0], false);
});

test('tela pública de Dirigentes oferece seleção de Ano Leonístico', async () => {
  const leaders = await source('assets/js/modules/leaders.js');
  assert.match(leaders, /id="leadersYearSelect"/);
  assert.match(leaders, /availableYears\.map/);
  assert.match(leaders, /renderLeaders\(state, \{ root, empty, at, lionYear: year \}\)/);
});

test('visitantes veem apenas aniversariantes do mês atual', async () => {
  const [birthdays, dashboard] = await Promise.all([
    source('assets/js/modules/birthdays.js'),
    source('assets/js/modules/dashboard.js')
  ]);
  assert.match(birthdays, /birthdays\.monthFilter = String\(visitorMonth\)/);
  assert.doesNotMatch(birthdays, /Para visitantes, o Portal exibe somente os aniversariantes do mês atual/);
  assert.match(birthdays, /parseLocalDate\(member\.birthDate\)\.getMonth\(\) === visitorMonth/);
  assert.match(dashboard, /adminUnlocked \|\| parseLocalDate\(member\.birthDate\)\.getMonth\(\) === currentMonth/);
});

test('interface pública usa ícones SVG locais no lugar dos emojis de estado', async () => {
  const [birthdays, dashboard, icons] = await Promise.all([
    source('assets/js/modules/birthdays.js'),
    source('assets/js/modules/dashboard.js'),
    source('assets/icons/ui-icons.svg')
  ]);
  assert.match(birthdays, /uiIcon\('cake'\)/);
  assert.doesNotMatch(birthdays, /🎉|🎂|📅/u);
  assert.doesNotMatch(dashboard, /🎂|🗓️|📢/u);
  for (const icon of ['chevron-right', 'history', 'star', 'filter']) {
    assert.match(icons, new RegExp(`id="${icon}"`));
  }
});
