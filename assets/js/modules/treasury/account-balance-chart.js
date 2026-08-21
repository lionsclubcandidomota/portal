import { escapeHtml, money } from '../../utils.js';

const compactMoney = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1
});

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toneClass(value) {
  if (value > 0) return 'is-positive';
  if (value < 0) return 'is-negative';
  return 'is-neutral';
}

function balanceStateLabel(value) {
  if (value > 0) return 'Positiva';
  if (value < 0) return 'Negativa';
  return 'Zerada';
}

function tooltipText(parts) {
  return escapeHtml(parts.filter(Boolean).join(' · '));
}

export function accountBalanceChart(accountSummaries = []) {
  const accounts = (Array.isArray(accountSummaries) ? accountSummaries : [])
    .map(account => ({
      name: String(account?.name || 'Conta'),
      balance: safeNumber(account?.balance),
      projectedBalance: safeNumber(account?.projectedBalance),
      active: account?.active !== false
    }));

  if (!accounts.length) {
    return '<div class="native-chart-empty" role="status"><strong>Nenhuma conta cadastrada.</strong><small>Cadastre uma conta para acompanhar sua posição financeira.</small></div>';
  }

  const maximumAbsolute = Math.max(1, ...accounts.map(account => Math.abs(account.balance)));
  const netBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const positiveCount = accounts.filter(account => account.balance > 0).length;
  const negativeAccounts = accounts.filter(account => account.balance < 0);
  const negativeCount = negativeAccounts.length;
  const lowestAccount = negativeAccounts.reduce((lowest, account) => (
    !lowest || account.balance < lowest.balance ? account : lowest
  ), null);

  const rows = accounts.map((account, index) => {
    const magnitude = Math.abs(account.balance) / maximumAbsolute * 100;
    const details = tooltipText([
      account.name,
      `Saldo atual ${money.format(account.balance)}`,
      `Projetado ${money.format(account.projectedBalance)}`
    ]);
    const tone = toneClass(account.balance);
    const projectedTone = toneClass(account.projectedBalance);
    const stateLabel = balanceStateLabel(account.balance);

    return `<article class="native-account-balance-row ${tone} ${account.active ? '' : 'is-inactive'}" role="listitem" style="--row-delay:${index * 45}ms">
      <header class="native-account-balance-row-header">
        <div class="native-account-balance-name"><strong title="${escapeHtml(account.name)}">${escapeHtml(account.name)}</strong><small>${account.active ? 'Conta ativa' : 'Conta inativa'}</small></div>
        <span class="native-account-balance-state ${tone}">${stateLabel}</span>
      </header>
      <div class="native-account-balance-values">
        <div><small>Saldo atual</small><strong class="${tone}">${money.format(account.balance)}</strong></div>
        <div><small>Saldo projetado</small><strong class="${projectedTone}">${money.format(account.projectedBalance)}</strong></div>
      </div>
      <div class="native-account-balance-track" data-chart-tooltip="${details}" tabindex="0" aria-label="${details}">
        <span class="native-account-balance-half is-negative">${account.balance < 0 ? `<i style="--bar-size:${magnitude.toFixed(2)}%"></i>` : ''}</span>
        <b class="native-account-zero" aria-hidden="true"></b>
        <span class="native-account-balance-half is-positive">${account.balance > 0 ? `<i style="--bar-size:${magnitude.toFixed(2)}%"></i>` : ''}</span>
      </div>
    </article>`;
  }).join('');

  return `<div class="native-account-balance-shell">
    <div class="native-account-balance-overview" aria-label="Resumo dos saldos das contas">
      <span class="${toneClass(netBalance)}"><small>Saldo líquido</small><strong>${money.format(netBalance)}</strong></span>
      <span class="is-positive"><small>Positivas</small><strong>${positiveCount}</strong></span>
      <span class="${negativeCount ? 'is-negative' : 'is-neutral'}"><small>Negativas</small><strong>${negativeCount}</strong></span>
    </div>
    <div class="native-account-balance-guide">
      <div class="native-account-balance-key" aria-label="Legenda"><span class="is-negative"><i aria-hidden="true"></i> Negativo</span><span class="is-positive"><i aria-hidden="true"></i> Positivo</span></div>
      <div class="native-account-balance-scale" aria-hidden="true"><span>− ${compactMoney.format(maximumAbsolute)}</span><b>0</b><span>+ ${compactMoney.format(maximumAbsolute)}</span></div>
    </div>
    <div class="native-account-balance-chart" role="list" aria-label="Saldos atuais por conta">${rows}</div>
    <div class="native-chart-insight native-account-balance-insight ${lowestAccount ? 'is-negative' : 'is-positive'}"><span>${lowestAccount ? 'Atenção: conta negativa' : 'Posição das contas'}</span><strong>${lowestAccount ? money.format(lowestAccount.balance) : money.format(netBalance)}</strong><small>${lowestAccount ? `${lowestAccount.name} está abaixo de zero.` : 'Nenhuma conta está com saldo negativo.'}</small></div>
    <div class="native-chart-tooltip" role="status" aria-live="polite" hidden></div>
  </div>`;
}
