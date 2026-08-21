import { createTreasuryAdminContext } from './treasury-admin/context.js';
import { createMemberSelectorCard } from './treasury-admin/member-selector.js';
import { createFamilyGroupsManager } from './treasury-admin/family-groups.js';
import { createMembershipPaymentManager } from './treasury-admin/membership-payments.js';
import { createMembershipOpeningDebtManager } from './treasury-admin/membership-opening-debt.js';
import { createMutualGroupsManager } from './treasury-admin/mutual-groups.js';
import { createMutualEventManager } from './treasury-admin/mutual-events.js';
import { createMutualPaymentManager } from './treasury-admin/mutual-payments.js';
import { createMembershipChargeSharer } from './treasury-admin/sharing.js';
import { createTreasuryAccountsManager } from './treasury-admin/accounts.js';
import { createTreasuryEntryManager } from './treasury-admin/entries.js';

export function createTreasuryAdminController(dependencies) {
  const context = createTreasuryAdminContext(dependencies);
  const memberSelectorCard = createMemberSelectorCard(context);
  const openFamilyGroupsManager = createFamilyGroupsManager(context, memberSelectorCard);
  const openMembershipPayment = createMembershipPaymentManager(context, memberSelectorCard);
  const openMembershipOpeningDebt = createMembershipOpeningDebtManager(context);
  const openMutualGroupsManager = createMutualGroupsManager(context);
  const openMutualEventManager = createMutualEventManager(context);
  const openMutualPayment = createMutualPaymentManager(context);
  const shareMembershipCharge = createMembershipChargeSharer(context);
  const openTreasuryAccountsManager = createTreasuryAccountsManager(context);
  const { treasuryEntryFormHtml, openTreasuryEntryForm } = createTreasuryEntryManager(context);

  return {
    memberSelectorCard,
    openFamilyGroupsManager,
    openMembershipPayment,
    openMembershipOpeningDebt,
    openMutualGroupsManager,
    openMutualEventManager,
    openMutualPayment,
    openTreasuryAccountsManager,
    shareMembershipCharge,
    treasuryEntryFormHtml,
    openTreasuryEntryForm
  };
}
