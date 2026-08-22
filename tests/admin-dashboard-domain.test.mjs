import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAdminDashboardModel,
  dateFromInput,
  groupStatuses,
  inputDate,
  isInsidePeriod,
  periodBounds,
  resolveEventStatus,
  resolveMeetingStatus,
  summarizeBirthdayPeople,
  summarizeTreasury
} from '../assets/js/modules/admin-dashboard/domain.js';
import { adminDashboardHtml } from '../assets/js/modules/admin-dashboard/view.js';

test('datas do dashboard são validadas e formatadas sem aceitar dias inexistentes', () => {
  assert.equal(inputDate(new Date(2026, 6, 30)), '2026-07-30');
  assert.equal(dateFromInput('2026-02-29'), null);
  assert.equal(inputDate(dateFromInput('2024-02-29')), '2024-02-29');
});

test('períodos prontos usam limites corretos e inclusivos', () => {
  const now = new Date(2026, 6, 30);
  assert.deepEqual(periodBounds('current-month', '', '', now), {
    start: '2026-07-01',
    end: '2026-07-31'
  });
  assert.deepEqual(periodBounds('current-quarter', '', '', now), {
    start: '2026-07-01',
    end: '2026-09-30'
  });
  assert.equal(isInsidePeriod({ date: '2026-07-01' }, { start: '2026-07-01', end: '2026-07-31' }), true);
  assert.equal(isInsidePeriod({ date: '2026-08-01' }, { start: '2026-07-01', end: '2026-07-31' }), false);
});

test('status da agenda e dos compromissos respeitam cancelamento e execução', () => {
  const today = '2026-07-30';
  assert.deepEqual(resolveEventStatus({ status: 'Confirmado', date: '2026-08-02' }, today), {
    key: 'confirmed',
    label: 'Confirmados'
  });
  assert.deepEqual(resolveEventStatus({ status: 'Confirmado', date: '2026-07-20' }, today), {
    key: 'completed',
    label: 'Realizados'
  });
  assert.deepEqual(resolveMeetingStatus({ status: 'Em andamento', date: today }, today), {
    key: 'progress',
    label: 'Em andamento'
  });
  assert.deepEqual(resolveMeetingStatus({ status: 'Cancelado', date: '2026-08-03' }, today), {
    key: 'cancelled',
    label: 'Cancelados'
  });
});

test('agrupamento preserva a ordem gerencial preferida', () => {
  const groups = groupStatuses(
    [
      { status: 'Cancelado', date: '2026-08-03' },
      { status: 'Confirmado', date: '2026-08-02' },
      { status: 'Pendente', date: '2026-08-01' }
    ],
    resolveEventStatus,
    ['completed', 'confirmed', 'pending', 'cancelled', 'other'],
    '2026-07-30'
  );
  assert.deepEqual(groups.map(group => group.key), ['confirmed', 'pending', 'cancelled']);
});


test('resumo de aniversariantes diferencia associados de mutuários', () => {
  const summary = summarizeBirthdayPeople([
    { id: 'a1', status: 'Ativo' },
    { id: 'a2', status: 'Inativo', active: false },
    { id: 'm1', status: 'Mútua' }
  ]);

  assert.deepEqual(summary, {
    total: 3,
    associateCount: 2,
    mutualCount: 1
  });
});

test('resumo financeiro separa entradas, saídas e saldo', () => {
  const summary = summarizeTreasury([
    { entry: 150, exit: 0 },
    { entry: 50, exit: 0 },
    { entry: 0, exit: 80 }
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.entries.length, 2);
  assert.equal(summary.exits.length, 1);
  assert.equal(summary.entriesValue, 200);
  assert.equal(summary.exitsValue, 80);
  assert.equal(summary.balance, 120);
  assert.equal(summary.maxValue, 200);
});

test('modelo administrativo aplica um único período a todos os módulos', () => {
  const model = createAdminDashboardModel({
    treasury: [
      { date: '2026-07-10', entry: 100 },
      { date: '2026-06-10', exit: 40 }
    ],
    events: [
      { date: '2026-07-20', status: 'Realizado' },
      { date: '2026-08-01', status: 'Pendente' }
    ],
    meetings: [{ date: '2026-07-30', status: 'Em andamento' }],
    birthdays: [{ id: '1', status: 'Ativo' }, { id: '2', status: 'Mútua' }],
    notices: [{ id: 'n1' }]
  }, {
    periodPreset: 'current-month',
    now: new Date(2026, 6, 30)
  });

  assert.equal(model.treasury.total, 1);
  assert.equal(model.events.items.length, 1);
  assert.equal(model.meetings.items.length, 1);
  assert.equal(model.birthdayCount, 2);
  assert.equal(model.birthdayAssociateCount, 1);
  assert.equal(model.birthdayMutualCount, 1);
  assert.equal(model.noticeCount, 1);
});

test('período personalizado possui aplicação explícita sem recriar os campos durante a digitação', async () => {
  const model = createAdminDashboardModel({
    treasury: [],
    events: [],
    meetings: [],
    birthdays: [],
    notices: []
  }, {
    periodPreset: 'custom',
    customStart: '2026-07-01',
    customEnd: '2026-07-31',
    now: new Date(2026, 6, 31)
  });
  const html = adminDashboardHtml(model);
  const controllerSource = await import('node:fs/promises')
    .then(({ readFile }) => readFile(new URL('../assets/js/modules/admin-panel.js', import.meta.url), 'utf8'));

  assert.match(html, /id="adminPeriodApply"/);
  assert.match(html, />Aplicar<\/button>/);
  assert.match(controllerSource, /addEventListener\('input', clearCustomPeriodValidity\)/);
  assert.match(controllerSource, /periodApplyButton\?\.addEventListener\('click', applyCustomPeriod\)/);
  assert.doesNotMatch(controllerSource, /adminPeriodStart'\)\?\.addEventListener\('change'[\s\S]{0,220}renderPanel\(\)/);
});

test('view do dashboard não duplica opções e tipa todos os botões', () => {
  const model = createAdminDashboardModel({
    treasury: [],
    events: [],
    meetings: [],
    birthdays: [],
    notices: []
  }, {
    periodPreset: 'current-year',
    now: new Date(2026, 6, 30)
  });
  const html = adminDashboardHtml(model);

  assert.equal((html.match(/value="current-year"/g) || []).length, 1);
  assert.match(html, /admin-people-counts/);
  assert.match(html, /Associado\(s\)/);
  assert.match(html, /Mutuário\(s\)/);
  for (const match of html.matchAll(/<button\b[^>]*>/g)) {
    assert.match(match[0], /\btype=/);
  }
});

test('área administrativa possui hierarquia visual por seções e grade responsiva', async () => {
  const model = createAdminDashboardModel({ treasury: [], events: [], meetings: [], birthdays: [], notices: [] }, {
    periodPreset: 'current-month',
    now: new Date(2026, 7, 22)
  });
  const html = adminDashboardHtml(model, { auditSummary: {}, recoverySummary: {}, accessRole: 'admin' });
  const css = await import('node:fs/promises')
    .then(({ readFile }) => readFile(new URL('../assets/css/pages/admin-dashboard.css', import.meta.url), 'utf8'));

  assert.match(html, /id="adminOverviewTitle">Resumo do período/);
  assert.match(html, /id="adminQuickTitle">Pessoas e comunicação/);
  assert.match(html, /id="adminOperationsTitle">Segurança, histórico e acessos/);
  assert.match(css, /\.admin-dashboard-section\{margin-bottom:18px\}/);
  assert.match(css, /\.admin-operation-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:820px\).*\.admin-insight-grid,.admin-support-grid,.admin-operation-grid\{grid-template-columns:1fr\}/s);
});
