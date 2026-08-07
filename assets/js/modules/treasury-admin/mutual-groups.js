import { escapeHtml, money, normalize, uid } from '../../utils.js';

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
    const initialMonth = editingGroup?.startedMonth || currentMonth;
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
      return { currentIds, historicalIds, paymentCount };
    };

    modalBody.innerHTML = `<div class="family-manager family-manager-v2 mutual-group-manager">
      <section class="family-existing-section mutual-existing-groups">
        <div class="family-section-heading"><div><strong>Grupos de mútuas</strong><small>O valor é mensal e igual para todos os participantes ativos do grupo.</small></div><span class="family-count-badge">${groups.length}</span></div>
        <div class="family-group-list">${groups.length ? groups.map(group => {
          const summary = groupSummary(group);
          const members = summary.currentIds
            .map(memberId => currentState.birthdays.find(member => String(member.id) === memberId))
            .filter(Boolean);
          return `<article class="family-group-row family-group-row-v2 mutual-group-row ${editingGroup?.id === group.id ? 'is-editing' : ''}">
            <div class="family-group-main"><span class="family-group-icon">🤲</span><div><strong>${escapeHtml(group.name)}</strong><small>${summary.currentIds.length} participante(s) ativo(s) · ${summary.paymentCount} pagamento(s) registrado(s)</small><p class="family-group-notes">Valor mensal: <span class="sensitive-money">${money.format(group.monthlyAmount)}</span> · Cobranças desde ${escapeHtml(treasury.monthLabel(group.startedMonth))}</p>${group.notes ? `<p class="family-group-notes">${escapeHtml(group.notes)}</p>` : ''}<div class="family-group-avatars">${members.slice(0, 5).map(member => avatar(member)).join('')}${members.length > 5 ? `<span class="family-avatar-more">+${members.length - 5}</span>` : ''}</div></div></div>
            <div class="family-group-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit-mutual-group="${escapeHtml(group.id)}">Editar</button><button class="btn btn-danger-soft btn-sm" type="button" data-remove-mutual-group="${escapeHtml(group.id)}">Excluir</button></div>
          </article>`;
        }).join('') : empty('🤲', 'Nenhum grupo de mútua cadastrado.')}</div>
      </section>
      <form id="mutualGroupForm" class="admin-entity-form family-group-form-v2 mutual-group-form">
        <input type="hidden" name="groupId" value="${escapeHtml(editingGroup?.id || '')}">
        <section class="admin-form-section"><div class="admin-form-section-heading"><span>${editingGroup ? '✏️' : '➕'}</span><div><h3>${editingGroup ? 'Editar grupo de mútua' : 'Novo grupo de mútua'}</h3><p>Defina o valor mensal e marque os associados ou Mutuários que participarão das próximas cobranças.</p></div></div>
          <div class="form-grid admin-form-section-grid">
            <div class="form-field"><label for="mutualGroupName">Nome do grupo *</label><input id="mutualGroupName" name="name" required placeholder="Ex.: Mútua Social" value="${escapeHtml(editingGroup?.name || '')}"></div>
            <div class="form-field"><label for="mutualMonthlyAmount">Valor mensal por participante *</label><div class="currency-input"><span>R$</span><input id="mutualMonthlyAmount" name="monthlyAmount" type="text" inputmode="decimal" autocomplete="off" required value="${escapeHtml(treasury.currencyInputValue(editingGroup?.monthlyAmount || 0))}" placeholder="0,00"></div><small>${editingGroup ? 'Alterações passam a valer na competência atual e nas seguintes.' : 'O valor será aplicado integralmente a cada participante.'}</small></div>
            <div class="form-field"><label for="mutualStartedMonth">Competência inicial *</label>${editingGroup ? `<input id="mutualStartedMonth" type="month" value="${escapeHtml(initialMonth)}" disabled><input type="hidden" name="startedMonth" value="${escapeHtml(initialMonth)}"><small>A competência inicial é preservada após a criação do grupo.</small>` : `<input id="mutualStartedMonth" name="startedMonth" type="month" required value="${escapeHtml(initialMonth)}"><small>Permite criar cobranças e registrar pagamentos retroativos.</small>`}</div>
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
              <small>Ao remover um participante, as baixas já registradas são preservadas e ele deixa de receber novas cobranças a partir do próximo mês.</small>
            </div>
            <div class="form-field full-row"><label for="mutualGroupNotes">Observações do grupo</label><textarea id="mutualGroupNotes" name="notes" rows="3" placeholder="Informações sobre a finalidade ou orientação de cobrança">${escapeHtml(editingGroup?.notes || '')}</textarea></div>
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
      const monthlyAmount = treasury.parseCurrencyInput(formData.get('monthlyAmount'));
      const startedMonth = String(formData.get('startedMonth') || '').trim();
      if (!/^\d{4}-\d{2}$/.test(startedMonth)) {
        toast('Selecione a competência inicial do grupo.');
        form.elements.startedMonth?.focus();
        return;
      }
      if (!(monthlyAmount > 0)) {
        toast('Informe um valor mensal maior que zero.');
        form.elements.monthlyAmount?.focus();
        return;
      }
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
          joinedMonth: editingGroup ? currentMonth : startedMonth,
          endedMonth: ''
        });
      });

      const amountHistory = editingGroup
        ? (editingGroup.amountHistory || []).map(item => ({ ...item }))
        : [];
      const previousAmount = Number(editingGroup?.monthlyAmount || 0);
      if (!amountHistory.length) amountHistory.push({ fromMonth: editingGroup?.startedMonth || startedMonth, amount: monthlyAmount });
      if (editingGroup && previousAmount !== monthlyAmount) {
        const currentRecord = amountHistory.find(item => item.fromMonth === currentMonth);
        if (currentRecord) currentRecord.amount = monthlyAmount;
        else amountHistory.push({ fromMonth: currentMonth, amount: monthlyAmount });
      }
      amountHistory.sort((first, second) => first.fromMonth.localeCompare(second.fromMonth));

      const payload = {
        id: groupId || uid('mu'),
        name,
        monthlyAmount,
        startedMonth: editingGroup?.startedMonth || startedMonth,
        notes: String(formData.get('notes') || '').trim(),
        memberships,
        amountHistory
      };

      if (groupId) {
        const index = groups.findIndex(group => group.id === groupId);
        if (index >= 0) groups[index] = payload;
        persist('Grupo de mútua atualizado. As cobranças futuras foram recalculadas.');
      } else {
        groups.push(payload);
        persist('Grupo de mútua criado com cobranças mensais.');
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
        if (hasPayments) {
          toast('Este grupo possui pagamentos registrados e não pode ser excluído. Remova os participantes para interromper as cobranças futuras.');
          return;
        }
        const approved = await confirmation.askConfirmation({
          title: 'Excluir grupo de mútua?',
          message: 'O grupo e suas cobranças mensais ainda não pagas deixarão de ser exibidos.',
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
