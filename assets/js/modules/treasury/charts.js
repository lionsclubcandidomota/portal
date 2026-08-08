import { escapeHtml, money, parseLocalDate } from '../../utils.js';
import { renderHtmlIfChanged } from '../visual-helpers.js?v=6.46.4';

const CHART_COLORS = Object.freeze({
  entry: '#0f766e',
  exit: '#c2410c',
  neutral: '#64748b'
});

const ACCOUNT_PALETTE = Object.freeze([
  '#2563eb',
  '#7c3aed',
  '#0f766e',
  '#c2410c',
  '#b45309',
  '#0369a1',
  '#be123c',
  '#475569'
]);

const compactMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1
});

function finitePositive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function percentLabel(value, total) {
  return `${chartPercent(value, total).toFixed(1).replace('.', ',')}%`;
}

function tooltipText(parts) {
  return escapeHtml(parts.filter(Boolean).join(' · '));
}

function safeChartColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : fallback;
}

function toneClass(value) {
  if (value > 0) return 'is-positive';
  if (value < 0) return 'is-negative';
  return 'is-neutral';
}

export function chartPercent(value, total) {
  const safeTotal = finitePositive(total);
  if (!safeTotal) return 0;
  return Math.max(0, Math.min(100, (finitePositive(value) / safeTotal) * 100));
}

export function buildConicGradient(items, fallback = '#dfe5ec') {
  const normalized = items
    .map(item => ({ ...item, value: finitePositive(item.value) }))
    .filter(item => item.value > 0);
  const total = normalized.reduce((sum, item) => sum + item.value, 0);
  if (!total) return fallback;

  let cursor = 0;
  const stops = normalized.map(item => {
    const start = cursor;
    cursor += (item.value / total) * 100;
    return `${item.color} ${start.toFixed(3)}% ${cursor.toFixed(3)}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function emptyChart(message, detail = 'Os gráficos serão atualizados quando houver movimentações realizadas.') {
  return `<div class="native-chart-empty" role="status">
    <span class="native-chart-empty-icon" aria-hidden="true">▥</span>
    <strong>${escapeHtml(message)}</strong>
    <small>${escapeHtml(detail)}</small>
  </div>`;
}

function donutSegments(items, total) {
  let cursor = 0;
  return items.map((item, index) => {
    const percentage = chartPercent(item.value, total);
    const visiblePercentage = Math.max(0.45, percentage - Math.min(0.8, percentage / 3));
    const offset = cursor;
    cursor += percentage;
    const details = tooltipText([
      item.label,
      money.format(item.value),
      `${percentLabel(item.value, total)} do total`
    ]);

    return `<circle
      class="native-donut-segment ${item.pattern || ''}"
      cx="60"
      cy="60"
      r="45"
      pathLength="100"
      fill="none"
      stroke="${item.color}"
      stroke-width="14"
      stroke-dasharray="${visiblePercentage.toFixed(3)} ${(100 - visiblePercentage).toFixed(3)}"
      stroke-dashoffset="-${offset.toFixed(3)}"
      data-chart-series="series-${index}"
      data-chart-tooltip="${details}"
      tabindex="0"
      aria-label="${details}"
      style="--segment-delay:${index * 70}ms"
    ></circle>`;
  }).join('');
}

function donutChart({
  items,
  centerLabel,
  centerValue,
  ariaLabel,
  insightLabel,
  insightValue,
  insightNote,
  insightTone = 'is-neutral'
}) {
  const safeItems = items
    .map((item, index) => ({
      label: String(item.label || ''),
      value: finitePositive(item.value),
      color: item.color || ACCOUNT_PALETTE[index % ACCOUNT_PALETTE.length],
      pattern: item.pattern || ''
    }))
    .filter(item => item.value > 0);
  const total = safeItems.reduce((sum, item) => sum + item.value, 0);
  if (!total) return emptyChart('Sem valores realizados no período.');

  const gradient = buildConicGradient(safeItems);
  const legend = safeItems.map((item, index) => {
    const details = tooltipText([
      item.label,
      money.format(item.value),
      `${percentLabel(item.value, total)} do total`
    ]);
    return `<li
      class="native-chart-legend-item"
      data-chart-series="series-${index}"
      data-chart-tooltip="${details}"
      tabindex="0"
      aria-label="${details}"
    >
      <span class="native-chart-swatch ${item.pattern || ''}" style="--chart-color:${item.color}" aria-hidden="true"></span>
      <span class="native-chart-legend-copy"><strong>${escapeHtml(item.label)}</strong><small>${percentLabel(item.value, total)} do total</small></span>
      <span class="native-chart-legend-value"><strong>${money.format(item.value)}</strong><small>valor realizado</small></span>
    </li>`;
  }).join('');

  return `<div class="native-donut-layout">
    <div class="native-donut-visual">
      <svg class="native-donut" viewBox="0 0 120 120" role="group" aria-label="${escapeHtml(ariaLabel)}" style="--chart-background:${gradient}">
        <circle class="native-donut-track" cx="60" cy="60" r="45" pathLength="100" fill="none" stroke-width="14"></circle>
        ${donutSegments(safeItems, total)}
      </svg>
      <span class="native-donut-center"><small>${escapeHtml(centerLabel)}</small><strong>${escapeHtml(centerValue)}</strong></span>
    </div>
    <ul class="native-chart-legend">${legend}</ul>
    <div class="native-chart-insight ${insightTone}">
      <span>${escapeHtml(insightLabel)}</span>
      <strong>${escapeHtml(insightValue)}</strong>
      <small>${escapeHtml(insightNote)}</small>
    </div>
    <div class="native-chart-tooltip" role="status" aria-live="polite" hidden></div>
  </div>`;
}

function categoryScale(maximum) {
  return [0, 25, 50, 75, 100]
    .map(step => `<span style="--scale-position:${step}%">${compactMoney.format(maximum * step / 100)}</span>`)
    .join('');
}

function categoryChart(categories) {
  if (!categories.length) return emptyChart('Sem categorias realizadas no período.');

  const normalized = categories.map(([name, values]) => ({
    name: String(name || 'Sem categoria'),
    entries: finitePositive(values.entries),
    exits: finitePositive(values.exits)
  }));
  const maximum = Math.max(
    0,
    ...normalized.flatMap(item => [item.entries, item.exits])
  );
  if (!maximum) return emptyChart('Sem valores realizados no período.');

  const totalMovement = normalized.reduce(
    (sum, item) => sum + item.entries + item.exits,
    0
  );
  const average = totalMovement / normalized.length;
  const leader = normalized.reduce((current, item) => (
    item.entries + item.exits > current.entries + current.exits ? item : current
  ), normalized[0]);

  const rows = normalized.map((item, index) => {
    const total = item.entries + item.exits;
    const isLeader = item === leader;
    const entryDetails = tooltipText([
      item.name,
      'Entradas',
      money.format(item.entries),
      `${percentLabel(item.entries, total || 1)} da categoria`
    ]);
    const exitDetails = tooltipText([
      item.name,
      'Saídas',
      money.format(item.exits),
      `${percentLabel(item.exits, total || 1)} da categoria`
    ]);

    return `<article class="native-category-row ${isLeader ? 'is-leader' : ''}" role="listitem" style="--row-delay:${index * 45}ms">
      <header>
        <div><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>${isLeader ? '<span>Maior movimentação</span>' : ''}</div>
        <small>${money.format(total)}</small>
      </header>
      <div class="native-category-series is-entry">
        <span>Entradas</span>
        <div
          class="native-category-track"
          data-chart-tooltip="${entryDetails}"
          tabindex="0"
          aria-label="${entryDetails}"
        ><i style="--bar-size:${chartPercent(item.entries, maximum).toFixed(2)}%"></i></div>
        <strong>${money.format(item.entries)}</strong>
      </div>
      <div class="native-category-series is-exit">
        <span>Saídas</span>
        <div
          class="native-category-track"
          data-chart-tooltip="${exitDetails}"
          tabindex="0"
          aria-label="${exitDetails}"
        ><i style="--bar-size:${chartPercent(item.exits, maximum).toFixed(2)}%"></i></div>
        <strong>${money.format(item.exits)}</strong>
      </div>
    </article>`;
  }).join('');

  return `<div class="native-category-chart-shell">
    <div class="native-category-overview" aria-label="Resumo do gráfico por categoria">
      <span><small>Categorias</small><strong>${normalized.length}</strong></span>
      <span><small>Média movimentada</small><strong>${money.format(average)}</strong></span>
      <span><small>Destaque</small><strong title="${escapeHtml(leader.name)}">${escapeHtml(leader.name)}</strong></span>
    </div>
    <div class="native-category-key" aria-label="Legenda">
      <span class="is-entry"><i aria-hidden="true"></i> Entradas</span>
      <span class="is-exit"><i aria-hidden="true"></i> Saídas</span>
    </div>
    <div class="native-category-scale" aria-hidden="true">${categoryScale(maximum)}</div>
    <div class="native-category-chart" role="list" aria-label="Movimentação realizada por categoria">${rows}</div>
    <div class="native-chart-tooltip" role="status" aria-live="polite" hidden></div>
  </div>`;
}


export function buildCashFlowSeries(items, isProgrammed = () => false) {
  const realized = (items || [])
    .filter(item => !isProgrammed(item))
    .map(item => ({ ...item, parsedDate: parseLocalDate(item?.date || '') }))
    .filter(item => item.parsedDate && !Number.isNaN(item.parsedDate.getTime()))
    .sort((first, second) => first.parsedDate - second.parsedDate);

  if (!realized.length) return [];

  const firstDate = realized[0].parsedDate;
  const lastDate = realized[realized.length - 1].parsedDate;
  const spanDays = Math.round((lastDate - firstDate) / 86400000);
  const uniqueDates = new Set(realized.map(item => item.date)).size;
  const groupByMonth = spanDays > 62 || uniqueDates > 14;
  const buckets = new Map();

  realized.forEach(item => {
    const year = item.parsedDate.getFullYear();
    const month = String(item.parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(item.parsedDate.getDate()).padStart(2, '0');
    const key = groupByMonth ? `${year}-${month}` : `${year}-${month}-${day}`;
    const current = buckets.get(key) || {
      key,
      date: groupByMonth ? new Date(year, item.parsedDate.getMonth(), 1) : item.parsedDate,
      entries: 0,
      exits: 0
    };
    current.entries += finitePositive(item.entry);
    current.exits += finitePositive(item.exit);
    buckets.set(key, current);
  });

  let accumulated = 0;
  return [...buckets.values()]
    .sort((first, second) => first.date - second.date)
    .map(bucket => {
      const net = bucket.entries - bucket.exits;
      accumulated += net;
      return {
        ...bucket,
        net,
        accumulated,
        label: new Intl.DateTimeFormat('pt-BR', groupByMonth
          ? { month: 'short', year: '2-digit' }
          : { day: '2-digit', month: '2-digit' })
          .format(bucket.date)
          .replace('.', '')
      };
    })
    .slice(-12);
}

function cashFlowChart(series) {
  if (!series.length) return emptyChart('Sem fluxo realizado no período.');

  const maximum = Math.max(0, ...series.flatMap(item => [item.entries, item.exits]));
  const totalEntries = series.reduce((sum, item) => sum + item.entries, 0);
  const totalExits = series.reduce((sum, item) => sum + item.exits, 0);
  const finalResult = series[series.length - 1]?.accumulated || 0;
  const strongest = series.reduce((leader, item) => (
    !leader || item.net > leader.net ? item : leader
  ), null);

  const rows = series.map((item, index) => {
    const entryDetails = tooltipText([
      item.label,
      'Entradas',
      money.format(item.entries)
    ]);
    const exitDetails = tooltipText([
      item.label,
      'Saídas',
      money.format(item.exits)
    ]);
    return `<article class="native-flow-row" style="--row-delay:${index * 45}ms">
      <header><strong>${escapeHtml(item.label)}</strong><span class="${toneClass(item.net)}">${item.net >= 0 ? '+' : '−'} ${money.format(Math.abs(item.net))}</span></header>
      <div class="native-flow-series is-entry"><small>Entradas</small><div class="native-flow-track" data-chart-tooltip="${entryDetails}" tabindex="0" aria-label="${entryDetails}"><i style="--bar-size:${chartPercent(item.entries, maximum).toFixed(2)}%"></i></div><strong>${money.format(item.entries)}</strong></div>
      <div class="native-flow-series is-exit"><small>Saídas</small><div class="native-flow-track" data-chart-tooltip="${exitDetails}" tabindex="0" aria-label="${exitDetails}"><i style="--bar-size:${chartPercent(item.exits, maximum).toFixed(2)}%"></i></div><strong>${money.format(item.exits)}</strong></div>
      <footer><small>Resultado acumulado</small><strong class="${toneClass(item.accumulated)}">${money.format(item.accumulated)}</strong></footer>
    </article>`;
  }).join('');

  return `<div class="native-flow-chart-shell">
    <div class="native-flow-overview" aria-label="Resumo da evolução do fluxo de caixa">
      <span><small>Entradas</small><strong>${money.format(totalEntries)}</strong></span>
      <span><small>Saídas</small><strong>${money.format(totalExits)}</strong></span>
      <span class="${toneClass(finalResult)}"><small>Resultado</small><strong>${money.format(finalResult)}</strong></span>
    </div>
    <div class="native-flow-highlight"><span aria-hidden="true">★</span><div><small>Melhor intervalo</small><strong>${escapeHtml(strongest?.label || 'Sem dados')}</strong><p>${strongest ? money.format(strongest.net) : money.format(0)} de resultado.</p></div></div>
    <div class="native-flow-chart" role="list" aria-label="Evolução financeira por intervalo">${rows}</div>
    <div class="native-chart-tooltip" role="status" aria-live="polite" hidden></div>
  </div>`;
}

function bindChartInteractions(root) {
  if (typeof root.querySelectorAll !== 'function') return;

  root.querySelectorAll('.native-chart-host').forEach(host => {
    const tooltip = host.querySelector('.native-chart-tooltip');
    if (!tooltip) return;

    const highlightSeries = series => {
      host.querySelectorAll('[data-chart-series]').forEach(item => {
        item.classList.toggle('is-active', Boolean(series) && item.dataset.chartSeries === series);
        item.classList.toggle('is-muted', Boolean(series) && item.dataset.chartSeries !== series);
      });
    };

    const showTooltip = (target, event) => {
      tooltip.textContent = target.dataset.chartTooltip || '';
      tooltip.hidden = !tooltip.textContent;
      if (tooltip.hidden) return;

      const hostRect = host.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const pointerX = Number.isFinite(event?.clientX) && event.clientX > 0
        ? event.clientX - hostRect.left
        : targetRect.left - hostRect.left + targetRect.width / 2;
      const pointerY = Number.isFinite(event?.clientY) && event.clientY > 0
        ? event.clientY - hostRect.top
        : targetRect.top - hostRect.top;
      tooltip.style.setProperty('--tooltip-x', `${Math.max(16, Math.min(hostRect.width - 16, pointerX))}px`);
      tooltip.style.setProperty('--tooltip-y', `${Math.max(18, pointerY - 12)}px`);
      highlightSeries(target.dataset.chartSeries || '');
    };

    const hideTooltip = () => {
      tooltip.hidden = true;
      highlightSeries('');
    };

    host.querySelectorAll('[data-chart-tooltip]').forEach(target => {
      target.addEventListener('pointerenter', event => showTooltip(target, event));
      target.addEventListener('pointermove', event => showTooltip(target, event));
      target.addEventListener('pointerleave', hideTooltip);
      target.addEventListener('focus', event => showTooltip(target, event));
      target.addEventListener('blur', hideTooltip);
    });
  });
}

export function destroyTreasuryCharts() {
  // Os gráficos e seus eventos são descartados junto com a view da Tesouraria.
}

export function renderTreasuryCharts({
  root,
  state,
  treasury,
  treasuryChartToken,
  totals,
  accountSummaries,
  categories,
  periodItems = [],
  isTreasuryView
}) {
  if (!isTreasuryView() || treasury.chartToken !== treasuryChartToken) return;

  const financeContext = root.querySelector('#financeChart');
  const cashFlowContext = root.querySelector('#cashFlowChart');
  const categoryContext = root.querySelector('#categoryChart');
  const accountContext = root.querySelector('#accountChart');
  if (!financeContext || !cashFlowContext || !categoryContext || !accountContext) return;

  const primaryColor = safeChartColor(state.settings.primaryColor, ACCOUNT_PALETTE[0]);
  const financialResult = safeNumber(totals.entries) - safeNumber(totals.exits);
  const resultRate = totals.entries
    ? Math.abs(financialResult) / totals.entries * 100
    : 0;

  const financeChanged = renderHtmlIfChanged(financeContext, donutChart({
    items: [
      { label: 'Entradas', value: totals.entries, color: CHART_COLORS.entry, pattern: 'is-entry' },
      { label: 'Saídas', value: totals.exits, color: CHART_COLORS.exit, pattern: 'is-exit' }
    ],
    centerLabel: 'Movimentado',
    centerValue: money.format(safeNumber(totals.entries) + safeNumber(totals.exits)),
    ariaLabel: `Entradas ${money.format(totals.entries)} e saídas ${money.format(totals.exits)}`,
    insightLabel: 'Resultado realizado',
    insightValue: money.format(financialResult),
    insightNote: financialResult === 0
      ? 'Entradas e saídas estão equilibradas.'
      : `${resultRate.toFixed(1).replace('.', ',')}% das entradas no período.`,
    insightTone: toneClass(financialResult)
  }));

  const cashFlowChanged = renderHtmlIfChanged(
    cashFlowContext,
    cashFlowChart(buildCashFlowSeries(periodItems, item => treasury.isProgrammed(item)))
  );

  const categoryChanged = renderHtmlIfChanged(categoryContext, categoryChart(categories));

  const positiveAccounts = accountSummaries
    .filter(account => finitePositive(account.balance) > 0)
    .map((account, index) => ({
      label: account.name,
      value: account.balance,
      color: index === 0 ? primaryColor : ACCOUNT_PALETTE[index % ACCOUNT_PALETTE.length]
    }));
  const accountTotal = positiveAccounts.reduce((sum, item) => sum + item.value, 0);
  const leadingAccount = positiveAccounts.reduce((leader, item) => (
    !leader || item.value > leader.value ? item : leader
  ), null);

  const accountChanged = renderHtmlIfChanged(accountContext, donutChart({
    items: positiveAccounts,
    centerLabel: 'Saldo total',
    centerValue: money.format(accountTotal),
    ariaLabel: positiveAccounts.length
      ? `Distribuição do saldo entre ${positiveAccounts.length} conta(s)`
      : 'Nenhuma conta com saldo positivo',
    insightLabel: 'Maior saldo',
    insightValue: leadingAccount ? money.format(leadingAccount.value) : money.format(0),
    insightNote: leadingAccount
      ? `${leadingAccount.label} · ${percentLabel(leadingAccount.value, accountTotal)} do saldo positivo.`
      : 'Nenhuma conta com saldo positivo.',
    insightTone: leadingAccount ? 'is-primary' : 'is-neutral'
  }));

  if (financeChanged || cashFlowChanged || categoryChanged || accountChanged) {
    bindChartInteractions(root);
  }
}
