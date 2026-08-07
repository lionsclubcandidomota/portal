import { sumTreasury } from '../../utils.js';
import { destroyTreasuryCharts } from './charts.js';
import { buildMembershipViewModel, buildOperationalMembershipViewModel } from './memberships.js?v=6.45.0';
import { buildMutualViewModel, buildOperationalMutualViewModel } from './mutuals.js?v=6.45.0';
import { bindTreasuryMovementLists, categorySummaries } from './movements.js';
import { renderTreasuryShell } from './view-shell.js?v=6.45.0';
import { bindTreasuryOverview } from './view-overview.js?v=6.45.0';
import { bindMembershipSection } from './view-memberships.js?v=6.45.0';
import { bindMutualSection } from './view-mutuals.js?v=6.45.0';
import { bindTreasuryCharts } from './view-charts.js?v=6.45.0';

export function renderTreasury(state, treasury, helpers) {
  const { root, isTreasuryView } = helpers;
  const rerender = () => renderTreasury(state, treasury, helpers);

  destroyTreasuryCharts();
  const treasuryChartToken = Symbol('treasury-chart-render');
  treasury.chartToken = treasuryChartToken;

  const periodItems = treasury.itemsForPeriod();
  const totals = sumTreasury(periodItems);
  const accountSummaries = treasury.accountSummaries(periodItems);
  const membershipModel = treasury.membershipOperational
    ? buildOperationalMembershipViewModel(state, treasury, treasury.membershipOperational)
    : buildMembershipViewModel(state, treasury);
  const mutualModel = treasury.mutualOperational
    ? buildOperationalMutualViewModel(state, treasury, treasury.mutualOperational)
    : buildMutualViewModel(state, treasury);
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
  bindTreasuryMovementLists({ root, state, periodItems, treasury, helpers });
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
