import { sumTreasury } from '../../utils.js';
import { destroyTreasuryCharts } from './charts.js';
import { buildMembershipViewModel } from './memberships.js';
import { buildMutualViewModel } from './mutuals.js';
import { bindTreasuryMovementLists, categorySummaries } from './movements.js';
import { renderTreasuryShell } from './view-shell.js?v=6.46.5';
import { bindTreasuryOverview } from './view-overview.js?v=6.46.5';
import { bindMembershipSection } from './view-memberships.js?v=6.46.5';
import { bindMutualSection } from './view-mutuals.js?v=6.46.5';
import { bindTreasuryCharts } from './view-charts.js?v=6.46.5';

export function renderTreasury(state, treasury, helpers) {
  const { root, isTreasuryView } = helpers;
  const rerender = () => renderTreasury(state, treasury, helpers);

  destroyTreasuryCharts();
  const treasuryChartToken = Symbol('treasury-chart-render');
  treasury.chartToken = treasuryChartToken;

  const periodItems = treasury.itemsForPeriod();
  const totals = sumTreasury(periodItems);
  const accountSummaries = treasury.accountSummaries(periodItems);
  const membershipModel = buildMembershipViewModel(state, treasury);
  const mutualModel = buildMutualViewModel(state, treasury);
  const categories = categorySummaries(periodItems, treasury);

  root.innerHTML = renderTreasuryShell({
    treasury,
    helpers,
    totals,
    accountSummaries,
    membershipModel,
    mutualModel
  });

  bindTreasuryOverview({ root, treasury, helpers, rerender });
  bindMembershipSection({ root, treasury, helpers, membershipModel, rerender });
  bindMutualSection({ root, treasury, helpers, mutualModel, rerender });
  bindTreasuryMovementLists({ root, periodItems, treasury, helpers });
  bindTreasuryCharts({
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
