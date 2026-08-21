import { renderTreasuryCharts } from './charts.js';

function updateChartCardState(root, treasury, chartId, collapsed) {
  const card = root.querySelector(`[data-treasury-chart-card="${chartId}"]`);
  const toggle = root.querySelector(`[data-treasury-chart-toggle="${chartId}"]`);
  const body = card?.querySelector('.treasury-chart-body');
  card?.classList.toggle('is-collapsed', collapsed);
  card?.setAttribute('aria-expanded', String(!collapsed));
  if (body) body.hidden = collapsed;
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const hint = toggle.querySelector('.treasury-chart-toggle-hint');
    if (hint) hint.textContent = collapsed ? 'Clique para expandir' : 'Clique para recolher';
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
  root.querySelectorAll('[data-treasury-chart-toggle]').forEach(toggle => {
    const handleToggle = event => {
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      if (event.type === 'keydown') event.preventDefault();
      const chartId = toggle.dataset.treasuryChartToggle;
      const collapsed = treasury.toggleChart(chartId);
      updateChartCardState(root, treasury, chartId, collapsed);
    };
    toggle.addEventListener('click', handleToggle);
    toggle.addEventListener('keydown', handleToggle);
  });

  root.querySelectorAll('[data-treasury-chart-card]').forEach(card => {
    const expandCard = event => {
      const chartId = card.dataset.treasuryChartCard;
      const header = event.target.closest('[data-treasury-chart-toggle]');
      if (event.type === 'click') {
        if (header) return;
        if (!treasury.isChartCollapsed(chartId)) return;
        if (event.target.closest('button, a, input, select, textarea, [role="button"]')) return;
      }
      if (event.type === 'keydown') {
        if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
      }
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
