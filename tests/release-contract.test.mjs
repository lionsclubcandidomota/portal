import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminDashboardHtml } from '../assets/js/modules/admin-dashboard/view.js';
import { createAdminDashboardModel } from '../assets/js/modules/admin-dashboard/domain.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));

function allButtonsHaveType(html) {
  return [...html.matchAll(/<button\b[^>]*>/gi)]
    .every(match => /\btype=["'][^"']+["']/i.test(match[0]));
}

test('versão estável usa o mesmo identificador no pacote e no cache do HTML', async () => {
  const html = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
  const versions = [...html.matchAll(/\?v=(\d+\.\d+\.\d+(?:\.\d+)*)/g)].map(match => match[1]);
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.ok(versions.length > 0);
  assert.deepEqual([...new Set(versions)], [packageJson.version]);
  assert.doesNotMatch(html, /upgrade-insecure-requests/, 'a CSP não deve forçar HTTPS no servidor local de homologação');
  assert.match(html, /script-src 'self';/, 'a CSP deve aceitar somente scripts externos da própria origem');
  assert.doesNotMatch(html, /script-src[^;"]*sha256-/, 'a CSP não deve depender do código injetado por uma extensão');
  assert.doesNotMatch(html, /connect-src[^"]*wss?:\/\/(?:127\.0\.0\.1|localhost)/, 'a CSP não deve depender do WebSocket do Live Server');
  assert.doesNotMatch(html, /script-src[^;"]*'unsafe-inline'/, 'scripts inline genéricos devem continuar bloqueados');
});


test('homologação usa servidor próprio sem injeção de script', async () => {
  const html = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
  const batch = await readFile(path.join(projectRoot, 'INICIAR-HOMOLOGACAO.bat'), 'utf8');
  assert.equal(packageJson.scripts.homologacao, 'node tools/homologation-server.mjs --open');
  assert.equal(packageJson.scripts['homologacao:server'], 'node tools/homologation-server.mjs');
  assert.match(batch, /homologation-server\.mjs --open/);
  assert.doesNotMatch(html, /live-server|sha256-vvt4KWuw|ws:\/\/127\.0\.0\.1/i);
});

test('execução do portal não depende de CDN para os gráficos', async () => {
  const charts = await readFile(path.join(projectRoot, 'assets/js/modules/treasury/charts.js'), 'utf8');
  const view = await readFile(path.join(projectRoot, 'assets/js/modules/treasury/view-shell.js'), 'utf8');
  assert.doesNotMatch(charts, /cdn\.jsdelivr|unpkg|cdnjs/);
  assert.doesNotMatch(view, /<canvas\b/i);
  assert.match(view, /native-chart-host/);
});

test('acesso administrativo controla o foco sem atributo autofocus', async () => {
  const viewSource = await readFile(path.join(projectRoot, 'assets/js/modules/admin-dashboard/view.js'), 'utf8');
  const controllerSource = await readFile(path.join(projectRoot, 'assets/js/modules/admin-dashboard/login-form-state.js'), 'utf8');
  assert.doesNotMatch(viewSource, /\bautofocus\b/i);
  assert.match(controllerSource, /input\?\.isConnected/);
  assert.match(controllerSource, /input\.focus\(\{ preventScroll: true \}\)/);
});

test('dashboard administrativo mantém todos os módulos gerenciais e botões tipados', () => {
  const model = createAdminDashboardModel({
    birthdays: [],
    treasury: [{ date: '2026-07-01', entry: 100 }],
    events: [{ date: '2026-07-10', status: 'Confirmado' }],
    meetings: [{ date: '2026-07-12', status: 'Pendente' }],
    notices: []
  }, {
    periodPreset: 'current-month',
    now: new Date(2026, 6, 30)
  });
  const html = adminDashboardHtml(model);

  for (const label of ['Tesouraria', 'Agenda', 'Compromissos', 'Aniversariantes', 'Avisos', 'Histórico de alterações', 'Recuperação e continuidade', 'Central de relatórios']) {
    assert.match(html, new RegExp(label));
  }
  assert.equal(allButtonsHaveType(html), true);
});

test('documentos finais e manifesto fazem parte do pacote', async () => {
  for (const relativePath of ['CHANGELOG.md', 'RELEASE.md', 'docs/homologation.md', 'release-manifest.json', 'tools/release-build.mjs', 'tools/release-dist-verify.mjs']) {
    const source = await readFile(path.join(projectRoot, relativePath), 'utf8');
    assert.ok(source.length > 20, `${relativePath} deve possuir conteúdo`);
  }
});
