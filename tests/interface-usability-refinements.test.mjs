import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

test('dashboard principal não expõe número do associado nos próximos aniversariantes', async () => {
  const dashboard = await source('assets/js/modules/dashboard.js');
  const itemStart = dashboard.indexOf('dashboard-birthday-item');
  const itemEnd = dashboard.indexOf('birthday-status', itemStart);
  const birthdayItem = dashboard.slice(itemStart, itemEnd);

  assert.ok(itemStart >= 0 && itemEnd > itemStart);
  assert.doesNotMatch(birthdayItem, /memberNumber|Nº\s/);
  assert.match(birthdayItem, /member\.name/);
});

test('gráficos possuem ações coletivas para expandir e recolher', async () => {
  const [shell, charts] = await Promise.all([
    source('assets/js/modules/treasury/view-shell.js'),
    source('assets/js/modules/treasury/view-charts.js')
  ]);

  assert.match(shell, /id="treasuryExpandCharts"/);
  assert.match(shell, /id="treasuryCollapseCharts"/);
  assert.match(shell, /Recolher todos/);
  assert.match(charts, /treasury\.collapseAllCharts\(chartIds\)/);
});

test('pesquisa financeira recebe componente de destaque próprio', async () => {
  const [view, css] = await Promise.all([
    source('assets/js/modules/treasury/view-shell.js'),
    source('assets/css/components/native-charts.css')
  ]);

  assert.match(view, /class="treasury-search-panel"/);
  assert.match(view, /type="search"/);
  assert.match(view, /Buscar no histórico/);
  assert.match(css, /\.treasury-search-panel\s*\{/);
  assert.match(css, /\.treasury-search-control input\s*\{/);
});

test('contas inativas permanecem visíveis com aparência desabilitada', async () => {
  const [view, css] = await Promise.all([
    source('assets/js/modules/treasury/view-shell.js'),
    source('assets/css/components/native-charts.css')
  ]);

  assert.match(view, /treasury-account-card \$\{account\.active === false \? 'is-inactive'/);
  assert.match(view, /treasury-account-status/);
  assert.match(view, /Conta inativa/);
  assert.match(css, /\.treasury-account-card\.is-inactive\s*\{/);
  assert.match(css, /filter:\s*grayscale\(1\)/);
});


test('topo administrativo oferece atualização global sem recarregar a página', async () => {
  const [html, app, refreshController] = await Promise.all([
    source('index.html'),
    source('assets/js/modules/portal-app.js'),
    source('assets/js/modules/portal-refresh.js')
  ]);

  assert.match(html, /id="portalRefreshButton"/);
  assert.match(html, /Atualizar todo o painel sem encerrar a sessão/);
  assert.match(app, /refreshPortal:\s*runtime\.refreshPortalInterface/);
  assert.match(app, /resetInterfaceState/);
  assert.doesNotMatch(refreshController, /location\.reload/);
});

test('atualização pendente oferece publicar, descartar ou cancelar antes de continuar', async () => {
  const [html, app, controller, publishCenter] = await Promise.all([
    source('index.html'),
    source('assets/js/modules/portal-app.js'),
    source('assets/js/modules/portal-refresh.js'),
    source('assets/js/modules/publish-center.js')
  ]);

  assert.match(html, /id="confirmSecondary"/);
  assert.match(app, /primaryText:\s*'Publicar alterações'/);
  assert.match(app, /secondaryText:\s*'Descartar alterações'/);
  assert.match(app, /cancelText:\s*'Cancelar atualização'/);
  assert.match(controller, /requestPendingDecision/);
  assert.match(controller, /publishPendingChanges/);
  assert.match(controller, /discardPendingChanges\(\{ skipConfirmation: true \}\)/);
  assert.doesNotMatch(html, /publishCenterReload/);
  assert.doesNotMatch(publishCenter, /onReload|reloadButton/);
});

test('seção ativa da Tesouraria possui estado visual e semântico evidente', async () => {
  const [shell, overview, css] = await Promise.all([
    source('assets/js/modules/treasury/view-shell.js'),
    source('assets/js/modules/treasury/view-overview.js'),
    source('assets/css/pages/treasury-navigation.css')
  ]);

  assert.match(shell, /aria-current="page"/);
  assert.match(overview, /button\.classList\.toggle\('is-active', active\)/);
  assert.match(css, /\.treasury-hub-card\.is-active\s*\{/);
  assert.match(css, /content:"ATUAL"/);
  assert.match(css, /border:2px solid var\(--primary\)/);
});

test('controladores das páginas expõem restauração do estado inicial', async () => {
  const [treasury, birthdays, agenda] = await Promise.all([
    source('assets/js/modules/treasury/controller.js'),
    source('assets/js/modules/birthdays.js'),
    source('assets/js/modules/agenda.js')
  ]);

  assert.match(treasury, /const reset = \(\) =>/);
  assert.match(treasury, /section = 'movements'/);
  assert.match(treasury, /period = 'all'/);
  assert.match(birthdays, /monthFilter = 'all'/);
  assert.match(agenda, /mode = 'list'/);
});


test('Dashboard administrativo resume Mútuas em cards compactos e responsivos', async () => {
  const [dashboard, css] = await Promise.all([
    source('assets/js/modules/dashboard.js'),
    source('assets/css/components/core.css')
  ]);

  assert.match(dashboard, /dashboard-main-grid/);
  assert.match(dashboard, /is-admin-compact/);
  assert.match(dashboard, /dashboard-mutual-card/);
  assert.match(dashboard, /mutualPaidCharges/);
  assert.match(dashboard, /data-open-mutuals/);
  assert.match(css, /\.dashboard-main-grid\.is-admin-compact/);
  assert.match(css, /\.dashboard-mutual-progress>span/);
  assert.match(css, /@media\(max-width:900px\)/);
});

test('relatórios administrativos oferecem Mútuas para visualização e exportação', async () => {
  const [view, domain] = await Promise.all([
    source('assets/js/modules/admin-dashboard/view.js'),
    source('assets/js/modules/reports/domain.js')
  ]);

  assert.match(view, /<option value="mutuals">Mútuas<\/option>/);
  assert.match(domain, /mutuals:\s*Object\.freeze/);
  assert.match(domain, /buildMutualReport/);
  assert.match(domain, /mutuals:\s*\(\) => buildMutualReport/);
});

test('formulário de baixa de Mútuas padroniza campos de data e seleção', async () => {
  const [payment, css] = await Promise.all([
    source('assets/js/modules/treasury-admin/mutual-payments.js'),
    source('assets/css/pages/memberships.css')
  ]);

  assert.match(payment, /mutual-payment-form/);
  assert.match(css, /\.mutual-payment-form \.form-field>input,\.mutual-payment-form \.form-field>select/);
  assert.match(css, /height:46px;min-height:46px/);
  assert.match(css, /border-radius:13px/);
});

test('baixa de Mútuas exibe somente um controle visual de seleção por associado', async () => {
  const [payment, css] = await Promise.all([
    source('assets/js/modules/treasury-admin/mutual-payments.js'),
    source('assets/css/pages/memberships.css')
  ]);

  assert.match(payment, /<input type="checkbox" name="chargeKeys"/);
  assert.doesNotMatch(payment, /mutual-payment-charge-check/);
  assert.match(css, /\.mutual-payment-charge>input\{width:22px;height:22px/);
  assert.match(css, /\.mutual-payment-charge>input:focus-visible\{/);
  assert.match(css, /grid-template-columns:22px 40px minmax\(0,1fr\) auto/);
  assert.doesNotMatch(css, /grid-template-columns:20px 24px 40px minmax\(0,1fr\) auto/);
});

test('menu Configurações e sua rota ficam exclusivos do perfil Administrador', async () => {
  const [html, navigation, authorization, baseCss] = await Promise.all([
    source('index.html'),
    source('assets/js/modules/navigation.js'),
    source('assets/js/modules/portal-runtime/authorization.js'),
    source('assets/css/base.css')
  ]);

  assert.match(html, /id="settingsNav" hidden aria-hidden="true" style="display:none"/);
  assert.match(html, /class="nav-item admin-only administrator-only"/);
  assert.match(navigation, /settingsNav\.hidden = !access\.canViewSettings/);
  assert.match(navigation, /settingsNav\.style\.display = access\.canViewSettings \? '' : 'none'/);
  assert.match(navigation, /settingsNav\.setAttribute\('aria-hidden', String\(!access\.canViewSettings\)\)/);
  assert.match(navigation, /settingsNav\.tabIndex = access\.canViewSettings \? 0 : -1/);
  assert.match(navigation, /if \(!canAccessView\(access\.role, view\)\) view = 'admin'/);
  assert.match(authorization, /settings:\s*ACCESS_CAPABILITIES\.VIEW_SETTINGS/);
  assert.match(baseCss, /body:not\(\.admin-mode\) #settingsNav/);
});


test('acesso da Diretoria inicia vazio e o menu usa Área administrativa', async () => {
  const [html, view, controller, loginState, navigation, css] = await Promise.all([
    source('index.html'),
    source('assets/js/modules/admin-dashboard/view.js'),
    source('assets/js/modules/admin-dashboard/login-controller.js'),
    source('assets/js/modules/admin-dashboard/login-form-state.js'),
    source('assets/js/modules/navigation.js'),
    source('assets/css/pages/admin-dashboard.css')
  ]);

  assert.match(html, /<span class="nav-label">Área administrativa<\/span>/);
  assert.match(navigation, /: 'Área administrativa';/);
  assert.match(view, /placeholder="Informe a senha da Diretoria"/);
  assert.match(view, /name="directorAccessPassword"/);
  assert.match(view, /autocomplete="new-password"/);
  assert.match(view, /id="directorPassword"[^>]*disabled/);
  assert.match(loginState, /resetSecretField\(directorInput, directorToggle, 'senha'\)/);
  assert.match(loginState, /directorInput\.disabled = !directorMode/);
  assert.match(controller, /get\('directorAccessPassword'\)/);
  assert.match(css, /\.admin-login-form\[hidden\]\{display:none!important\}/);
});
