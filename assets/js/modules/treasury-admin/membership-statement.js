import { escapeHtml, formatDate, money } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.49.1';

const EPSILON = 0.005;


function ensureStatementStyles() {
  if (document.querySelector('link[data-membership-statement-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../../css/pages/membership-statement.css?v=6.49.1', import.meta.url).href;
  link.dataset.membershipStatementCss = 'true';
  document.head.appendChild(link);
}

function statementMonths(treasury, period = null) {
  const currentMonth = String(treasury.currentMonth?.() || '');
  const fallbackStart = currentMonth ? `${currentMonth.slice(0, 4)}-01` : '';
  const selectedStart = String(period?.start || '');
  const selectedEnd = String(period?.end || '');
  const start = selectedStart || String(treasury.membershipStart || treasury.membershipMonth || fallbackStart || currentMonth);
  const end = selectedEnd || String(treasury.membershipEnd || (treasury.membershipStart ? treasury.membershipStart : currentMonth) || start);
  if (!start || !end) return [];
  return treasury.monthRange(start <= end ? start : end, start <= end ? end : start);
}

function paymentLinesForMonth(state, treasury, memberId, month) {
  return treasury.paymentsFor(memberId, month)
    .map(item => {
      const amount = treasury.membershipAllocationForMonth(item, memberId, month);
      if (amount <= EPSILON) return null;
      return {
        id: item.id,
        date: item.paymentDate || item.date || '',
        amount,
        account: treasury.accountFor(item)?.name || 'Conta não informada'
      };
    })
    .filter(Boolean)
    .sort((first, second) => String(first.date).localeCompare(String(second.date)));
}

function openingDebtPayments(state, treasury, memberId) {
  return state.treasury
    .filter(item => treasury.isMembershipEntry(item) && !treasury.isProgrammed(item))
    .map(item => {
      const allocation = (item.membershipOpeningDebtAllocations || [])
        .find(entry => String(entry?.memberId || '') === String(memberId));
      if (!allocation || Number(allocation.amount || 0) <= EPSILON) return null;
      return {
        id: item.id,
        date: item.paymentDate || item.date || '',
        amount: Number(allocation.amount || 0),
        account: treasury.accountFor(item)?.name || 'Conta não informada'
      };
    })
    .filter(Boolean)
    .sort((first, second) => String(first.date).localeCompare(String(second.date)));
}

function statusForMonth(expected, paid) {
  const credit = Math.max(0, paid - expected);
  const outstanding = Math.max(0, expected - paid);
  if (credit > EPSILON) return { key: 'credit', label: 'Crédito' };
  if (outstanding <= EPSILON) return { key: 'paid', label: 'Quitada' };
  if (paid > EPSILON) return { key: 'partial', label: 'Parcial' };
  return { key: 'pending', label: 'Em aberto' };
}

export function buildMembershipStatement(state, treasury, member, period = null) {
  const months = statementMonths(treasury, period);
  const rows = months.map(month => {
    const expected = typeof treasury.membershipExpectedAmountForMemberMonth === 'function'
      ? treasury.membershipExpectedAmountForMemberMonth(member.id, month)
      : treasury.membershipExpectedAmountForMember(member.id);
    const paid = treasury.membershipPaidAmountForMonth(member.id, month);
    const outstanding = Math.max(0, expected - paid);
    const credit = Math.max(0, paid - expected);
    return {
      month,
      expected,
      paid,
      outstanding,
      credit,
      status: statusForMonth(expected, paid),
      payments: paymentLinesForMonth(state, treasury, member.id, month)
    };
  });

  const openingOriginal = treasury.membershipOpeningDebtForMember(member.id);
  const openingPaid = treasury.membershipOpeningDebtPaidAmount(member.id);
  const openingOutstanding = treasury.membershipOpeningDebtOutstanding(member.id);
  const totalExpected = rows.reduce((sum, row) => sum + row.expected, 0);
  const totalReceived = rows.reduce((sum, row) => sum + row.paid, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
  const credit = rows.reduce((sum, row) => sum + row.credit, 0);
  const totalOutstanding = outstanding + openingOutstanding;

  return {
    months,
    rows,
    openingOriginal,
    openingPaid,
    openingOutstanding,
    openingPayments: openingDebtPayments(state, treasury, member.id),
    totalExpected,
    totalReceived,
    outstanding,
    totalOutstanding,
    credit,
    net: totalOutstanding - credit
  };
}

function paymentDetails(payments) {
  if (!payments.length) return '<span class="membership-statement-no-payment">Nenhum pagamento registrado.</span>';
  return `<div class="membership-statement-payments">${payments.map(payment => `<span><b>${escapeHtml(formatDate(payment.date))}</b><em class="sensitive-money">${escapeHtml(money.format(payment.amount))}</em><small>${escapeHtml(payment.account)}</small></span>`).join('')}</div>`;
}

function monthRow(row, treasury) {
  const balance = row.outstanding > EPSILON ? row.outstanding : row.credit;
  const balanceLabel = row.credit > EPSILON ? 'Crédito' : 'Em aberto';
  const paymentDetailsHtml = row.payments.length
    ? `<div class="membership-statement-row-details"><small>Pagamentos vinculados</small>${paymentDetails(row.payments)}</div>`
    : '';
  return `<article class="membership-statement-row is-${row.status.key}">
    <div class="membership-statement-row-main"><span class="membership-statement-month"><strong>${escapeHtml(treasury.monthLabel(row.month))}</strong><span class="membership-statement-status is-${row.status.key}">${escapeHtml(row.status.label)}</span></span><span class="membership-statement-values"><span><small>Mensalidade</small><b class="sensitive-money">${escapeHtml(money.format(row.expected))}</b></span><span><small>Recebido</small><b class="sensitive-money">${escapeHtml(money.format(row.paid))}</b></span><span><small>${balanceLabel}</small><b class="sensitive-money">${escapeHtml(money.format(balance))}</b></span></span></div>
    ${paymentDetailsHtml}
  </article>`;
}

export function createMembershipStatementManager(context) {
  const { state, treasury, modalBody, showModal, toast } = context;

  return (memberId, period = null) => {
    ensureStatementStyles();
    const member = state().birthdays.find(item => String(item?.id || '') === String(memberId || ''));
    if (!member) {
      toast('Associado não encontrado.');
      return;
    }

    const statement = buildMembershipStatement(state(), treasury, member, period);
    const group = treasury.familyGroupForMember(member.id);
    const netLabel = statement.net > EPSILON ? 'Saldo devedor' : statement.net < -EPSILON ? 'Saldo positivo' : 'Saldo líquido';
    const netAmount = Math.abs(statement.net);
    const openingNote = String(member.membershipOpeningDebtNotes || '').trim();

    const periodLabel = statement.months.length
      ? (statement.months.length === 1
        ? treasury.monthLabel(statement.months[0])
        : `${treasury.monthLabel(statement.months[0])} até ${treasury.monthLabel(statement.months.at(-1))}`)
      : 'Período sem competências';

    modalBody.innerHTML = `<section class="membership-statement" aria-labelledby="membershipStatementTitle">
      <header class="membership-statement-hero"><span class="membership-statement-hero-icon" aria-hidden="true">${uiIcon('receipt')}</span><div class="membership-statement-hero-copy"><small>Extrato de mensalidades</small><h3 id="membershipStatementTitle">${escapeHtml(member.name)}</h3><p>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número informado'}${group ? ` · ${escapeHtml(group.name)}` : ' · Sem grupo familiar'}</p></div><span class="membership-statement-period"><small>Período selecionado</small><strong>${escapeHtml(periodLabel)}</strong></span></header>
      <div class="membership-statement-kpis">
        <span><small>Mensalidade atual</small><strong class="sensitive-money">${escapeHtml(money.format(treasury.membershipExpectedAmountForMember(member.id)))}</strong></span>
        <span class="is-received"><small>Total recebido</small><strong class="sensitive-money">${escapeHtml(money.format(statement.totalReceived))}</strong></span>
        <span class="${statement.outstanding > EPSILON ? 'is-outstanding' : ''}"><small>Em aberto</small><strong class="sensitive-money">${escapeHtml(money.format(statement.outstanding))}</strong></span>
        <span class="${statement.credit > EPSILON ? 'is-credit' : ''}"><small>Saldo positivo</small><strong class="sensitive-money">${escapeHtml(money.format(statement.credit))}</strong></span>
        <span class="${statement.net > EPSILON ? 'is-debt' : statement.net < -EPSILON ? 'is-credit' : ''}"><small>${escapeHtml(netLabel)}</small><strong class="sensitive-money">${escapeHtml(money.format(netAmount))}</strong></span>
      </div>
      ${statement.openingOriginal > EPSILON ? `<section class="membership-statement-opening"><div class="membership-statement-opening-top"><div class="membership-statement-opening-summary"><small>Saldo anterior</small><strong class="sensitive-money">${escapeHtml(money.format(statement.openingOriginal))}</strong><p>${openingNote ? escapeHtml(openingNote) : 'Débito trazido do controle anterior.'}</p></div><div class="membership-statement-opening-metrics"><span><small>Já recebido</small><b class="sensitive-money">${escapeHtml(money.format(statement.openingPaid))}</b></span><span><small>Ainda em aberto</small><b class="sensitive-money">${escapeHtml(money.format(statement.openingOutstanding))}</b></span></div></div><div class="membership-statement-opening-payments"><small>Pagamentos do saldo anterior</small>${paymentDetails(statement.openingPayments)}</div></section>` : ''}
      <div class="membership-statement-heading"><div><strong>Competências</strong><small>${statement.months.length ? `${escapeHtml(treasury.monthLabel(statement.months[0]))} até ${escapeHtml(treasury.monthLabel(statement.months.at(-1)))}` : 'Nenhuma competência disponível'}</small></div><span>${statement.rows.length} mês(es)</span></div>
      <div class="membership-statement-list">${statement.rows.length ? statement.rows.map(row => monthRow(row, treasury)).join('') : '<div class="membership-statement-empty">Nenhuma competência encontrada.</div>'}</div>
      <footer class="membership-statement-footer"><span>${uiIcon('info')} As competências e os indicadores respeitam o período selecionado em Mensalidades; o saldo anterior permanece separado.</span><button class="btn btn-ghost" type="button" data-close-modal>Fechar</button></footer>
    </section>`;
    showModal('Extrato de mensalidades');
  };
}
