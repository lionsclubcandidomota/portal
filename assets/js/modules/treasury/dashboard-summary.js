import { memberIsActive } from '../../core/portal-members.js?v=6.46.7';
import { normalize, parseLocalDate, sumTreasury } from '../../utils.js';
import { todayStart } from '../timeline.js?v=6.46.7';
import {
  DEFAULT_ACCOUNTS,
  coveredMonths,
  createStatusHelpers,
  isMembershipEntry,
  isMutualEntry,
  membershipAllocationForMonth,
  monthLabel,
  mutualActiveMemberIds,
  mutualEventMemberIds,
  normalizeMutualGroup
} from './domain.js?v=6.46.7';
import {
  financialTreasuryItems,
  uniqueTreasuryMovementCount
} from './movement-domain.js?v=6.46.7';

function accountSummaries(state) {
  const storedAccounts = Array.isArray(state?.treasuryAccounts) ? state.treasuryAccounts : [];
  const accounts = storedAccounts.length
    ? storedAccounts
    : DEFAULT_ACCOUNTS.map(account => ({ ...account }));
  const movements = Array.isArray(state?.treasury) ? state.treasury : [];
  const primaryAccountId = accounts[0]?.id;

  return accounts.map(account => {
    const items = movements.filter(item => (item.accountId || primaryAccountId) === account.id);
    const totals = sumTreasury(items);
    const initialBalance = Number(account.initialBalance || 0);
    return {
      ...account,
      balance: initialBalance + totals.balance,
      projectedBalance: initialBalance + totals.projectedBalance
    };
  });
}

export function buildTreasuryDashboardSummary(state) {
  const movements = Array.isArray(state?.treasury) ? state.treasury : [];
  const members = Array.isArray(state?.birthdays) ? state.birthdays : [];
  const status = createStatusHelpers({ parseDate: parseLocalDate, todayStart });
  const now = todayStart();
  const currentMembershipMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const activeMembers = members.filter(memberIsActive);
  const membershipEntries = movements.filter(item => (
    isMembershipEntry(item, normalize)
    && !status.isProgrammed(item)
    && coveredMonths(item, parseLocalDate).includes(currentMembershipMonth)
  ));
  const familyGroups = Array.isArray(state?.familyGroups) ? state.familyGroups : [];
  const expectedMembershipFor = memberId => {
    const group = familyGroups.find(item => Array.isArray(item?.memberIds) && item.memberIds.includes(memberId));
    if (!group) return Math.max(0, Number(state?.settings?.membershipMonthlyFee || 0));
    return String(group.primaryMemberId || '') === String(memberId || '')
      ? Math.max(0, Number(state?.settings?.membershipFamilyPrimaryFee || 0))
      : Math.max(0, Number(state?.settings?.membershipFamilyAdditionalFee || 0));
  };
  const membershipPaidByMember = new Map(activeMembers.map(member => [
    member.id,
    membershipEntries.reduce((sum, item) => sum + membershipAllocationForMonth(item, member.id, currentMembershipMonth, parseLocalDate), 0)
  ]));
  const membershipPaidIds = new Set(activeMembers
    .filter(member => (membershipPaidByMember.get(member.id) || 0) + 0.005 >= expectedMembershipFor(member.id))
    .map(member => member.id));

  const normalizedGroups = (Array.isArray(state?.mutualGroups) ? state.mutualGroups : [])
    .map(group => normalizeMutualGroup(group, currentMembershipMonth));
  const mutualEvents = normalizedGroups.flatMap(group => (
    group.events || []
  ).map(event => ({ group, event })));

  const mutualCharges = mutualEvents.flatMap(({ group, event }) => (
    mutualEventMemberIds(group, event)
      .map(id => members.find(member => String(member.id) === String(id)))
      .filter(Boolean)
      .map(member => {
        const payments = movements.filter(item => (
          isMutualEntry(item, normalize)
          && !status.isProgrammed(item)
          && String(item.mutualGroupId || '') === String(group.id || '')
          && String(item.mutualMemberId || item.memberId || '') === String(member.id || '')
          && String(item.mutualEventId || '') === String(event.id || '')
        ));
        const payment = [...payments]
          .sort((first, second) => String(second.paymentDate || second.date || '')
            .localeCompare(String(first.paymentDate || first.date || '')))[0] || null;
        return {
          expected: Number(event.amount || 0),
          payment
        };
      })
  ));
  const mutualPaidCharges = mutualCharges.filter(charge => charge.payment);
  const finance = sumTreasury(financialTreasuryItems(movements));
  finance.realizedCount = uniqueTreasuryMovementCount(movements.filter(item => !status.isProgrammed(item)));
  finance.programmedCount = uniqueTreasuryMovementCount(movements.filter(item => status.isProgrammed(item)));

  return Object.freeze({
    finance,
    currentMembershipMonth,
    currentMembershipLabel: monthLabel(currentMembershipMonth),
    activeMembersCount: activeMembers.length,
    membershipPaidCount: membershipPaidIds.size,
    membershipTotal: [...membershipPaidByMember.values()].reduce((total, amount) => total + Number(amount || 0), 0),
    mutualEventCount: mutualEvents.length,
    mutualPaidCount: mutualPaidCharges.length,
    mutualChargeCount: mutualCharges.length,
    mutualExpectedTotal: mutualCharges.reduce((total, charge) => total + charge.expected, 0),
    mutualReceivedTotal: mutualPaidCharges.reduce(
      (total, charge) => total + Number(charge.payment?.entry || charge.expected || 0),
      0
    ),
    mutualActiveGroupCount: normalizedGroups.filter(group => mutualActiveMemberIds(group).length > 0).length,
    overdueMovementCount: uniqueTreasuryMovementCount(movements.filter(item => status.isOverdue(item))),
    activeAccountCount: accountSummaries(state).filter(account => account.active !== false).length
  });
}
