import { money, normalize } from '../../utils.js';

function selectedMutualItems(root) {
  return [...root.querySelectorAll('.mutual-charge-checkbox:checked')]
    .map(input => input.value);
}

function updateMutualSelectionUi(root, treasury) {
  const selectedKeys = selectedMutualItems(root);
  const selectedSet = new Set(selectedKeys);
  let total = 0;

  root.querySelectorAll('[data-mutual-key]').forEach(card => {
    const selected = selectedSet.has(card.dataset.mutualKey);
    card.classList.toggle('is-selected', selected);
    if (selected) total += Number(card.dataset.mutualAmount || 0);
  });
  root.querySelectorAll('.mutual-charge-checkbox').forEach(input => {
    treasury.toggleMutualSelection(input.value, input.checked);
  });

  const count = root.querySelector('#mutualSelectedCount');
  const totalNode = root.querySelector('#mutualSelectedTotal');
  const paymentButton = root.querySelector('#mutualPaymentButton');
  const clearButton = root.querySelector('#mutualClearSelection');
  const bar = root.querySelector('#mutualSelectionBar');
  if (count) count.textContent = String(selectedKeys.length);
  if (totalNode) totalNode.textContent = money.format(total);
  if (paymentButton) paymentButton.disabled = selectedKeys.length === 0;
  if (clearButton) clearButton.disabled = selectedKeys.length === 0;
  bar?.classList.toggle('has-selection', selectedKeys.length > 0);
}

function applyMutualFilters(root, treasury, controls) {
  const query = normalize(controls.search?.value || '');
  const status = controls.status?.value || 'pending';
  treasury.mutualSearch = controls.search?.value || '';
  treasury.mutualStatus = status;
  let visible = 0;

  root.querySelectorAll('#mutualChargeList .mutual-charge-card').forEach(card => {
    const matchesSearch = !query || String(card.dataset.mutualSearch || '').includes(query);
    const matchesStatus = status === 'all' || card.dataset.mutualStatus === status;
    const show = matchesSearch && matchesStatus;
    card.hidden = !show;
    if (show) visible += 1;
  });

  root.querySelectorAll('[data-mutual-event-section]').forEach(section => {
    const monthVisible = [...section.querySelectorAll('.mutual-charge-card')]
      .filter(card => !card.hidden).length;
    const emptyState = section.querySelector('.mutual-event-empty');
    if (emptyState) {
      emptyState.hidden = monthVisible > 0 || !section.querySelector('.mutual-charge-card');
    }
  });

  root.querySelectorAll('[data-mutual-group-section]').forEach(section => {
    const groupVisible = [...section.querySelectorAll('.mutual-charge-card')]
      .filter(card => !card.hidden).length;
    const count = section.querySelector('.mutual-group-period-summary strong');
    if (count) count.textContent = String(groupVisible);
    const emptyState = section.querySelector('.mutual-group-empty');
    if (emptyState) {
      emptyState.hidden = groupVisible > 0 || !section.querySelector('.mutual-charge-card');
    }
    section.classList.toggle('has-no-filter-results', groupVisible === 0);
  });

  const count = root.querySelector('#mutualVisibleCount');
  if (count) count.textContent = String(visible);
  const emptyState = root.querySelector('#mutualFilterEmpty');
  if (emptyState) emptyState.hidden = visible > 0 || !root.querySelector('.mutual-charge-card');
  const selectVisible = root.querySelector('#mutualSelectVisible');
  if (selectVisible) {
    selectVisible.disabled = ![...root.querySelectorAll('.mutual-charge-card:not([hidden]) .mutual-charge-checkbox')].length;
  }
}

export function bindMutualSection({ root, treasury, helpers, mutualModel, rerender }) {
  const {
    openMutualGroupsManager,
    openMutualEvent,
    openMutualPayment,
    toast
  } = helpers;
  const controls = {
    search: root.querySelector('#mutualSearch'),
    group: root.querySelector('#mutualGroupFilter'),
    start: root.querySelector('#mutualStartFilter'),
    end: root.querySelector('#mutualEndFilter'),
    status: root.querySelector('#mutualStatusFilter')
  };

  controls.search?.addEventListener('input', () => applyMutualFilters(root, treasury, controls));
  controls.status?.addEventListener('change', () => applyMutualFilters(root, treasury, controls));
  controls.group?.addEventListener('change', () => {
    treasury.mutualGroup = controls.group.value;
    treasury.collapseMutualGroups();
    treasury.clearMutualSelection();
    rerender();
  });
  controls.start?.addEventListener('change', () => {
    treasury.mutualStart = controls.start.value;
    treasury.mutualEnd = controls.end?.value || controls.start.value;
    treasury.collapseMutualGroups();
    treasury.clearMutualSelection();
    rerender();
  });
  controls.end?.addEventListener('change', () => {
    treasury.mutualEnd = controls.end.value;
    treasury.collapseMutualGroups();
    treasury.clearMutualSelection();
    rerender();
  });

  root.querySelector('#mutualControlToggle')?.addEventListener('click', () => {
    treasury.mutualExpanded = !mutualModel.expanded;
    rerender();
  });
  root.querySelector('#manageMutualGroups')
    ?.addEventListener('click', openMutualGroupsManager);
  root.querySelector('#createMutualEvent')
    ?.addEventListener('click', () => openMutualEvent(treasury.mutualGroup === 'all' ? '' : treasury.mutualGroup));

  root.querySelectorAll('[data-mutual-group-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const groupId = button.dataset.mutualGroupToggle;
      const section = button.closest('[data-mutual-group-section]');
      const content = section?.querySelector('.mutual-group-accordion-content');
      const opening = button.getAttribute('aria-expanded') !== 'true';
      treasury.setMutualGroupExpanded(groupId, opening);
      button.setAttribute('aria-expanded', String(opening));
      section?.classList.toggle('is-expanded', opening);
      section?.classList.toggle('is-collapsed', !opening);
      if (content) content.hidden = !opening;
    });
  });

  root.querySelectorAll('.mutual-charge-checkbox').forEach(input => {
    input.addEventListener('change', () => updateMutualSelectionUi(root, treasury));
  });
  root.querySelector('#mutualSelectVisible')?.addEventListener('click', () => {
    root.querySelectorAll('#mutualChargeList .mutual-charge-card:not([hidden]) .mutual-charge-checkbox')
      .forEach(input => { input.checked = true; });
    updateMutualSelectionUi(root, treasury);
  });
  root.querySelector('#mutualClearSelection')?.addEventListener('click', () => {
    root.querySelectorAll('.mutual-charge-checkbox').forEach(input => { input.checked = false; });
    treasury.clearMutualSelection();
    updateMutualSelectionUi(root, treasury);
  });
  root.querySelector('#mutualPaymentButton')?.addEventListener('click', () => {
    const selected = selectedMutualItems(root);
    if (!selected.length) {
      toast('Selecione ao menos uma cobrança de mútua em aberto.');
      return;
    }
    openMutualPayment(selected);
  });

  applyMutualFilters(root, treasury, controls);
}
