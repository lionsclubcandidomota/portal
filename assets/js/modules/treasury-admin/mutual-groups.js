import { escapeHtml, formatDate, normalize, uid } from '../../utils.js';

function activeMemberships(group) {
  return (Array.isArray(group?.memberships) ? group.memberships : [])
    .filter(membership => !membership.endedDate);
}

function uniqueMemberIds(memberships) {
  return [...new Set((memberships || []).map(item => String(item.memberId || '')).filter(Boolean))];
}

function todayReference() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
    const today = todayReference();
    const activeIds = new Set(uniqueMemberIds(activeMemberships(editingGroup)));
    const createdDate = editingGroup?.createdDate || today;
    const availableMembers = [...currentState.birthdays]
      .filter(member => treasury.memberCanJoinMutual(member) || activeIds.has(String(member.id)))
      .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));

    const groupSummary = group => {
      const currentIds = uniqueMemberIds(activeMemberships(group));
      const historicalIds = uniqueMemberIds(group.memberships);
      const events = Array.isArray(group.events) ? group.events : [];
      const paymentCount = events.reduce((total, event) => (
        total + event.participantIds.reduce(
          (sum, memberId) => sum + treasury.mutualPaymentsFor(group.id, event.id, memberId).length,
          0
        )
      ), 0);
      return { currentIds, historicalIds, eventCount: events.length, paymentCount };
    };

    modalBody.innerHTML = `<div class="family-manager family-manager-v2 mutual-group-manager">
      <section class="family-existing-section mutual-existing-groups">
        <div class="family-section-heading"><div><strong>Grupos de mutuários</strong><small>Os grupos permanecem ativos e só geram cobranças quando um falecimento é registrado.</small></div><span class="family-count-badge">${groups.length}</span></div>
        <div class="family-group-list">${groups.length ? groups.map(group => {
          const summary = groupSummary(group);
          const members = summary.currentIds
            .map(memberId => currentState.birthdays.find(member => String(member.id) === memberId))
            .filter(Boolean);
          const active = !group.closedDate;
          return `<article class="family-group-row family-group-row-v2 mutual-group-row ${editingGroup?.id === group.id ? 'is-editing' : ''}">
            <div class="family-group-main"><span class="family-group-icon">🤲</span><div><strong>${escapeHtml(group.name)}</strong><small>${summary.currentIds.length} participante(s) ativo(s) · ${summary.eventCount} evento(s) · ${summary.paymentCount} pagamento(s)</small><p class="family-group-notes">${active ? `Grupo ativo desde ${escapeHtml(formatDate(group.createdDate))}` : `Baixado em ${escapeHtml(formatDate(group.closedDate))} · ${escapeHtml(group.closureReason || 'Motivo não informado')}`}</p>${group.notes ? `<p class="family-group-notes">${escapeHtml(group.notes)}</p>` : ''}<div class="family-group-avatars">${members.slice(0, 5).map(member => avatar(member)).join('')}${members.length > 5 ? `<span class="family-avatar-more">+${members.length - 5}</span>` : ''}</div></div></div>
            <div class="family-group-actions"><button class="btn btn-ghost btn-sm" type="button" data-edit-mutual-group="${escapeHtml(group.id)}">Editar</button><button class="btn btn-danger-soft btn-sm" type="button" data-remove-mutual-group="${escapeHtml(group.id)}">Excluir</button></div>
          </article>`;
        }).join('') : empty('🤲', 'Nenhum grupo de mutuários cadastrado.')}</div>
      </section>
      <form id="mutualGroupForm" class="admin-entity-form family-group-form-v2 mutual-group-form">
        <input type="hidden" name="groupId" value="${escapeHtml(editingGroup?.id || '')}">
        <section class="admin-form-section"><div class="admin-form-section-heading"><span>${editingGroup ? '✏️' : '➕'}</span><div><h3>${editingGroup ? 'Editar grupo de mutuários' : 'Novo grupo de mutuários'}</h3><p>O cadastro do grupo não cria cobranças. As cobranças serão geradas somente por eventos de falecimento.</p></div></div>
          <div class="form-grid admin-form-section-grid">
            <div class="form-field"><label for="mutualGroupName">Nome do grupo *</label><input id="mutualGroupName" name="name" required placeholder="Ex.: Mútua 658" value="${escapeHtml(editingGroup?.name || '')}"></div>
            <div class="form-field"><label for="mutualCreatedDate">Data de criação *</label>${editingGroup ? `<input id="mutualCreatedDate" type="date" value="${escapeHtml(createdDate)}" disabled><input type="hidden" name="createdDate" value="${escapeHtml(createdDate)}"><small>A data de criação é preservada após o cadastro.</small>` : `<input id="mutualCreatedDate" name="createdDate" type="date" required value="${escapeHtml(createdDate)}"><small>O grupo será criado ativo e sem data de baixa.</small>`}</div>
            <div class="form-field full-row mutual-member-picker"><label>Participantes do grupo *</label>
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
              <small>Alterações na composição afetam somente eventos futuros. Eventos já registrados preservam a lista original de participantes.</small>
            </div>
            <div class="form-field full-row"><label for="mutualGroupNotes">Observações do grupo</label><textarea id="mutualGroupNotes" name="notes" rows="3" placeholder="Informações sobre o grupo de mutuários">${escapeHtml(editingGroup?.notes || '')}</textarea></div>
            ${editingGroup ? `<div class="form-field"><label for="mutualClosedDate">Data de baixa</label><input id="mutualClosedDate" name="closedDate" type="date" min="${escapeHtml(createdDate)}" value="${escapeHtml(editingGroup.closedDate || '')}"><small>Deixe em branco enquanto o grupo estiver ativo.</small></div><div class="form-field"><label for="mutualClosureReason">Motivo da baixa</label><input id="mutualClosureReason" name="closureReason" value="${escapeHtml(editingGroup.closureReason || '')}" placeholder="Obrigatório somente ao encerrar o grupo"><small>A baixa só é aceita com data e motivo específicos.</small></div>` : ''}
          </div>
        </section>
        <div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Fechar</button>${editingGroup ? '<button type="button" class="btn btn-ghost" id="cancelMutualEdit">Cancelar edição</button>' : ''}<button class="btn btn-primary" type="submit">${editingGroup ? 'Salvar alterações' : 'Criar grupo ativo'}</button></div>
      </form>
    </div>`;
    showModal('Grupos de mutuários');

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
        toast('Selecione ao menos um participante para o grupo de mutuários.');
        return;
      }

      const groupId = String(formData.get('groupId') || '');
      const name = String(formData.get('name') || '').trim();
      const createdDateValue = String(formData.get('createdDate') || '').trim();
      const closedDate = String(formData.get('closedDate') || '').trim();
      const closureReason = String(formData.get('closureReason') || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(createdDateValue)) {
        toast('Informe a data de criação do grupo.');
        form.elements.createdDate?.focus();
        return;
      }
      if ((closedDate && !closureReason) || (!closedDate && closureReason)) {
        toast('Para dar baixa no grupo, informe a data e o motivo. Para mantê-lo ativo, deixe os dois campos em branco.');
        return;
      }
      if (closedDate && closedDate < createdDateValue) {
        toast('A data de baixa não pode ser anterior à criação do grupo.');
        return;
      }
      const duplicateName = groups.find(group => group.id !== groupId && normalize(group.name) === normalize(name));
      if (duplicateName) {
        toast('Já existe um grupo de mutuários com esse nome.');
        return;
      }

      const memberships = editingGroup
        ? (editingGroup.memberships || []).map(item => ({ ...item }))
        : [];
      const currentlyActive = new Set(uniqueMemberIds(memberships.filter(item => !item.endedDate)));

      memberships.forEach(membership => {
        if (!membership.endedDate && !memberIds.includes(String(membership.memberId))) {
          membership.endedDate = today;
        }
      });
      memberIds.forEach(memberId => {
        if (currentlyActive.has(memberId)) return;
        memberships.push({
          id: uid('mum'),
          memberId,
          joinedDate: editingGroup ? today : createdDateValue,
          endedDate: ''
        });
      });

      const payload = {
        id: groupId || uid('mu'),
        name,
        createdDate: editingGroup?.createdDate || createdDateValue,
        closedDate,
        closureReason,
        notes: String(formData.get('notes') || '').trim(),
        memberships,
        events: Array.isArray(editingGroup?.events) ? editingGroup.events.map(item => ({ ...item })) : []
      };

      if (groupId) {
        const index = groups.findIndex(group => group.id === groupId);
        if (index >= 0) groups[index] = payload;
        persist(closedDate ? 'Grupo de mutuários atualizado e baixado.' : 'Grupo de mutuários atualizado e mantido ativo.');
      } else {
        groups.push(payload);
        persist('Grupo de mutuários criado ativo, sem cobranças automáticas.');
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
        const events = Array.isArray(group.events) ? group.events : [];
        const hasPayments = events.some(event => event.participantIds.some(memberId => (
          treasury.mutualPaymentsFor(group.id, event.id, memberId).length > 0
        )));
        if (events.length || hasPayments) {
          toast('Este grupo possui eventos ou pagamentos registrados. Faça a baixa do grupo em vez de excluí-lo.');
          return;
        }
        const approved = await confirmation.askConfirmation({
          title: 'Excluir grupo de mutuários?',
          message: 'O grupo será removido. Nenhuma cobrança será criada ou excluída, pois o grupo não possui eventos registrados.',
          icon: '🤲',
          confirmText: 'Excluir grupo',
          tone: 'danger'
        });
        if (!approved) return;
        state().mutualGroups = groups.filter(item => item.id !== group.id);
        treasury.clearMutualSelection();
        persist('Grupo de mutuários removido.');
        openMutualGroupsManager();
      });
    });
  };

  return openMutualGroupsManager;
}
