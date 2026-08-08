import { renderTreasuryCharts } from './charts.js';

function updateChartCardState(root, treasury, chartId, collapsed) {
  const card = root.querySelector(`[data-treasury-chart-card="${chartId}"]`);
  const button = root.querySelector(`[data-treasury-chart-toggle="${chartId}"]`);
  const body = card?.querySelector('.treasury-chart-body');
  card?.classList.toggle('is-collapsed', collapsed);
  card?.setAttribute('aria-expanded', String(!collapsed));
  if (body) body.hidden = collapsed;
  if (button) {
    button.setAttribute('aria-expanded', String(!collapsed));
    const icon = button.querySelector('span');
    const label = button.querySelector('strong');
    if (icon) icon.textContent = collapsed ? '＋' : '−';
    if (label) label.textContent = collapsed ? 'Expandir' : 'Minimizar';
  }

  const chartTotal = root.querySelectorAll('[data-treasury-chart-card]').length;
  const expandAll = root.querySelector('#treasuryExpandCharts');
  const collapseAll = root.querySelector('#treasuryCollapseCharts');
  if (expandAll) expandAll.hidden = treasury.collapsedChartCount === 0;
  if (collapseAll) collapseAll.hidden = treasury.collapsedChartCount >= chartTotal;
}

export function bindTreasuryCharts({
  root,
  state,
  treasury,
  treasuryChartToken,
  totals,
  accountSummaries,
  categories,
  periodItems,
  isTreasuryView
}) {
  root.querySelectorAll('[data-treasury-chart-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const chartId = button.dataset.treasuryChartToggle;
      const collapsed = treasury.toggleChart(chartId);
      updateChartCardState(root, treasury, chartId, collapsed);
    });
  });

  root.querySelectorAll('[data-treasury-chart-card]').forEach(card => {
    const expandCard = event => {
      if (!treasury.isChartCollapsed(card.dataset.treasuryChartCard)) return;
      if (event.type === 'click' && event.target.closest('button, a, input, select, textarea, [role="button"]')) return;
      if (event.type === 'keydown') {
        if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
      }
      const chartId = card.dataset.treasuryChartCard;
      const collapsed = treasury.toggleChart(chartId);
      updateChartCardState(root, treasury, chartId, collapsed);
    };
    card.addEventListener('click', expandCard);
    card.addEventListener('keydown', expandCard);
  });

  root.querySelector('#treasuryExpandCharts')?.addEventListener('click', () => {
    treasury.expandAllCharts();
    root.querySelectorAll('[data-treasury-chart-card]').forEach(card => {
      updateChartCardState(root, treasury, card.dataset.treasuryChartCard, false);
    });
  });

  root.querySelector('#treasuryCollapseCharts')?.addEventListener('click', () => {
    const chartIds = [...root.querySelectorAll('[data-treasury-chart-card]')]
      .map(card => card.dataset.treasuryChartCard)
      .filter(Boolean);
    treasury.collapseAllCharts(chartIds);
    chartIds.forEach(chartId => updateChartCardState(root, treasury, chartId, true));
  });

  renderTreasuryCharts({
    root,
    state,
    treasury,
    treasuryChartToken,
    totals,
    accountSummaries,
    categories,
    periodItems,
    isTreasuryView
  });
}
