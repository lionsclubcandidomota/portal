import { parseLocalDate } from '../../utils.js';

const OVERVIEW_SELECTORS = Object.freeze([
  '.treasury-period-card',
  '.treasury-period-summary',
  '.treasury-realized-kpis',
  '.treasury-projection-card',
  '.treasury-accounts-card'
]);

const SENSITIVE_MONEY_SELECTOR = [
  '.treasury-realized-kpis .kpi-value',
  '.projection-metric strong',
  '.treasury-account-balance strong',
  '.treasury-account-balance span',
  '.membership-kpis strong',
  '.mutual-kpis strong',
  '.mutual-selection-bar strong',
  '.treasury-value',
  '.amount',
  '.chart-wrap'
].join(',');

function configurePanelVisibility(root, section) {
  OVERVIEW_SELECTORS.forEach(selector => {
    root.querySelectorAll(selector).forEach(element => {
      element.dataset.treasuryPanel = 'overview';
    });
  });

  root.querySelector('.membership-control-card:not(.mutual-control-card)')
    ?.setAttribute('data-treasury-panel', 'memberships');
  root.querySelector('.mutual-control-card')
    ?.setAttribute('data-treasury-panel', 'mutuals');
  root.querySelector('.grid-main')
    ?.setAttribute('data-treasury-panel', 'movements');

  root.querySelectorAll('[data-treasury-panel]').forEach(panel => {
    const panelName = panel.dataset.treasuryPanel;
    const show = panelName === section
      || (
        section === 'movements'
        && panelName === 'overview'
        && (panel.matches('.treasury-period-card') || panel.matches('.treasury-period-summary'))
      );
    panel.hidden = !show;
  });
}

export function bindTreasuryOverview({ root, treasury, helpers, rerender }) {
  const {
    financePrivacy,
    ensureAdmin,
    openForm,
    toast,
    openTreasuryAccountsManager
  } = helpers;

  configurePanelVisibility(root, treasury.section);

  root.querySelectorAll('[data-treasury-section]').forEach(button => {
    const active = button.dataset.treasurySection === treasury.section;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
    button.addEventListener('click', () => {
      treasury.section = button.dataset.treasurySection;
      rerender();
    });
  });

  root.querySelectorAll('[data-new="treasury"]').forEach(button => {
    button.addEventListener('click', () => ensureAdmin(() => openForm('treasury')));
  });

  root.querySelectorAll(SENSITIVE_MONEY_SELECTOR)
    .forEach(element => element.classList.add('sensitive-money'));
  financePrivacy.bind(root);

  root.querySelector('#treasuryPeriod')?.addEventListener('change', event => {
    treasury.period = event.currentTarget.value;
    rerender();
  });

  root.querySelector('#treasuryApplyPeriod')?.addEventListener('click', () => {
    const start = root.querySelector('#treasuryStart')?.value || '';
    const end = root.querySelector('#treasuryEnd')?.value || '';
    if (!start || !end) {
      toast('Informe a data inicial e a data final.');
      return;
    }
    if (parseLocalDate(start) > parseLocalDate(end)) {
      toast('A data inicial não pode ser posterior à data final.');
      return;
    }
    treasury.customStart = start;
    treasury.customEnd = end;
    rerender();
  });

  root.querySelector('#manageTreasuryAccounts')
    ?.addEventListener('click', openTreasuryAccountsManager);
}
