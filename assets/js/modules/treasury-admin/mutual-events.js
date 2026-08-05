import { escapeHtml, formatDate, money, uid } from '../../utils.js';

function todayReference() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function createMutualEventManager(context) {
  const {
    treasury,
    modalBody,
    showModal,
    confirmation,
    persist,
    closeModal,
    renderTreasuryView,
    toast,
    avatar
  } = context;

  const openMutualEvent = (preferredGroupId = '') => {
    const groups = treasury.mutualGroups().filter(group => !group.closedDate);
    if (!groups.length) {
      toast('Cadastre ou reative um grupo de mutuários antes de registrar um falecimento.');
      return;
    }
    const selectedGroupId = groups.some(group => group.id === preferredGroupId)
      ? preferredGroupId
      : groups[0].id;
    const today = todayReference();

    modalBody.innerHTML = `<form id="mutualEventForm" class="admin-entity-form mutual-event-form">
      <section class="mutual-payment-hero"><div><span aria-hidden="true">🕊️</span><div><small>Novo evento de mútua</small><strong>Falecimento de associado do distrito</strong><p>Preencha o evento, confira os participantes e gere uma cobrança única para cada pessoa.</p></div></div><div><small>Fluxo</small><strong>Evento → cobrança</strong></div></section>
      <div class="mutual-event-workspace">
        <section class="admin-form-section mutual-event-details"><div class="admin-form-section-heading"><span>1</span><div><h3>Dados do falecimento</h3><p>O registro deste evento é o único gatilho para criar cobranças de mútua.</p></div></div>
          <div class="form-grid admin-form-section-grid">
            <div class="form-field"><label>Grupo de mutuários *</label><select name="groupId" id="mutualEventGroup" required>${groups.map(group => `<option value="${escapeHtml(group.id)}" ${group.id === selectedGroupId ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}</select></div>
            <div class="form-field"><label>Data do falecimento *</label><input name="deathDate" id="mutualEventDeathDate" type="date" required value="${escapeHtml(today)}"></div>
            <div class="form-field full-row"><label>Nome do associado falecido *</label><input name="deceasedName" required placeholder="Nome completo"></div>
            <div class="form-field"><label>Número do associado</label><input name="deceasedMemberNumber" placeholder="Opcional"></div>
            <div class="form-field"><label>Clube de origem</label><input name="deceasedClub" placeholder="Opcional"></div>
            <div class="form-field"><label>Valor por participante *</label><div class="currency-input"><span>R$</span><input name="amountPerParticipant" type="text" inputmode="decimal" autocomplete="off" required placeholder="0,00"></div><small>Este valor vale somente para este falecimento.</small></div>
            <div class="form-field"><label>Data de vencimento</label><input name="dueDate" type="date"><small>Opcional; não cria recorrência.</small></div>
            <div class="form-field full-row"><label>Observações</label><textarea name="notes" rows="4" placeholder="Informações do distrito, resolução ou orientação de cobrança"></textarea></div>
          </div>
        </section>
        <aside class="mutual-event-side">
          <section class="admin-form-section mutual-event-participants-section"><div class="admin-form-section-heading"><span>2</span><div><h3>Participantes do evento</h3><p>A lista é congelada ao registrar o falecimento. Alterações futuras no grupo não mudam esta cobrança.</p></div></div>
            <div id="mutualEventParticipants" class="mutual-event-participant-list"></div>
            <div class="mutual-payment-total"><div><small>Cobranças que serão geradas</small><strong id="mutualEventParticipantCount">0</strong></div><div><small>Total previsto</small><strong class="sensitive-money" id="mutualEventTotal">${money.format(0)}</strong></div></div>
          </section>
          <div class="operation-readiness mutual-event-readiness" id="mutualEventReadiness" role="status" aria-live="polite"><span aria-hidden="true">○</span><strong>Preencha os dados do falecimento e confira os participantes.</strong></div>
        </aside>
      </div>
      <div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button><button class="btn btn-primary" id="mutualEventSubmit" type="submit" disabled>Revisar e gerar cobranças</button></div>
    </form>`;
    showModal('Registrar falecimento e gerar cobrança');

    const form = document.getElementById('mutualEventForm');
    const groupInput = document.getElementById('mutualEventGroup');
    const deathDateInput = document.getElementById('mutualEventDeathDate');
    const participantsRoot = document.getElementById('mutualEventParticipants');
    const participantCount = document.getElementById('mutualEventParticipantCount');
    const totalNode = document.getElementById('mutualEventTotal');
    const readiness = document.getElementById('mutualEventReadiness');
    const submitButton = document.getElementById('mutualEventSubmit');
    let participants = [];

    const amount = () => treasury.parseCurrencyInput(form.elements.amountPerParticipant.value);
    const refreshParticipants = () => {
      const groupId = String(groupInput.value || '');
      const deathDate = String(deathDateInput.value || '');
      participants = deathDate ? treasury.mutualMembersForDate(groupId, deathDate) : [];
      participantsRoot.innerHTML = participants.length
        ? participants.map(member => {
          const type = treasury.memberIsMutual(member) ? 'Mutuário' : 'Associado';
          return `<article class="mutual-event-participant">${avatar(member)}<span class="mutual-event-participant-copy"><strong>${escapeHtml(member.name)}</strong><small>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número informado'}</small></span><span class="mutual-event-participant-type">${type}</span></article>`;
        }).join('')
        : '<div class="member-picker-empty">Nenhum participante ativo no grupo para esta data.</div>';
      updateSummary();
    };

    const updateSummary = () => {
      const value = amount();
      participantCount.textContent = String(participants.length);
      totalNode.textContent = money.format(participants.length * value);
      const ready = Boolean(
        participants.length
        && value > 0
        && String(form.elements.deceasedName.value || '').trim()
        && /^\d{4}-\d{2}-\d{2}$/.test(String(deathDateInput.value || ''))
      );
      submitButton.disabled = !ready;
      readiness.classList.toggle('is-ready', ready);
      readiness.querySelector('span').textContent = ready ? '✓' : '○';
      readiness.querySelector('strong').textContent = ready
        ? `${participants.length} cobrança(s) serão geradas. Revise antes de confirmar.`
        : !participants.length
          ? 'Não há participantes ativos no grupo para a data informada.'
          : 'Informe o nome do falecido, a data e um valor por participante.';
    };

    groupInput.addEventListener('change', refreshParticipants);
    deathDateInput.addEventListener('change', refreshParticipants);
    form.elements.amountPerParticipant.addEventListener('input', updateSummary);
    form.elements.deceasedName.addEventListener('input', updateSummary);
    refreshParticipants();

    form.onsubmit = async event => {
      event.preventDefault();
      const data = new FormData(form);
      const groupId = String(data.get('groupId') || '');
      const group = treasury.mutualGroupFor(groupId);
      const deathDate = String(data.get('deathDate') || '');
      const deceasedName = String(data.get('deceasedName') || '').trim();
      const amountPerParticipant = treasury.parseCurrencyInput(data.get('amountPerParticipant'));
      if (!group || group.closedDate) {
        toast('O grupo selecionado não está ativo.');
        return;
      }
      if (!participants.length || !(amountPerParticipant > 0) || !deceasedName) {
        toast('Revise os dados do evento e os participantes.');
        return;
      }
      const duplicate = group.events.some(item => (
        item.deathDate === deathDate
        && String(item.deceasedName || '').toLocaleLowerCase('pt-BR') === deceasedName.toLocaleLowerCase('pt-BR')
      ));
      if (duplicate) {
        toast('Já existe um evento para esse falecimento neste grupo.');
        return;
      }
      const total = participants.length * amountPerParticipant;
      const approved = await confirmation.askConfirmation({
        title: 'Gerar cobranças de mútua?',
        icon: '🕊️',
        tone: 'warning',
        confirmText: 'Registrar evento',
        message: `Registrar o falecimento de ${deceasedName}, ocorrido em ${formatDate(deathDate)}, e gerar ${participants.length} cobrança(s) de ${money.format(amountPerParticipant)}, totalizando ${money.format(total)}?`
      });
      if (!approved) return;

      group.events.push({
        id: uid('mue'),
        deceasedName,
        deceasedMemberNumber: String(data.get('deceasedMemberNumber') || '').trim(),
        deceasedClub: String(data.get('deceasedClub') || '').trim(),
        deathDate,
        dueDate: String(data.get('dueDate') || '').trim(),
        amountPerParticipant,
        participantIds: participants.map(member => String(member.id)),
        notes: String(data.get('notes') || '').trim(),
        createdAt: new Date().toISOString(),
        cancelledAt: ''
      });
      group.events.sort((first, second) => first.deathDate.localeCompare(second.deathDate));
      treasury.clearMutualSelection();
      treasury.setMutualGroupExpanded(group.id, true);
      treasury.setMutualGroupView(group.id, 'charges');
      persist(`Evento de mútua registrado para ${deceasedName}; ${participants.length} cobrança(s) gerada(s).`);
      closeModal();
      renderTreasuryView();
    };
  };

  return openMutualEvent;
}
