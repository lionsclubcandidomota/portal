import { escapeHtml, formatDate, money, normalize, uid } from '../../utils.js';

function eventPaymentCount(treasury, group, event) {
  return (event.participantIds || []).reduce(
    (sum, memberId) => sum + treasury.mutualPaymentsFor(group.id, memberId, event.id).length,
    0
  );
}

export function createMutualEventManager(context) {
  const {
    treasury,
    modalBody,
    showModal,
    confirmation,
    persist,
    toast,
    avatar,
    empty
  } = context;

  const openMutualEventManager = (preferredGroupId = '') => {
    const groups = treasury.mutualGroups();
    const selectedGroupId = groups.some(group => String(group.id) === String(preferredGroupId))
      ? String(preferredGroupId)
      : String(groups[0]?.id || '');
    const allEvents = treasury.mutualEvents();

    modalBody.innerHTML = `<div class="family-manager family-manager-v2 mutual-event-manager">
      <section class="family-existing-section mutual-event-existing">
        <div class="family-section-heading"><div><strong>Falecimentos registrados</strong><small>Cada ocorrência gera uma única cobrança para os participantes ativos do grupo no momento do registro. Depois de gerada, a cobrança é definitiva e não pode ser editada ou excluída.</small></div><span class="family-count-badge">${allEvents.length}</span></div>
        <div class="family-group-list mutual-event-list">${allEvents.length ? allEvents.map(({ group, event }) => {
          const payments = eventPaymentCount(treasury, group, event);
          return `<article class="family-group-row family-group-row-v2 mutual-event-row">
            <div class="family-group-main"><span class="family-group-icon">🕊️</span><div><strong>Falecimento de ${escapeHtml(event.deceasedName)}</strong><small>${escapeHtml(group.name)} · ${escapeHtml(formatDate(event.occurrenceDate))}</small><p class="family-group-notes">${event.participantIds.length} cobrança(s) de <span class="sensitive-money">${money.format(event.amount)}</span> · ${payments} pagamento(s) registrado(s)</p>${event.notes ? `<p class="family-group-notes">${escapeHtml(event.notes)}</p>` : ''}</div></div>
            <div class="family-group-actions"><span class="membership-family-chip" title="A cobrança preserva os participantes do momento em que foi gerada">🔒 Registro definitivo</span></div>
          </article>`;
        }).join('') : empty('🕊️', 'Nenhum falecimento foi registrado. Portanto, não existem cobranças de mútua em aberto.')}</div>
      </section>
      ${groups.length ? `<form id="mutualEventForm" class="admin-entity-form mutual-event-form">
        <section class="admin-form-section"><div class="admin-form-section-heading"><span>🕊️</span><div><h3>Registrar falecimento</h3><p>Use este formulário somente quando ocorrer o falecimento de um associado do Distrito.</p></div></div>
          <div class="form-grid admin-form-section-grid">
            <div class="form-field"><label for="mutualEventGroup">Grupo de mútua *</label><select id="mutualEventGroup" name="groupId" required>${groups.map(group => `<option value="${escapeHtml(group.id)}" ${String(group.id) === selectedGroupId ? 'selected' : ''}>${escapeHtml(group.name)}</option>`).join('')}</select></div>
            <div class="form-field"><label for="mutualOccurrenceDate">Data do falecimento *</label><input id="mutualOccurrenceDate" name="occurrenceDate" type="date" required value="${escapeHtml(treasury.currentDate())}"></div>
            <div class="form-field full-row"><label for="mutualDeceasedName">Nome do associado falecido *</label><input id="mutualDeceasedName" name="deceasedName" required autocomplete="off" placeholder="Nome completo do associado do Distrito"></div>
            <div class="form-field"><label for="mutualEventAmount">Valor por participante *</label><div class="currency-input"><span>R$</span><input id="mutualEventAmount" name="amount" type="text" inputmode="decimal" autocomplete="off" required placeholder="0,00"></div><small>O mesmo valor será aplicado a todos os participantes incluídos.</small></div>
            <div class="form-field mutual-event-participant-preview"><label>Participantes incluídos</label><div id="mutualEventParticipants" class="mutual-event-participants" aria-live="polite"></div><small>A lista é registrada junto com a ocorrência e não muda se o grupo for editado depois.</small></div>
            <div class="form-field full-row"><label for="mutualEventNotes">Observações</label><textarea id="mutualEventNotes" name="notes" rows="3" placeholder="Ex.: Clube de origem, orientação do Distrito ou prazo para pagamento"></textarea></div>
          </div>
        </section>
        <div class="operation-readiness" id="mutualEventReadiness" role="status" aria-live="polite"><span aria-hidden="true">○</span><strong>Informe o falecimento, o valor e confirme que o grupo possui participantes.</strong></div>
        <div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Fechar</button><button class="btn btn-primary" id="mutualEventSubmit" type="submit" disabled>Revisar e gerar cobranças</button></div>
      </form>` : empty('🤲', 'Cadastre primeiro um grupo de mútua com seus participantes.')}
    </div>`;
    showModal('Mútuas por falecimento');

    const form = document.getElementById('mutualEventForm');
    if (form) {
      const groupSelect = form.elements.groupId;
      const participantPreview = document.getElementById('mutualEventParticipants');
      const readiness = document.getElementById('mutualEventReadiness');
      const submit = document.getElementById('mutualEventSubmit');

      const selectedParticipants = () => treasury.mutualActiveMembers(groupSelect.value);
      const refreshParticipants = () => {
        const members = selectedParticipants();
        participantPreview.innerHTML = members.length
          ? `<div class="family-group-avatars">${members.slice(0, 8).map(member => avatar(member)).join('')}${members.length > 8 ? `<span class="family-avatar-more">+${members.length - 8}</span>` : ''}</div><strong>${members.length} participante(s)</strong>`
          : '<span class="member-unavailable-note">Este grupo não possui participantes ativos.</span>';
        return members;
      };

      const updateReadiness = () => {
        const members = refreshParticipants();
        const valid = Boolean(
          String(form.elements.deceasedName.value || '').trim()
          && /^\d{4}-\d{2}-\d{2}$/.test(String(form.elements.occurrenceDate.value || ''))
          && treasury.parseCurrencyInput(form.elements.amount.value) > 0
          && members.length
        );
        submit.disabled = !valid;
        readiness.classList.toggle('is-ready', valid);
        readiness.innerHTML = valid
          ? `<span aria-hidden="true">✓</span><strong>Pronto para gerar ${members.length} cobrança(s) eventuais.</strong>`
          : '<span aria-hidden="true">○</span><strong>Informe o falecimento, o valor e confirme que o grupo possui participantes.</strong>';
      };

      form.addEventListener('input', updateReadiness);
      form.addEventListener('change', updateReadiness);
      updateReadiness();

      form.onsubmit = async event => {
        event.preventDefault();
        const formData = new FormData(form);
        const groupId = String(formData.get('groupId') || '');
        const initialGroup = treasury.mutualGroupFor(groupId);
        const deceasedName = String(formData.get('deceasedName') || '').trim();
        const occurrenceDate = String(formData.get('occurrenceDate') || '').trim();
        const amount = treasury.parseCurrencyInput(formData.get('amount'));
        const participantIds = treasury.mutualActiveMembers(groupId).map(member => String(member.id));
        if (!initialGroup || !participantIds.length) {
          toast('O grupo selecionado não possui participantes ativos.');
          return;
        }
        if (!deceasedName || !/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate) || !(amount > 0)) {
          toast('Preencha corretamente o nome, a data do falecimento e o valor por participante.');
          return;
        }
        const currentGroup = treasury.mutualGroupFor(groupId);
        const duplicate = (currentGroup?.events || []).some(item => (
          normalize(item.deceasedName) === normalize(deceasedName)
          && String(item.occurrenceDate) === occurrenceDate
        ));
        if (duplicate) {
          toast('Este falecimento já foi registrado para o grupo selecionado.');
          return;
        }

        const total = amount * participantIds.length;
        const approved = await confirmation.askConfirmation({
          title: 'Gerar cobranças de mútua?',
          message: `Registrar o falecimento de ${deceasedName}, em ${formatDate(occurrenceDate)}, e gerar ${participantIds.length} cobrança(s) de ${money.format(amount)}, totalizando ${money.format(total)}? Após confirmar, este registro não poderá ser editado ou excluído.`,
          icon: '🕊️',
          confirmText: 'Registrar falecimento',
          tone: 'primary'
        });
        if (!approved) return;

        // Reobtém o grupo imediatamente antes da gravação. Isso garante que a
        // ocorrência seja anexada ao objeto que permanece dentro do estado atual,
        // mesmo após consultas e normalizações executadas durante a validação.
        const targetGroup = treasury.mutualGroupFor(groupId);
        if (!targetGroup) {
          toast('Não foi possível localizar o grupo de mútua para gerar as cobranças.');
          return;
        }
        if (!Array.isArray(targetGroup.events)) targetGroup.events = [];
        targetGroup.events.push({
          id: uid('mue'),
          deceasedName,
          occurrenceDate,
          amount,
          participantIds,
          notes: String(formData.get('notes') || '').trim(),
          createdDate: treasury.currentDate(),
          createdAt: new Date().toISOString()
        });
        targetGroup.events.sort((first, second) => String(second.occurrenceDate || '').localeCompare(String(first.occurrenceDate || '')));
        treasury.clearMutualSelection();
        persist(`Falecimento registrado. ${participantIds.length} cobrança(s) de mútua foram geradas.`);
        openMutualEventManager(targetGroup.id);
      };
    }

  };

  return openMutualEventManager;
}
