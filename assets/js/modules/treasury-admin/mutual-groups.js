import { escapeHtml, normalize, uid } from '../../utils.js';

function activeMemberships(group) {
  return (Array.isArray(group?.memberships) ? group.memberships : [])
    .filter(membership => !membership.endedMonth);
}

function uniqueMemberIds(memberships) {
  return [...new Set((memberships || []).map(item => String(item.memberId || '')).filter(Boolean))];
}

export function createMutualGroupsManager(context) {
  const {
    state,
    treasury,
    modalBody,
    showModal,
    confirmation,
    persist,
    toast,
    avatar,
    empty
  } = context;

  const openMutualGroupsManager = (editGroupId = '') => {
    const currentState = state();
    const groups = treasury.mutualGroups();
    const editingGroup = groups.find(group => group.id === editGroupId) || null;
    const currentMonth = treasury.currentMonth();
    const activeIds = new Set(uniqueMemberIds(activeMemberships(editingGroup)));
    const availableMembers = [...currentState.birthdays]
      .filter(member => treasury.memberCanJoinMutual(member) || activeIds.has(String(member.id)))
      .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));

    const groupSummary = group => {
      const currentIds = uniqueMemberIds(activeMemberships(group));
      const historicalIds = uniqueMemberIds(group.memberships);
      const paymentCount = historicalIds.reduce(
        (sum, memberId) => sum + treasury.mutualPaymentsFor(group.id, memberId).length,
        0
      );
      return {
        currentIds,
        paymentCount,
        eventCount: Array.isArray(group.events) ? group.events.length : 0
      };
    };

    const existingListExpanded = Boolean(editingGroup);
    const existingListId = 'mutualExistingGroupsList';

    modalBody.innerHTML = `<div class="family-manager family-manager-v2 mutual-group-manager">
      <section class="family-existing-section mutual-existing-groups management-collapsible-section ${existingListExpanded ? 'is-expanded' : 'is-collapsed'}">
        <button class="family-section-heading management-list-toggle" type="button" data-mutual-list-toggle aria-expanded="${existingListExpanded}" aria-controls="${existingListId}"><div><strong>Grupos de mútuas cadastrados</strong><small>${existingListExpanded ? 'Lista aberta para edição.' : 'Recolhida para deixar o cadastro de participantes em destaque.'}</small></div><span class="management-list-toggle-meta"><span class="family-count-badge">${groups.length}</span><span class="management-list-chevron" aria-hidden="true"></span></span></button>
        <div class="management-list-content" id="${existingListId}" ${existingListExpanded ? '' : 'hidden'}><div class="family-group-list">${groups.length ? groups.map(group => {
          const summary = groupSummary(group);
          const members = summary.currentIds
            .map(memberId => currentState.birthdays.find(member => String(member.id) === memberId))
            .filter(Boolean);
          return `<article class="family-group-row family-group-row-v2 mutual-group-row ${editingGroup?.id === group.id ? 'is-editing' : ''}">
            <div class="family-group-main"><span class="family-group-icon">🤲</span><div><strong>${escapeHtml(group.name)}</strong><small>${summary.currentIds.length} participante(s) ativo(s) · ${summary.eventCount} falecimento(s) registrado(s) · ${summary.paymentCount} pagamento(s)</small><p class="family-group-notes">Sem cobrança periódica automática.</p>${group.notes ? `<p class="family-group-notes">${escapeHtml(group.notes)}</p>` : ''}<div class="family-group-avatars">${members.slice(0, 5).map(member => avatar(member)).join('')}${members.length > 5 ? `<span class="family-avatar-more">+${members.length - 5}</span>` : ''}</div></div></div>
            <div class="family-group-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit-mutual-group="${escapeHtml(group.id)}">Editar</button><button class="btn btn-danger-soft btn-sm" type="button" data-remove-mutual-group="${escapeHtml(group.id)}">Excluir</button></div>
          </article>`;
        }).join('') : empty('🤲', 'Nenhum grupo de mútua cadastrado.')}</div></div>
      </section>
      <form id="mutualGroupForm" class="admin-entity-form family-group-form-v2 mutual-group-form">
        <input type="hidden" name="groupId" value="${escapeHtml(editingGroup?.id || '')}">
        <section class="admin-form-section"><div class="admin-form-section-heading"><span>${editingGroup ? '✏️' : '➕'}</span><div><h3>${editingGroup ? 'Editar grupo de mútua' : 'Novo grupo de mútua'}</h3><p>Defina quem participará das próximas cobranças eventuais por falecimento.</p></div></div>
          <div class="form-grid admin-form-section-grid">
            <div class="form-field full-row"><label for="mutualGroupName">Nome do grupo *</label><input id="mutualGroupName" name="name" required placeholder="Ex.: Mútua 658" value="${escapeHtml(editingGroup?.name || '')}"></div>
            <div class="form-field full-row mutual-member-picker"><label>Participantes da mútua *</label>
              <div class="member-picker-toolbar mutual-member-picker-toolbar"><div class="search-box compact"><span>⌕</span><input id="mutualMemberSearch" type="search" placeholder="Filtrar por nome ou número" autocomplete="off"></div><span id="mutualSelectedCount" class="selected-count" aria-live="polite">0 selecionado(s)</span></div>
              <div class="mutual-member-options" id="mutualMemberOptions">${availableMembers.map(member => {
                const checked = activeIds.has(String(member.id));
                const unavailable = !treasury.memberCanJoinMutual(member);
                const mutualMember = treasury.memberIsMutual(member);
                const inputId = `mutual-member-${String(member.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                return `<article class="mutual-member-option ${checked ? 'is-selected' : ''} ${unavailable ? 'is-inactive' : ''}" data-member-search="${escapeHtml(normalize(`${member.name || ''} ${member.memberNumber || ''} ${mutualMember ? 'mutuario mutua' : 'associado'}`))}">
                  <input class="mutual-member-option-input" id="${escapeHtml(inputId)}" type="checkbox" name="memberIds" value="${escapeHtml(member.id)}" ${checked ? 'checked' : ''} ${unavailable && !checked ? 'disabled' : ''}>
                  <label for="${escapeHtml(inputId)}" class="mutual-member-option-label">${avatar(member)}<span class="member-selector-copy"><strong>${escapeHtml(member.name)}</strong><small>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número informado'}</small>${mutualMember ? '<span class="membership-family-chip">Mútua · Mutuário</span>' : ''}${unavailable ? '<span class="member-unavailable-note">Cadastro inativo</span>' : ''}</span><span class="member-selector-check" aria-hidden="true">✓</span></label>
                </article>`;
              }).join('')}</div>
              <div id="mutualMemberEmpty" class="member-picker-empty" hidden>Nenhum participante encontrado.</div>
              <small>Alterações no grupo valem apenas para falecimentos registrados depois da mudança. Ocorrências anteriores preservam a lista original de participantes.</small>
            </div>
            <div class="form-field full-row"><label for="mutualGroupNotes">Observações do grupo</label><textarea id="mutualGroupNotes" name="notes" rows="3" placeholder="Informações sobre o grupo ou orientações internas">${escapeHtml(editingGroup?.notes || '')}</textarea></div>
          </div>
        </section>
        <div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Fechar</button>${editingGroup ? '<button type="button" class="btn btn-ghost" id="cancelMutualEdit">Cancelar edição</button>' : ''}<button class="btn btn-primary" type="submit">${editingGroup ? 'Salvar alterações' : 'Criar grupo'}</button></div>
      </form>
    </div>`;
    showModal('Grupos de mútuas');

    const form = document.getElementById('mutualGroupForm');
    const search = document.getElementById('mutualMemberSearch');
    const selectedCount = document.getElementById('mutualSelectedCount');
    const memberEmpty = document.getElementById('mutualMemberEmpty');
    const existingListToggle = modalBody.querySelector('[data-mutual-list-toggle]');
    const existingListContent = document.getElementById(existingListId);

    existingListToggle?.addEventListener('click', () => {
      const opening = existingListToggle.getAttribute('aria-expanded') !== 'true';
      existingListToggle.setAttribute('aria-expanded', String(opening));
      existingListToggle.closest('.management-collapsible-section')?.classList.toggle('is-expanded', opening);
      existingListToggle.closest('.management-collapsible-section')?.classList.toggle('is-collapsed', !opening);
      if (existingListContent) existingListContent.hidden = !opening;
    });

    const updateSelection = () => {
      const selected = [...form.querySelectorAll('[name="memberIds"]:checked')];
      selectedCount.textContent = `${selected.length} selecionado(s)`;
      form.querySelectorAll('.mutual-member-option').forEach(row => {
        const checkbox = row.querySelector('[name="memberIds"]');
        row.classList.toggle('is-selected', Boolean(checkbox?.checked));
      });
    };

    form.addEventListener('change', event => {
      if (!event.target.matches('[name="memberIds"]')) return;
      updateSelection();
    });
    updateSelection();

    search?.addEventListener('input', () => {
      const query = normalize(search.value);
      let visible = 0;
      form.querySelectorAll('.mutual-member-option').forEach(row => {
        const matches = !query || String(row.dataset.memberSearch || '').includes(query);
        row.hidden = !matches;
        if (matches) visible += 1;
      });
      memberEmpty.hidden = visible > 0;
    });

    form.onsubmit = event => {
      event.preventDefault();
      const formData = new FormData(form);
      const memberIds = [...new Set(formData.getAll('memberIds').map(String))];
      if (!memberIds.length) {
        toast('Selecione ao menos um participante para o grupo de mútua.');
        return;
      }

      const groupId = String(formData.get('groupId') || '');
      const name = String(formData.get('name') || '').trim();
      const duplicateName = groups.find(group => group.id !== groupId && normalize(group.name) === normalize(name));
      if (duplicateName) {
        toast('Já existe um grupo de mútua com esse nome.');
        return;
      }

      const memberships = editingGroup
        ? (editingGroup.memberships || []).map(item => ({ ...item }))
        : [];
      const currentlyActive = new Set(uniqueMemberIds(memberships.filter(item => !item.endedMonth)));

      memberships.forEach(membership => {
        if (!membership.endedMonth && !memberIds.includes(String(membership.memberId))) {
          membership.endedMonth = currentMonth;
        }
      });
      memberIds.forEach(memberId => {
        if (currentlyActive.has(memberId)) return;
        memberships.push({
          id: uid('mum'),
          memberId,
          joinedMonth: currentMonth,
          endedMonth: ''
        });
      });

      const payload = {
        id: groupId || uid('mu'),
        name,
        notes: String(formData.get('notes') || '').trim(),
        memberships,
        events: editingGroup ? (editingGroup.events || []).map(item => ({ ...item })) : []
      };

      if (groupId) {
        const index = groups.findIndex(group => group.id === groupId);
        if (index >= 0) groups[index] = payload;
        persist('Grupo de mútua atualizado. As ocorrências anteriores foram preservadas.');
      } else {
        groups.push(payload);
        persist('Grupo de mútua criado sem cobrança automática.');
      }
      treasury.clearMutualSelection();
      openMutualGroupsManager();
    };

    document.getElementById('cancelMutualEdit')?.addEventListener('click', () => openMutualGroupsManager());
    modalBody.querySelectorAll('[data-edit-mutual-group]').forEach(button => {
      button.addEventListener('click', () => openMutualGroupsManager(button.dataset.editMutualGroup));
    });
    modalBody.querySelectorAll('[data-remove-mutual-group]').forEach(button => {
      button.addEventListener('click', async () => {
        const group = groups.find(item => item.id === button.dataset.removeMutualGroup);
        if (!group) return;
        const memberIds = uniqueMemberIds(group.memberships);
        const hasPayments = memberIds.some(memberId => treasury.mutualPaymentsFor(group.id, memberId).length > 0);
        const hasEvents = Array.isArray(group.events) && group.events.length > 0;
        if (hasPayments || hasEvents) {
          toast('Este grupo possui ocorrências ou pagamentos registrados e não pode ser excluído. Edite os participantes para impedir cobranças futuras.');
          return;
        }
        const approved = await confirmation.askConfirmation({
          title: 'Excluir grupo de mútua?',
          message: 'O grupo será removido. Nenhuma cobrança mensal será criada automaticamente.',
          icon: '🤲',
          confirmText: 'Excluir grupo',
          tone: 'danger'
        });
        if (!approved) return;
        state().mutualGroups = groups.filter(item => item.id !== group.id);
        treasury.clearMutualSelection();
        persist('Grupo de mútua removido.');
        openMutualGroupsManager();
      });
    });
  };

  return openMutualGroupsManager;
}
