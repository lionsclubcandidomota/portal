import { escapeHtml, normalize, uid } from '../../utils.js';

export function createFamilyGroupsManager(context, memberSelectorCard) {
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

  const openFamilyGroupsManager = (editGroupId = '') => {
    const currentState = state();
    const groups = treasury.familyGroups();
    const editingGroup = groups.find(group => group.id === editGroupId) || null;
    const availableMembers = [...currentState.birthdays]
      .filter(member => treasury.memberIsActive(member) || (editingGroup?.memberIds || []).includes(member.id))
      .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));

    const memberCardForFamily = member => {
      const linkedGroup = treasury.familyGroupForMember(member.id);
      const belongsToEditing = Boolean(editingGroup && (editingGroup.memberIds || []).includes(member.id));
      const notEligible = !treasury.memberIsActive(member);
      const unavailable = notEligible || Boolean(linkedGroup && !belongsToEditing);
      const unavailableMessage = treasury.memberIsMutual(member)
        ? 'Mutuário não participa de mensalidades'
        : 'Associado inativo';

      return memberSelectorCard(member, { checked: belongsToEditing, disabled: unavailable }).replace(
        '</span>\n      <span class="member-selector-check"',
        `${unavailable ? `<span class="member-unavailable-note">${notEligible ? unavailableMessage : `Vinculado a ${escapeHtml(linkedGroup?.name || 'outro grupo')}`}</span>` : ''}</span>\n      <span class="member-selector-check"`
      );
    };

    modalBody.innerHTML = `<div class="family-manager family-manager-v2">
      <section class="family-existing-section">
        <div class="family-section-heading"><div><strong>Famílias cadastradas</strong><small>Edite ou exclua os grupos que realizam pagamentos em conjunto.</small></div><span class="family-count-badge">${groups.length}</span></div>
        <div class="family-group-list">${groups.length ? groups.map(group => {
          const members = (group.memberIds || [])
            .map(id => currentState.birthdays.find(member => member.id === id))
            .filter(Boolean);
          const primaryName = currentState.birthdays.find(member => member.id === group.primaryMemberId)?.name || 'Não identificado';
          return `<article class="family-group-row family-group-row-v2 ${editingGroup?.id === group.id ? 'is-editing' : ''}"><div class="family-group-main"><span class="family-group-icon">👨‍👩‍👧‍👦</span><div><strong>${escapeHtml(group.name)}</strong><small>${members.length} associado(s)${group.primaryMemberId ? ` · Titular: ${escapeHtml(primaryName)}` : ''}</small>${group.notes ? `<p class="family-group-notes">${escapeHtml(group.notes)}</p>` : ''}<div class="family-group-avatars">${members.slice(0, 5).map(member => avatar(member)).join('')}${members.length > 5 ? `<span class="family-avatar-more">+${members.length - 5}</span>` : ''}</div></div></div><div class="family-group-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit-family="${escapeHtml(group.id)}">Editar</button><button class="btn btn-danger-soft btn-sm" type="button" data-remove-family="${escapeHtml(group.id)}">Excluir</button></div></article>`;
        }).join('') : empty('👨‍👩‍👧‍👦', 'Nenhuma família vinculada.')}</div>
      </section>
      <form id="familyGroupForm" class="admin-entity-form family-group-form-v2">
        <input type="hidden" name="familyId" value="${escapeHtml(editingGroup?.id || '')}">
        <section class="admin-form-section"><div class="admin-form-section-heading"><span>${editingGroup ? '✏️' : '➕'}</span><div><h3>${editingGroup ? 'Editar grupo familiar' : 'Novo grupo familiar'}</h3><p>${editingGroup ? 'Atualize nome, titular, integrantes e observações.' : 'Localize e selecione os associados que normalmente pagam juntos.'}</p></div></div>
          <div class="form-grid admin-form-section-grid"><div class="form-field full-row"><label>Nome da família *</label><input name="name" required placeholder="Ex.: Família Silva" value="${escapeHtml(editingGroup?.name || '')}"></div>
            <div class="form-field full-row family-member-picker"><label>Associados *</label><div class="member-picker-toolbar"><div class="search-box compact"><span>⌕</span><input id="familyMemberSearch" type="search" placeholder="Filtrar por nome, número ou família"></div><span id="familySelectedCount" class="selected-count">0 selecionado(s)</span></div>
              <div class="family-member-options family-member-options-v2">${availableMembers.map(member => memberCardForFamily(member)).join('')}</div><div id="familyMemberEmpty" class="member-picker-empty" hidden>Nenhum associado encontrado.</div>
              <small>Associados já vinculados a outra família ficam indisponíveis.</small>
            </div><div class="form-field full-row"><label>Observações da família</label><textarea name="notes" rows="3" placeholder="Informações importantes sobre cobrança, responsável ou forma de pagamento">${escapeHtml(editingGroup?.notes || '')}</textarea><small>Estas informações ficam disponíveis no momento da baixa.</small></div><div class="form-field full-row"><label>Titular da família *</label><select name="primaryMemberId" id="familyPrimaryMember" required disabled><option value="">Selecione os associados primeiro</option></select><small>O titular utiliza o valor familiar principal; os demais utilizam o valor adicional.</small></div>
          </div>
        </section><div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Fechar</button>${editingGroup ? '<button type="button" class="btn btn-ghost" id="cancelFamilyEdit">Cancelar edição</button>' : ''}<button class="btn btn-primary" type="submit">${editingGroup ? 'Salvar alterações' : 'Salvar família'}</button></div>
      </form>
    </div>`;
    showModal('Grupos familiares');

    const form = document.getElementById('familyGroupForm');
    const search = document.getElementById('familyMemberSearch');
    const primarySelect = document.getElementById('familyPrimaryMember');
    const selectedCount = document.getElementById('familySelectedCount');
    const memberEmpty = document.getElementById('familyMemberEmpty');

    const updateCount = () => {
      const checked = [...form.querySelectorAll('[name="memberIds"]:checked')];
      const currentPrimary = primarySelect.value || editingGroup?.primaryMemberId || '';
      selectedCount.textContent = `${checked.length} selecionado(s)`;
      primarySelect.innerHTML = checked.length
        ? checked.map(input => {
          const member = state().birthdays.find(item => item.id === input.value);
          return `<option value="${escapeHtml(input.value)}">${escapeHtml(member?.name || 'Associado')}</option>`;
        }).join('')
        : '<option value="">Selecione os associados primeiro</option>';
      primarySelect.disabled = !checked.length;
      if (checked.some(input => input.value === currentPrimary)) primarySelect.value = currentPrimary;
    };

    form.querySelectorAll('[name="memberIds"]').forEach(input => input.addEventListener('change', updateCount));
    updateCount();

    search?.addEventListener('input', () => {
      const query = normalize(search.value);
      let visible = 0;
      form.querySelectorAll('.member-selector-card').forEach(card => {
        const matches = !query || card.dataset.memberSearch.includes(query);
        card.hidden = !matches;
        if (matches) visible += 1;
      });
      memberEmpty.hidden = visible > 0;
    });

    form.onsubmit = event => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const memberIds = formData.getAll('memberIds');
      if (!memberIds.length) {
        toast('Selecione ao menos um associado.');
        return;
      }

      const familyId = String(formData.get('familyId') || '');
      const conflict = groups.find(group =>
        group.id !== familyId && (group.memberIds || []).some(id => memberIds.includes(id))
      );
      if (conflict) {
        toast(`Um ou mais associados já pertencem à ${conflict.name}.`);
        return;
      }

      const payload = {
        id: familyId || uid('f'),
        name: String(formData.get('name') || '').trim(),
        memberIds,
        primaryMemberId: String(formData.get('primaryMemberId') || memberIds[0]),
        notes: String(formData.get('notes') || '').trim()
      };

      if (familyId) {
        const index = groups.findIndex(group => group.id === familyId);
        if (index >= 0) groups[index] = payload;
        persist('Grupo familiar atualizado.');
      } else {
        groups.push(payload);
        persist('Grupo familiar criado.');
      }
      openFamilyGroupsManager();
    };

    document.getElementById('cancelFamilyEdit')?.addEventListener('click', () => openFamilyGroupsManager());
    modalBody.querySelectorAll('[data-edit-family]').forEach(button => {
      button.onclick = () => openFamilyGroupsManager(button.dataset.editFamily);
    });
    modalBody.querySelectorAll('[data-remove-family]').forEach(button => {
      button.onclick = async () => {
        const approved = await confirmation.askConfirmation({
          title: 'Excluir grupo familiar?',
          message: 'Os associados continuarão cadastrados e poderão receber baixa individual.',
          icon: '👨‍👩‍👧‍👦',
          confirmText: 'Excluir grupo',
          tone: 'danger'
        });
        if (!approved) return;
        state().familyGroups = groups.filter(group => group.id !== button.dataset.removeFamily);
        persist('Grupo familiar removido.');
        openFamilyGroupsManager();
      };
    });
  };

  return openFamilyGroupsManager;
}
