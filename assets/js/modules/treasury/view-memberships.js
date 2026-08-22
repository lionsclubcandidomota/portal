import { normalize } from '../../utils.js';

function closeMembershipActionMenus(root, exceptMenu = null) {
  root.querySelectorAll('[data-membership-menu]').forEach(menu => {
    if (menu === exceptMenu) return;
    menu.hidden = true;
    menu.closest('.membership-member')?.classList.remove('is-actions-open');
    menu.closest('.membership-actions-menu')
      ?.querySelector('[data-membership-menu-toggle]')
      ?.setAttribute('aria-expanded', 'false');
  });
}

function bindMembershipMenuDismiss(root) {
  if (root.dataset.membershipMenuDismissBound) return;

  root.addEventListener('click', event => {
    if (event.target.closest('.membership-actions-menu')) return;
    closeMembershipActionMenus(root);
  });

  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const openMenu = [...root.querySelectorAll('[data-membership-menu]')]
      .find(menu => !menu.hidden);
    if (!openMenu) return;
    openMenu.hidden = true;
    openMenu.closest('.membership-member')?.classList.remove('is-actions-open');
    const toggle = openMenu.closest('.membership-actions-menu')
      ?.querySelector('[data-membership-menu-toggle]');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.focus();
  });

  root.dataset.membershipMenuDismissBound = 'true';
}

export function bindMembershipSection({ root, treasury, helpers, membershipModel, rerender }) {
  const {
    currentMembershipMonth,
    membershipStart,
    membershipEnd,
    membershipExpanded
  } = membershipModel;
  const {
    adminUnlocked,
    openFamilyGroupsManager,
    openMembershipPayment,
    openMembershipOpeningDebt,
    openMembershipStatement,
    shareMembershipCharge
  } = helpers;
  const membershipStartInput = root.querySelector('#membershipStart');
  const membershipEndInput = root.querySelector('#membershipEnd');

  const applyMembershipPeriod = changedField => {
    let start = membershipStartInput?.value || currentMembershipMonth;
    let end = membershipEndInput?.value || start;
    if (start > end) {
      if (changedField === 'start') {
        end = start;
        if (membershipEndInput) membershipEndInput.value = end;
      } else {
        start = end;
        if (membershipStartInput) membershipStartInput.value = start;
      }
    }
    treasury.membershipStart = start;
    treasury.membershipEnd = end;
    treasury.membershipMonth = start;
    rerender();
  };

  membershipStartInput?.addEventListener('change', () => applyMembershipPeriod('start'));
  membershipEndInput?.addEventListener('change', () => applyMembershipPeriod('end'));

  const membershipSearchInput = root.querySelector('#membershipSearch');
  const membershipFamilyInput = root.querySelector('#membershipFamilyFilter');
  const membershipStatusInput = root.querySelector('#membershipStatusFilter');
  const applyMembershipFilters = () => {
    const query = normalize(membershipSearchInput?.value || '');
    const family = membershipFamilyInput?.value || 'all';
    const status = membershipStatusInput?.value || 'all';
    treasury.membershipSearch = membershipSearchInput?.value || '';
    treasury.membershipFamily = family;
    treasury.membershipStatus = status;
    let visible = 0;

    root.querySelectorAll('#membershipMemberList .membership-member').forEach(card => {
      const matchesSearch = !query
        || String(card.dataset.membershipSearch || '').includes(query);
      const matchesFamily = family === 'all'
        || String(card.dataset.membershipFamily || 'none') === String(family);
      const matchesStatus = status === 'all'
        || card.dataset.membershipStatus === status;
      const show = matchesSearch && matchesFamily && matchesStatus;
      card.hidden = !show;
      card.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });

    const count = root.querySelector('#membershipVisibleCount');
    if (count) count.textContent = String(visible);
    const emptyState = root.querySelector('#membershipFilterEmpty');
    if (emptyState) emptyState.hidden = visible > 0;
  };

  membershipSearchInput?.addEventListener('input', applyMembershipFilters);
  membershipFamilyInput?.addEventListener('change', applyMembershipFilters);
  membershipStatusInput?.addEventListener('change', applyMembershipFilters);

  root.querySelector('#membershipControlToggle')?.addEventListener('click', () => {
    treasury.membershipExpanded = !membershipExpanded;
    rerender();
  });
  root.querySelector('#manageFamilyGroups')
    ?.addEventListener('click', openFamilyGroupsManager);

  if (adminUnlocked) {
    root.querySelectorAll('[data-membership-member]').forEach(button => {
      button.addEventListener('click', () => {
        openMembershipPayment(
          button.dataset.membershipMember,
          button.dataset.membershipReference || membershipStart
        );
      });
    });
  }

  root.querySelectorAll('[data-membership-menu-toggle]').forEach(toggle => {
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      const menu = toggle.closest('.membership-actions-menu')
        ?.querySelector('[data-membership-menu]');
      if (!menu) return;
      const opening = menu.hidden;
      closeMembershipActionMenus(root, opening ? menu : null);
      menu.hidden = !opening;
      toggle.closest('.membership-member')?.classList.toggle('is-actions-open', opening);
      toggle.setAttribute('aria-expanded', String(opening));
      if (opening) menu.querySelector('[role="menuitem"]')?.focus();
    });
  });

  bindMembershipMenuDismiss(root);

  root.querySelectorAll('[data-membership-charge]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const months = String(button.dataset.membershipMonths || '')
        .split(',')
        .filter(Boolean);
      const periodMonths = String(button.dataset.membershipPeriod || '')
        .split(',')
        .filter(Boolean);
      closeMembershipActionMenus(root);
      shareMembershipCharge(button.dataset.membershipCharge, months, periodMonths);
    });
  });

  root.querySelectorAll('[data-membership-statement]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      closeMembershipActionMenus(root);
      openMembershipStatement(button.dataset.membershipStatement, {
        start: membershipStart,
        end: membershipEnd
      });
    });
  });

  root.querySelectorAll('[data-membership-opening-debt]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      closeMembershipActionMenus(root);
      openMembershipOpeningDebt(button.dataset.membershipOpeningDebt);
    });
  });
}
