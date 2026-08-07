import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(root, relativePath), 'utf8');

test('navegação lateral usa rótulo curto sem mudar a rota de aniversariantes', async () => {
  const html = await source('index.html');
  assert.match(html, /data-view="birthdays"[\s\S]*?<span class="nav-label">Aniversários<\/span>/);
});

test('agenda possui linguagem curta e seletor de modo nomeado', async () => {
  const agenda = await source('assets/js/modules/agenda.js');
  assert.match(agenda, /Toque em um resumo para filtrar\. Toque novamente para limpar\./);
  assert.match(agenda, /aria-label="Modo de visualização"/);
  assert.doesNotMatch(agenda, /Clique para filtrar\. Clique novamente no card selecionado/);
});

test('regras responsivas priorizam dashboard e controles da agenda', async () => {
  const css = await source('assets/css/components/modern-interface.css');
  assert.match(css, /Homologação visual e responsiva — etapa 7/);
  assert.match(css, /dashboard-kpis\.visitor-kpis\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\) !important\}/);
  assert.match(css, /dashboard-kpis\.visitor-kpis\{grid-template-columns:1fr !important\}/);
  assert.match(css, /agenda-view-switch\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css, /agenda-filters\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(css, /topbar-date\{display:none\}/);
});

test('auditoria visual cobre cinco telas em cinco resoluções', async () => {
  const audit = await source('tools/visual-audit.mjs');
  for (const viewport of ['mobile-360', 'mobile-390', 'tablet-768', 'notebook-1024', 'desktop-1366']) {
    assert.match(audit, new RegExp(`name: '${viewport}'`));
  }
  for (const view of ['dashboard', 'agenda', 'birthdays', 'notices', 'admin']) {
    assert.match(audit, new RegExp(`id: '${view}'`));
  }
  for (const guard of ['horizontalOverflow', 'contentOverflow', 'appointmentOverflow', 'topbarClipped', 'bottomNavTooNarrow', 'sidebarLabelsClipped', 'loading']) {
    assert.match(audit, new RegExp(guard));
  }
  assert.match(audit, /allowsHorizontalScroll/);
  assert.match(audit, /for \(const view of visualViews\)/);
});

test('documentação preserva a homologação visual e registra a estabilização final', async () => {
  const release = await source('RELEASE.md');
  const refactoring = await source('REFACTORING.md');
  const visual = await source('docs/visual-audit.md');
  const changelog = await source('CHANGELOG.md');
  assert.match(release, /Portal Lions v6\.36\.0/);
  assert.match(refactoring, /Etapa 8 — estabilização final/);
  assert.match(refactoring, /Etapas pendentes:\s*nenhuma/i);
  assert.match(changelog, /6\.35\.0 — Refatoração etapa 7/);
  assert.match(visual, /audit:visual:required/);
});
