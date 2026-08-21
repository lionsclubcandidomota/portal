import { escapeHtml, money, normalize } from '../../utils.js';
import { renderMembershipSection } from './memberships.js';
import { renderMutualSection } from './mutuals.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.7';

function analysisMetric(icon, label, value, note, tone = '') {
  return `<article class="treasury-analysis-metric ${tone}"><span aria-hidden="true">${uiIcon(icon)}</span><div><small>${escapeHtml(label)}</small><strong class="sensitive-money">${escapeHtml(value)}</strong><p>${escapeHtml(note)}</p></div></article>`;
}

function chartCard(treasury, {
  id,
  icon,
  title,
  subtitle,
  hostId,
  wrapClass = ''
}) {
  const collapsed = treasury.isChartCollapsed(id);
  const bodyId = `${hostId}Body`;
  return `<article class="card col-6 treasury-chart-card ${collapsed ? 'is-collapsed' : ''}" data-treasury-chart-card="${id}" aria-labelledby="${hostId}Title" aria-expanded="${String(!collapsed)}" tabindex="0">
    <div class="card-header treasury-chart-card-header" data-treasury-chart-toggle="${id}" role="button" aria-expanded="${String(!collapsed)}" aria-controls="${bodyId}" tabindex="-1">
      <div class="treasury-chart-heading"><span aria-hidden="true">${uiIcon(icon)}</span><div><h3 id="${hostId}Title">${escapeHtml(title)}</h3><div class="card-subtitle">${escapeHtml(subtitle)}</div></div></div>
      <span class="treasury-chart-toggle-hint" aria-hidden="true">${collapsed ? 'Clique para expandir' : 'Clique para recolher'}</span>
    </div>
    <div class="treasury-chart-body" id="${bodyId}" ${collapsed ? 'hidden' : ''}><div class="chart-wrap ${wrapClass}"><div id="${hostId}" class="native-chart-host"></div></div></div>
  </article>`;
}

function renderTreasuryHub(treasury, financePrivacy) {
  return `<section class="treasury-hub card">
    <div class="treasury-hub-heading">
      <div><span class="section-eyebrow">Tesouraria</span><h2>Visão financeira</h2><p>Saldos, cobranças e movimentações em um só lugar.</p></div>
      ${financePrivacy.buttonHtml()}
    </div>
    <div class="treasury-mobile-nav-intro" aria-hidden="true"><span>${uiIcon('list')}</span><div><strong>Escolha uma área</strong><small>Todas as opções estão disponíveis abaixo.</small></div></div>
    <div class="treasury-hub-grid is-simplified">
      <button type="button" class="treasury-hub-card is-primary ${treasury.section === 'movements' ? 'is-active' : ''}" data-treasury-section="movements" ${treasury.section === 'movements' ? 'aria-current="page"' : ''}>
        <span>${uiIcon('transfer')}</span><strong>Movimentações</strong><small>Entradas, saídas, transferências e valores programados</small>
      </button>
      <button type="button" class="treasury-hub-card ${treasury.section === 'overview' ? 'is-active' : ''}" data-treasury-section="overview" ${treasury.section === 'overview' ? 'aria-current="page"' : ''}>
        <span>${uiIcon('bank')}</span><strong>Contas</strong><small>Saldos atuais e previstos</small>
      </button>
      <button type="button" class="treasury-hub-card ${treasury.section === 'memberships' ? 'is-active' : ''}" data-treasury-section="memberships" ${treasury.section === 'memberships' ? 'aria-current="page"' : ''}>
        <span>${uiIcon('users')}</span><strong>Mensalidades</strong><small>Pagamentos e grupos familiares</small>
      </button>
      <button type="button" class="treasury-hub-card ${treasury.section === 'mutuals' ? 'is-active' : ''}" data-treasury-section="mutuals" ${treasury.section === 'mutuals' ? 'aria-current="page"' : ''}>
        <span>${uiIcon('heart')}</span><strong>Mútuas</strong><small>Cobranças por ocorrência</small>
      </button>
    </div>
  </section>`;
}

function renderPrimaryMovementAction(canWrite) {
  if (!canWrite) return '';
  return `<section class="treasury-primary-action card" data-treasury-panel="movements" aria-labelledby="newMovementTitle">
    <div class="treasury-primary-action-icon" aria-hidden="true">${uiIcon('plus')}</div>
    <div class="treasury-primary-action-copy">
      <span class="section-eyebrow">Novo registro</span>
      <h3 id="newMovementTitle">Adicionar movimentação</h3>
      <p>Registre entradas, saídas, valores programados ou movimente saldo entre contas internas.</p>
    </div>
    <div class="treasury-primary-action-buttons" aria-label="Escolha o tipo de movimentação">
      <button class="btn treasury-primary-action-button is-entry" type="button" data-new-treasury-kind="entry">${uiIcon('download')} Entrada</button>
      <button class="btn treasury-primary-action-button is-exit" type="button" data-new-treasury-kind="exit">${uiIcon('upload')} Saída</button>
      <button class="btn treasury-primary-action-button is-transfer" type="button" data-new-treasury-kind="transfer">${uiIcon('transfer')} Transferência</button>
    </div>
  </section>`;
}

export function renderTreasuryShell({
  treasury,
  helpers,
  totals,
  accountSummaries,
  membershipModel,
  mutualModel
}) {
  const {
    adminUnlocked,
    financePrivacy,
    kpi,
    avatar,
    empty
  } = helpers;

  const realizedVolume = Number(totals.entries || 0) + Number(totals.exits || 0);
  const financialResult = Number(totals.entries || 0) - Number(totals.exits || 0);
  const averageTicket = totals.realizedCount ? realizedVolume / totals.realizedCount : 0;
  const resultRate = Number(totals.entries || 0)
    ? financialResult / Number(totals.entries || 0) * 100
    : null;
  const programmedCommitment = Number(totals.balance || 0) > 0
    ? Number(totals.programmedExits || 0) / Number(totals.balance || 0) * 100
    : null;
  const chartIds = ['finance', 'cash-flow', 'category', 'account'];

  return `<div class="treasury-experience">${renderTreasuryHub(treasury, financePrivacy)}${renderPrimaryMovementAction(adminUnlocked)}<section class="treasury-period-card card"><div class="treasury-period-copy"><span class="treasury-period-icon">${uiIcon('calendar')}</span><div><strong>Período</strong><small>Escolha as datas que deseja consultar.</small></div></div><div class="treasury-period-controls"><select id="treasuryPeriod" aria-label="Período da tesouraria"><option value="all" ${treasury.period === 'all' ? 'selected' : ''}>Todo o período</option><option value="month" ${treasury.period === 'month' ? 'selected' : ''}>Mês atual</option><option value="30days" ${treasury.period === '30days' ? 'selected' : ''}>Últimos 30 dias</option><option value="year" ${treasury.period === 'year' ? 'selected' : ''}>Ano atual</option><option value="custom" ${treasury.period === 'custom' ? 'selected' : ''}>Personalizado</option></select><div class="treasury-custom-period ${treasury.period === 'custom' ? 'is-visible' : ''}"><label><span>De</span><input id="treasuryStart" type="date" value="${treasury.customStart}" aria-label="Data inicial"></label><span class="treasury-date-separator">até</span><label><span>Até</span><input id="treasuryEnd" type="date" value="${treasury.customEnd}" aria-label="Data final"></label><button class="btn btn-primary btn-sm treasury-apply-period" id="treasuryApplyPeriod" type="button">Aplicar</button></div></div></section>
  <div class="treasury-period-summary">Exibindo: <strong>${treasury.periodLabel()}</strong></div>
  <section class="grid grid-kpis treasury-realized-kpis">
    ${kpi(uiIcon('wallet'), 'Saldo atual', money.format(totals.balance))}
    ${kpi(uiIcon('download'), 'Entradas realizadas', money.format(totals.entries))}
    ${kpi(uiIcon('upload'), 'Saídas realizadas', money.format(totals.exits))}
    ${kpi(uiIcon('check'), 'Movimentações realizadas', totals.realizedCount)}
  </section>
  <section class="card treasury-projection-card">
    <div class="card-header"><div><h3>${uiIcon('calendar', 'dashboard-title-icon')}<span>Valores programados</span></h3><div class="card-subtitle">Previsões que ainda não alteram o saldo.</div></div></div>
    <div class="treasury-projection-grid">
      <div class="projection-metric is-income"><small>Entradas previstas</small><strong>${money.format(totals.programmedEntries)}</strong></div>
      <div class="projection-metric is-expense"><small>Saídas previstas</small><strong>${money.format(totals.programmedExits)}</strong></div>
      <div class="projection-metric is-future"><small>Saldo previsto</small><strong>${money.format(totals.projectedBalance)}</strong><span>Saldo atual com os valores programados</span></div>
    </div>
  </section>
  <section class="card treasury-accounts-card">
    <div class="card-header"><div><h3>${uiIcon('bank', 'dashboard-title-icon')}<span>Contas</span></h3><div class="card-subtitle">Saldo atual e previsto.</div></div>${adminUnlocked ? '<div class="card-header-actions"><button class="btn btn-ghost btn-sm" id="manageTreasuryAccounts" type="button">Editar contas</button></div>' : ''}</div>
    <div class="treasury-account-grid">${accountSummaries.map(account => {
      const showType = normalize(account.name) !== normalize(account.type || '');
      const negativeBalance = Number(account.balance || 0) < 0;
      const negativeProjection = Number(account.projectedBalance || 0) < 0;
      return `<article class="treasury-account-card ${account.active === false ? 'is-inactive' : ''} ${negativeBalance ? 'is-negative-balance' : ''} ${negativeProjection ? 'has-negative-projection' : ''}" ${account.active === false ? 'aria-label="Conta inativa"' : negativeBalance ? 'aria-label="Conta com saldo negativo"' : ''}><span class="treasury-account-icon">${treasury.accountTypeIcon(account.type)}</span><div class="treasury-account-copy">${showType ? `<small>${escapeHtml(account.type || 'Conta')}</small>` : ''}<strong>${escapeHtml(account.name)}</strong>${account.active === false ? '<span class="treasury-account-status">Conta inativa</span>' : ''}${negativeBalance ? '<span class="treasury-account-status is-negative">Saldo negativo</span>' : ''}</div><div class="treasury-account-balance"><small>Saldo atual</small><strong class="${negativeBalance ? 'is-negative' : ''}">${money.format(account.balance)}</strong><span class="${negativeProjection ? 'is-negative' : ''}">Projetado: ${money.format(account.projectedBalance)}</span></div></article>`;
    }).join('')}</div>
  </section>
  ${renderMembershipSection({
    model: membershipModel,
    treasury,
    adminUnlocked,
    avatar,
    empty
  })}
  ${renderMutualSection({
    model: mutualModel,
    adminUnlocked,
    avatar,
    empty
  })}
  <section class="grid grid-main treasury-chart-grid">
    <div class="treasury-chart-section-heading col-12">
      <div><span class="section-eyebrow">Análises</span><h3>Resumo visual</h3><p>Abra somente os gráficos que deseja consultar.</p></div>
      <div class="treasury-chart-heading-actions"><div class="treasury-chart-period-badge"><span>Período analisado</span><strong>${treasury.periodLabel()}</strong></div><div class="treasury-chart-bulk-actions" aria-label="Controles dos gráficos"><button class="btn btn-ghost btn-sm" id="treasuryExpandCharts" type="button" ${treasury.collapsedChartCount ? '' : 'hidden'}>Expandir todos</button><button class="btn btn-ghost btn-sm" id="treasuryCollapseCharts" type="button" ${treasury.collapsedChartCount < chartIds.length ? '' : 'hidden'}>Recolher todos</button></div></div>
    </div>
    <div class="treasury-analysis-kpis col-12" aria-label="Indicadores de análise financeira">
      ${analysisMetric(financialResult >= 0 ? 'trend-up' : 'trend-down', 'Resultado do período', money.format(financialResult), financialResult >= 0 ? 'Entradas superaram as saídas.' : 'Saídas superaram as entradas.', financialResult >= 0 ? 'is-positive' : 'is-negative')}
      ${analysisMetric('percent', 'Margem financeira', resultRate === null ? 'Sem receita' : `${resultRate.toFixed(1).replace('.', ',')}%`, resultRate === null ? 'Registre entradas para calcular.' : 'Resultado em relação às entradas realizadas.', resultRate !== null && resultRate >= 0 ? 'is-positive' : 'is-negative')}
      ${analysisMetric('calculator', 'Ticket médio', money.format(averageTicket), `${totals.realizedCount || 0} movimentação(ões) realizada(s).`, 'is-neutral')}
      ${analysisMetric('clock', 'Compromissos programados', programmedCommitment === null ? money.format(totals.programmedExits || 0) : `${programmedCommitment.toFixed(1).replace('.', ',')}% do saldo`, programmedCommitment === null ? 'Sem saldo positivo para calcular cobertura.' : money.format(totals.programmedExits || 0), programmedCommitment !== null && programmedCommitment > 100 ? 'is-negative' : 'is-warning')}
    </div>
    ${chartCard(treasury, { id: chartIds[0], icon: 'chart-pie', title: 'Visão financeira realizada', subtitle: 'Entradas recebidas e despesas pagas no período.', hostId: 'financeChart' })}
    ${chartCard(treasury, { id: chartIds[1], icon: 'trend-up', title: 'Evolução do fluxo de caixa', subtitle: 'Entradas, saídas e resultado acumulado ao longo do período.', hostId: 'cashFlowChart', wrapClass: 'cash-flow-chart-wrap' })}
    ${chartCard(treasury, { id: chartIds[2], icon: 'chart-bar', title: 'Movimentação por categoria', subtitle: 'Categorias com maior impacto financeiro no período.', hostId: 'categoryChart', wrapClass: 'category-chart-wrap' })}
    ${chartCard(treasury, { id: chartIds[3], icon: 'bank', title: 'Saldo por conta', subtitle: 'Posição atual de cada conta, incluindo saldos negativos e independente do filtro de período.', hostId: 'accountChart' })}
    <article class="col-12 treasury-movements-area"><section class="treasury-search-panel" aria-labelledby="treasurySearchTitle"><div class="treasury-search-heading"><span aria-hidden="true">${uiIcon('search')}</span><div><strong id="treasurySearchTitle">Buscar movimentações</strong><small>Pesquise por nome, categoria, conta ou associado.</small></div></div><div class="search treasury-search-control"><input id="searchInput" type="search" placeholder="Buscar no histórico..." aria-label="Pesquisar movimentações" autocomplete="off"></div></section><div id="treasuryLists"></div></article>
  </section></div>`;
}

