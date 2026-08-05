import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  PERIOD_LABELS,
  accountTypeIcon,
  addMonthsToReference,
  coveredMonths as getCoveredMonths,
  createStatusHelpers,
  currencyInputValue,
  filterItemsByPeriod,
  isMembershipEntry as checkMembershipEntry,
  isMutualEntry as checkMutualEntry,
  memberIds,
  memberCanJoinMutual,
  memberIsActive,
  memberIsInactive,
  memberIsMutual,
  memberStatusKey,
  memberStatusLabel,
  monthLabel,
  monthRange,
  mutualChargeKey,
  mutualEventDate as getMutualEventDate,
  mutualEventFor as getMutualEventFor,
  mutualEventMemberIds,
  mutualGroupIsActive,
  mutualMemberIdsForDate,
  mutualMemberIsIncluded,
  mutualReferenceMonth as getMutualReferenceMonth,
  normalizeDateReference,
  normalizeMonthReference,
  normalizeMutualGroup,
  normalizeTreasurySection,
  paginate,
  parseCurrencyInput,
  periodBounds as getPeriodBounds,
  referenceMonth as getReferenceMonth
} from './domain.js';

export function createTreasuryController({
  getState,
  parseLocalDate,
  normalize,
  todayStart,
  sumTreasury,
  initialSection = 'movements',
  onSectionChange = _section => {},
  pageSize = 8
}) {
  if (typeof getState !== 'function') {
    throw new TypeError('createTreasuryController requer getState().');
  }

  let section = normalizeTreasurySection(initialSection);
  let period = 'all';
  let customStart = '';
  let customEnd = '';
  let scheduledPage = 1;
  let completedPage = 1;
  let membershipMonth = '';
  let membershipStart = '';
  let membershipEnd = '';
  let membershipExpanded = true;
  let membershipSearch = '';
  let membershipFamily = 'all';
  let membershipStatus = 'all';
  let mutualExpanded = true;
  let mutualSearch = '';
  let mutualGroup = 'all';
  let mutualStart = '';
  let mutualEnd = '';
  let mutualStatus = 'pending';
  const mutualSelectedCharges = new Set();
  const expandedMutualGroups = new Set();
  let chartToken = null;
  const collapsedCharts = new Set(['finance', 'cash-flow', 'category', 'account']);

  const state = () => getState();
  const isMembershipEntry = item => checkMembershipEntry(item, normalize);
  const isMutualEntry = item => checkMutualEntry(item, normalize);
  const referenceMonth = item => getReferenceMonth(item, parseLocalDate);
  const coveredMonths = item => getCoveredMonths(item, parseLocalDate);
  const currentMonth = () => {
    const date = todayStart();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const mutualEventDate = item => getMutualEventDate(item, parseLocalDate);
  const mutualReferenceMonth = item => getMutualReferenceMonth(item, parseLocalDate);
  const status = createStatusHelpers({ parseDate: parseLocalDate, todayStart });

  const accounts = () => {
    const current = state();
    if (!Array.isArray(current.treasuryAccounts)) current.treasuryAccounts = [];
    if (!current.treasuryAccounts.length) {
      current.treasuryAccounts = DEFAULT_ACCOUNTS.map(account => ({ ...account }));
    }
    return current.treasuryAccounts;
  };

  const categories = () => {
    const current = state();
    if (!Array.isArray(current.treasuryCategories)) {
      current.treasuryCategories = [...DEFAULT_CATEGORIES];
    }

    const usedCategories = (current.treasury || [])
      .filter(item => !isMembershipEntry(item) && !isMutualEntry(item))
      .map(item => String(item?.category || '').trim())
      .filter(Boolean);

    usedCategories.forEach(category => {
      if (!current.treasuryCategories.some(item => normalize(item) === normalize(category))) {
        current.treasuryCategories.push(category);
      }
    });

    return [...new Set(current.treasuryCategories)]
      .sort((first, second) => first.localeCompare(second, 'pt-BR'));
  };

  const accountFor = item => {
    const availableAccounts = accounts();
    return availableAccounts.find(account => account.id === item?.accountId) || availableAccounts[0];
  };

  const membersFor = item => memberIds(item)
    .map(id => state().birthdays.find(member => member.id === id))
    .filter(Boolean);

  const memberFor = item => membersFor(item)[0] || null;

  const membershipAllocationFor = (item, memberId) => {
    const allocations = Array.isArray(item?.memberAllocations) ? item.memberAllocations : [];
    const stored = allocations.find(allocation => allocation?.memberId === memberId);
    if (stored && Number.isFinite(Number(stored.amount))) return Number(stored.amount);

    const ids = memberIds(item);
    return ids.includes(memberId)
      ? Number(item?.entry || 0) / Math.max(1, ids.length)
      : 0;
  };

  const membershipFee = () => Math.max(0, Number(state().settings.membershipMonthlyFee || 0));
  const membershipFamilyPrimaryFee = () => Math.max(0, Number(state().settings.membershipFamilyPrimaryFee || 0));
  const membershipFamilyAdditionalFee = () => Math.max(0, Number(state().settings.membershipFamilyAdditionalFee || 0));

  const familyGroups = () => {
    const current = state();
    if (!Array.isArray(current.familyGroups)) current.familyGroups = [];
    return current.familyGroups;
  };

  const familyGroupForMember = memberId => familyGroups()
    .find(group => Array.isArray(group.memberIds) && group.memberIds.includes(memberId)) || null;

  const todayReference = () => {
    const date = todayStart();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const mutualGroups = () => {
    const current = state();
    if (!Array.isArray(current.mutualGroups)) current.mutualGroups = [];
    current.mutualGroups = current.mutualGroups.map(group => normalizeMutualGroup(group, todayReference()));
    return current.mutualGroups;
  };

  const mutualGroupFor = groupId => mutualGroups()
    .find(item => String(item?.id) === String(groupId || '')) || null;

  const mutualEventsForGroup = groupId => {
    const group = mutualGroupFor(groupId);
    return group ? [...group.events] : [];
  };

  const mutualEventFor = (groupId, eventId) => {
    const group = mutualGroupFor(groupId);
    return group ? getMutualEventFor(group, eventId) : null;
  };

  const mutualChargeFor = (groupId, eventId, memberId) => {
    const group = mutualGroupFor(groupId);
    const event = group ? getMutualEventFor(group, eventId) : null;
    const normalizedMemberId = String(memberId || '');
    if (!group || !event || !mutualEventMemberIds(event).includes(normalizedMemberId)) return null;
    const amount = Math.max(0, Number(event.amountPerParticipant || 0));
    if (!(amount > 0)) return null;
    return {
      group,
      event,
      memberId: normalizedMemberId,
      amount,
      key: mutualChargeKey(group.id, event.id, normalizedMemberId)
    };
  };

  const mutualMembersForDate = (groupId, date) => {
    const group = mutualGroupFor(groupId);
    if (!group) return [];
    const ids = mutualMemberIdsForDate(group, date);
    return ids
      .map(id => state().birthdays.find(member => String(member.id) === String(id)))
      .filter(Boolean);
  };

  const mutualMembersForEvent = (groupId, eventId) => {
    const event = mutualEventFor(groupId, eventId);
    if (!event) return [];
    return mutualEventMemberIds(event)
      .map(id => state().birthdays.find(member => String(member.id) === String(id)))
      .filter(Boolean);
  };

  const mutualPaymentsFor = (groupId, eventId, memberId = '') => state().treasury.filter(item => (
    isMutualEntry(item)
    && !status.isProgrammed(item)
    && String(item.mutualGroupId || '') === String(groupId || '')
    && String(item.mutualEventId || '') === String(eventId || '')
    && (!memberId || String(item.mutualMemberId || item.memberId || '') === String(memberId || ''))
  ));

  const mutualIsPaid = (groupId, eventId, memberId) => mutualPaymentsFor(groupId, eventId, memberId).length > 0;

  const mutualPaymentConflicts = keys => (keys || []).flatMap(key => {
    const [groupId, eventId, memberId] = String(key || '').split('::');
    return mutualIsPaid(groupId, eventId, memberId) ? [{ key, groupId, eventId, memberId }] : [];
  });

  const toggleMutualSelection = (key, selected) => {
    const normalizedKey = String(key || '');
    if (!normalizedKey) return mutualSelectedCharges.size;
    if (selected) mutualSelectedCharges.add(normalizedKey);
    else mutualSelectedCharges.delete(normalizedKey);
    return mutualSelectedCharges.size;
  };

  const clearMutualSelection = () => mutualSelectedCharges.clear();

  const isMutualGroupExpanded = groupId => expandedMutualGroups.has(String(groupId || ''));
  const setMutualGroupExpanded = (groupId, expanded) => {
    const key = String(groupId || '');
    if (!key) return false;
    if (expanded) expandedMutualGroups.add(key);
    else expandedMutualGroups.delete(key);
    return expandedMutualGroups.has(key);
  };
  const toggleMutualGroup = groupId => setMutualGroupExpanded(groupId, !isMutualGroupExpanded(groupId));
  const collapseMutualGroups = () => expandedMutualGroups.clear();

  const paymentsFor = (memberId, month) => state().treasury.filter(item =>
    isMembershipEntry(item)
    && !status.isProgrammed(item)
    && memberIds(item).includes(memberId)
    && coveredMonths(item).includes(month)
  );

  const monthIsPaid = (memberId, month) => paymentsFor(memberId, month).length > 0;
  const paidMonthsFor = (memberId, months) => (months || []).filter(month => monthIsPaid(memberId, month));
  const pendingMonthsFor = (memberId, months) => (months || []).filter(month => !monthIsPaid(memberId, month));

  const membershipExpectedAmountForMember = memberId => {
    const group = familyGroupForMember(memberId);
    if (!group) return membershipFee();
    return group.primaryMemberId === memberId
      ? membershipFamilyPrimaryFee()
      : membershipFamilyAdditionalFee();
  };

  const paymentConflicts = (ids, months) => {
    const conflicts = [];
    for (const memberId of ids) {
      for (const month of months) {
        if (monthIsPaid(memberId, month)) conflicts.push({ memberId, month });
      }
    }
    return conflicts;
  };

  const accountSummaries = (items = state().treasury) => accounts().map(account => {
    const primaryAccountId = accounts()[0]?.id;
    const accountItems = (items || []).filter(item => (item.accountId || primaryAccountId) === account.id);
    const totals = sumTreasury(accountItems);
    const initialBalance = Number(account.initialBalance || 0);

    return {
      ...account,
      initialBalance,
      entries: totals.entries,
      exits: totals.exits,
      balance: initialBalance + totals.balance,
      programmedEntries: totals.programmedEntries,
      programmedExits: totals.programmedExits,
      projectedBalance: initialBalance + totals.projectedBalance,
      count: accountItems.length
    };
  });

  const pagination = (items, page, key) => paginate(items, page, key, pageSize);

  const periodBounds = (selectedPeriod = period) => getPeriodBounds({
    selectedPeriod,
    customStart,
    customEnd,
    parseDate: parseLocalDate,
    todayStart
  });

  const itemsForPeriod = () => filterItemsByPeriod(state().treasury, periodBounds(), parseLocalDate);
  const periodLabel = () => PERIOD_LABELS[period] || PERIOD_LABELS.all;
  const isChartCollapsed = chartId => collapsedCharts.has(String(chartId || ''));
  const toggleChart = chartId => {
    const key = String(chartId || '');
    if (!key) return false;
    if (collapsedCharts.has(key)) collapsedCharts.delete(key);
    else collapsedCharts.add(key);
    return collapsedCharts.has(key);
  };
  const expandAllCharts = () => collapsedCharts.clear();
  const collapseAllCharts = chartIds => {
    collapsedCharts.clear();
    (chartIds || []).forEach(chartId => collapsedCharts.add(String(chartId)));
  };
  const reset = () => {
    section = 'movements';
    onSectionChange(section);
    period = 'all';
    customStart = '';
    customEnd = '';
    scheduledPage = 1;
    completedPage = 1;
    membershipMonth = '';
    membershipStart = '';
    membershipEnd = '';
    membershipExpanded = true;
    membershipSearch = '';
    membershipFamily = 'all';
    membershipStatus = 'all';
    mutualExpanded = true;
    mutualSearch = '';
    mutualGroup = 'all';
    mutualStart = '';
    mutualEnd = '';
    mutualStatus = 'pending';
    mutualSelectedCharges.clear();
    expandedMutualGroups.clear();
    chartToken = null;
    collapsedCharts.clear();
    ['finance', 'cash-flow', 'category', 'account'].forEach(chartId => collapsedCharts.add(chartId));
  };

  return {
    get section() { return section; },
    set section(value) {
      section = normalizeTreasurySection(value);
      onSectionChange(section);
    },
    get period() { return period; },
    set period(value) { period = value; },
    get customStart() { return customStart; },
    set customStart(value) { customStart = String(value || ''); },
    get customEnd() { return customEnd; },
    set customEnd(value) { customEnd = String(value || ''); },
    get scheduledPage() { return scheduledPage; },
    set scheduledPage(value) { scheduledPage = Number(value) || 1; },
    get completedPage() { return completedPage; },
    set completedPage(value) { completedPage = Number(value) || 1; },
    get membershipMonth() { return membershipMonth; },
    set membershipMonth(value) { membershipMonth = String(value || ''); },
    get membershipStart() { return membershipStart; },
    set membershipStart(value) { membershipStart = String(value || ''); },
    get membershipEnd() { return membershipEnd; },
    set membershipEnd(value) { membershipEnd = String(value || ''); },
    get membershipExpanded() { return membershipExpanded; },
    set membershipExpanded(value) { membershipExpanded = value !== false; },
    get membershipSearch() { return membershipSearch; },
    set membershipSearch(value) { membershipSearch = String(value || ''); },
    get membershipFamily() { return membershipFamily; },
    set membershipFamily(value) { membershipFamily = String(value || 'all'); },
    get membershipStatus() { return membershipStatus; },
    set membershipStatus(value) { membershipStatus = String(value || 'all'); },
    get mutualExpanded() { return mutualExpanded; },
    set mutualExpanded(value) { mutualExpanded = value !== false; },
    get mutualSearch() { return mutualSearch; },
    set mutualSearch(value) { mutualSearch = String(value || ''); },
    get mutualGroup() { return mutualGroup; },
    set mutualGroup(value) {
      mutualGroup = String(value || 'all');
      if (mutualGroup === 'all') expandedMutualGroups.clear();
    },
    get mutualStart() { return mutualStart; },
    set mutualStart(value) {
      mutualStart = normalizeDateReference(value);
      if (mutualEnd && mutualStart && mutualEnd < mutualStart) mutualEnd = mutualStart;
    },
    get mutualEnd() { return mutualEnd; },
    set mutualEnd(value) {
      const normalized = normalizeDateReference(value);
      mutualEnd = normalized && mutualStart && normalized < mutualStart ? mutualStart : normalized;
    },
    get mutualMonth() { return mutualStart ? mutualStart.slice(0, 7) : ''; },
    set mutualMonth(value) {
      const normalized = normalizeMonthReference(value);
      mutualStart = normalized ? `${normalized}-01` : '';
      mutualEnd = normalized ? `${normalized}-31` : '';
    },
    get mutualStatus() { return mutualStatus; },
    set mutualStatus(value) { mutualStatus = String(value || 'pending'); },
    get mutualSelectedCharges() { return new Set(mutualSelectedCharges); },
    get chartToken() { return chartToken; },
    set chartToken(value) { chartToken = value; },
    get collapsedChartCount() { return collapsedCharts.size; },
    isChartCollapsed,
    toggleChart,
    expandAllCharts,
    collapseAllCharts,
    reset,
    accounts,
    categories,
    accountFor,
    membersFor,
    memberFor,
    membershipAllocationFor,
    referenceMonth,
    monthLabel,
    isMembershipEntry,
    isMutualEntry,
    membershipFee,
    membershipFamilyPrimaryFee,
    membershipFamilyAdditionalFee,
    familyGroups,
    familyGroupForMember,
    currentMonth,
    mutualGroups,
    mutualGroupFor,
    mutualChargeFor,
    mutualEventsForGroup,
    mutualEventFor,
    mutualMembersForDate,
    mutualMembersForEvent,
    mutualGroupIsActive,
    mutualMemberIsIncluded,
    mutualEventDate,
    mutualReferenceMonth,
    mutualChargeKey,
    mutualPaymentsFor,
    mutualIsPaid,
    mutualPaymentConflicts,
    toggleMutualSelection,
    clearMutualSelection,
    isMutualGroupExpanded,
    setMutualGroupExpanded,
    toggleMutualGroup,
    collapseMutualGroups,
    parseCurrencyInput,
    currencyInputValue,
    coveredMonths,
    addMonthsToReference,
    monthRange,
    memberIds,
    memberCanJoinMutual,
    memberIsActive,
    memberIsInactive,
    memberIsMutual,
    memberStatusKey,
    memberStatusLabel,
    paymentsFor,
    monthIsPaid,
    paidMonthsFor,
    pendingMonthsFor,
    membershipExpectedAmountForMember,
    paymentConflicts,
    accountSummaries,
    accountTypeIcon,
    statusKey: status.statusKey,
    isOverdue: status.isOverdue,
    isProgrammed: status.isProgrammed,
    statusLabel: status.statusLabel,
    statusClass: status.statusClass,
    pagination,
    periodBounds,
    itemsForPeriod,
    periodLabel
  };
}
