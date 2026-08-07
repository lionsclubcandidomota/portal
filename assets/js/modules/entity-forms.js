import { MEMBER_STATUS, memberStatusLabel } from '../core/portal-members.js?v=6.43.0';
import {
  escapeHtml,
  normalize,
  optimizeDataUrl,
  uid
} from '../utils.js';
import { setupMarkdownEditors } from './markdown.js';
import {
  entityFormHtml,
  normalizeLocationData,
  setupAppointmentStatusOptions,
  setupLocationFields
} from './entity-forms/templates.js';

export function createEntityFormsController({
  getState,
  treasury,
  root,
  modalController,
  confirmation,
  persist,
  renderCurrentView,
  closeModal,
  toast,
  isAdminUnlocked,
  setView,
  openTreasuryEntryForm,
  selectImage
}) {
  if (typeof getState !== 'function') {
    throw new TypeError('createEntityFormsController requer getState().');
  }

  if (!modalController?.body || typeof modalController.open !== 'function') {
    throw new TypeError('createEntityFormsController requer modalController.');
  }

  const state = () => getState();
  const collectionFor = type => ({
    birthday: state().birthdays,
    treasury: state().treasury,
    event: state().events,
    meeting: state().meetings,
    notice: state().notices
  })[type];

  const pageToolbar = (placeholder, button, type) => `<div class="toolbar"><div class="search"><input id="searchInput" placeholder="${escapeHtml(placeholder)}" aria-label="Pesquisar"></div><div class="toolbar-group"><button class="btn btn-primary admin-only write-only" data-new="${escapeHtml(type)}" type="button">＋ ${escapeHtml(button)}</button></div></div>`;

  const ensureAdmin = action => {
    if (isAdminUnlocked()) action();
    else {
      toast(document.body.classList.contains('director-mode') ? 'O perfil Diretoria possui acesso somente leitura.' : 'Desbloqueie o Painel Administrativo.');
      setView('admin');
    }
  };

  const rowActions = (type, id) => `<div class="actions admin-only write-only"><button class="btn btn-ghost btn-sm" data-edit="${escapeHtml(type)}" data-id="${escapeHtml(id)}" type="button">Editar</button><button class="btn btn-danger btn-sm" data-delete="${escapeHtml(type)}" data-id="${escapeHtml(id)}" type="button">Excluir</button></div>`;

  const findDuplicateBirthday = (data, currentId = null) => {
    const memberNumber = String(data.memberNumber || '').replace(/\D/g, '');
    const name = normalize(String(data.name || '').trim());
    const birthDate = String(data.birthDate || '');

    return state().birthdays.find(person => {
      if (person.id === currentId) return false;
      const existingNumber = String(person.memberNumber || '').replace(/\D/g, '');
      if (memberNumber && existingNumber && memberNumber === existingNumber) return true;
      return name && birthDate && normalize(String(person.name || '').trim()) === name && String(person.birthDate || '') === birthDate;
    });
  };

  const showBirthdayDuplicate = (form, duplicate) => {
    let alert = form.querySelector('.form-validation-alert');
    if (!alert) {
      alert = document.createElement('div');
      alert.className = 'form-validation-alert full-row';
      form.prepend(alert);
    }

    alert.innerHTML = `<strong>Cadastro já existente</strong><span>${escapeHtml(duplicate.name)}${duplicate.memberNumber ? ` · Nº ${escapeHtml(duplicate.memberNumber)}` : ''} já consta na lista de aniversariantes.</span>`;
    const target = form.elements.memberNumber?.value ? form.elements.memberNumber : form.elements.name;
    target?.focus();
    target?.setAttribute('aria-invalid', 'true');
  };

  const updateBirthdayPhotoPreview = data => {
    const preview = document.getElementById('birthdayPhotoPreview');
    const removeButton = document.getElementById('removePhotoBtn');
    if (!preview) return false;

    preview.innerHTML = data
      ? `<img src="${data}" alt="Pré-visualização da foto selecionada">`
      : '<span>👤</span><small>Nenhuma foto selecionada</small>';
    if (removeButton) removeButton.hidden = !data;
    return true;
  };

  const applyBirthdayPhoto = data => {
    const form = document.getElementById('entityForm');
    if (!form || !document.getElementById('birthdayPhotoPreview')) return false;
    form.dataset.photo = data || '';
    updateBirthdayPhotoPreview(data || '');
    return true;
  };

  const openAppointmentForm = () => {
    modalController.open('Novo compromisso', entityFormHtml('appointment', {}));

    const form = document.getElementById('entityForm');
    setupLocationFields(form);
    setupAppointmentStatusOptions(form);
    setupMarkdownEditors(form, toast);
    form.onsubmit = event => {
      event.preventDefault();
      const data = normalizeLocationData(Object.fromEntries(new FormData(form).entries()));
      const currentState = state();

      if (data.appointmentType === 'meeting') {
        currentState.meetings.push({
          id: uid('m'),
          date: data.date,
          time: data.time,
          locationType: data.locationType,
          location: data.location,
          onlineUrl: data.onlineUrl,
          theme: data.title,
          notes: data.details,
          status: data.status
        });
      } else {
        currentState.events.push({
          id: uid('e'),
          name: data.title,
          date: data.date,
          time: data.time,
          locationType: data.locationType,
          location: data.location,
          onlineUrl: data.onlineUrl,
          description: data.details,
          status: data.status
        });
      }

      persist('Compromisso adicionado.');
      closeModal();
      renderCurrentView();
    };
  };

  const openForm = (type, id = null) => {
    if (type === 'appointment') return openAppointmentForm();
    if (type === 'treasury') return openTreasuryEntryForm(id);

    const collection = collectionFor(type);
    if (!collection) {
      toast('Cadastro não reconhecido.');
      return;
    }

    const item = id ? collection.find(entry => entry.id === id) : {};
    if (id && !item) {
      toast('Registro não encontrado.');
      return;
    }

    const names = {
      birthday: 'Aniversariante',
      event: 'Evento',
      meeting: 'Reunião',
      notice: 'Aviso'
    };

    modalController.open(`${id ? 'Editar' : 'Novo'} ${names[type]}`, entityFormHtml(type, item));

    const form = document.getElementById('entityForm');
    if (type === 'event' || type === 'meeting') setupLocationFields(form);
    if (['event', 'meeting', 'notice'].includes(type)) setupMarkdownEditors(form, toast);
    if (type === 'notice' && form.elements.endDate) {
      form.elements.endDate.addEventListener('input', () => {
        form.elements.endDate.setCustomValidity('');
      });
    }

    if (type === 'birthday') {
      form.dataset.photo = item.photo || '';
      document.getElementById('photoBtn').onclick = () => selectImage('birthday');
      const removeButton = document.getElementById('removePhotoBtn');
      if (removeButton) {
        removeButton.onclick = () => {
          form.dataset.photo = '';
          updateBirthdayPhotoPreview('');
        };
      }
    }

    form.onsubmit = async event => {
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"], button:not([type])');
      const defaultLabel = id ? 'Salvar alterações' : 'Adicionar cadastro';

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando…';
      }

      try {
        const data = Object.fromEntries(new FormData(form).entries());

        if (type === 'notice' && data.endDate && data.endDate < data.date) {
          form.elements.endDate.setCustomValidity('A data final deve ser igual ou posterior à data inicial.');
          form.elements.endDate.reportValidity();
          form.elements.endDate.focus();
          return;
        }
        if (type === 'notice' && form.elements.endDate) form.elements.endDate.setCustomValidity('');
        if (type === 'event' || type === 'meeting') normalizeLocationData(data);

        if (type === 'birthday') {
          data.memberNumber = String(data.memberNumber || '').trim();
          data.name = String(data.name || '').trim();
          data.status = memberStatusLabel({ status: data.status });
          data.active = data.status !== MEMBER_STATUS.INACTIVE;
          data.photo = form.dataset.photo || '';

          const duplicate = findDuplicateBirthday(data, id);
          if (duplicate) {
            showBirthdayDuplicate(form, duplicate);
            return;
          }

          if (data.photo && data.photo !== item.photo) {
            toast('Otimizando a foto para economizar espaço…');
            data.photo = await optimizeDataUrl(data.photo, {
              maxSize: 1200,
              quality: 0.9,
              targetBytes: 420000
            });
          }
        }

        let savedItem = item;
        if (id) Object.assign(item, data);
        else {
          savedItem = { id: uid(type[0]), ...data };
          collection.push(savedItem);
        }

        if (type === 'birthday' && data.status !== MEMBER_STATUS.ACTIVE) {
          const memberId = savedItem.id;
          state().familyGroups = treasury.familyGroups()
            .map(group => {
              if (!(group.memberIds || []).includes(memberId)) return group;
              const memberIds = (group.memberIds || []).filter(value => value !== memberId);
              return {
                ...group,
                memberIds,
                primaryMemberId: group.primaryMemberId === memberId ? (memberIds[0] || '') : group.primaryMemberId
              };
            })
            .filter(group => (group.memberIds || []).length > 0);
        }

        persist(id ? 'Registro atualizado.' : 'Registro adicionado.');
        closeModal();
        renderCurrentView();
      } catch (error) {
        toast(error.message || 'Não foi possível salvar o cadastro.');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = defaultLabel;
        }
      }
    };
  };

  const deleteItem = async (type, id) => {
    const collection = collectionFor(type);
    const item = collection?.find(entry => entry.id === id);
    if (!collection || !item) {
      toast('Registro não encontrado.');
      return;
    }

    const labels = {
      birthday: 'aniversariante',
      treasury: 'lançamento',
      event: 'evento',
      meeting: 'reunião',
      notice: 'aviso'
    };
    const name = item.name || item.theme || item.title || item.description || 'este registro';
    const approved = await confirmation.askConfirmation({
      title: `Excluir ${labels[type] || 'registro'}?`,
      message: `Você está prestes a excluir “${name}”. A exclusão ficará pendente até a próxima publicação e poderá ser desfeita usando “Descartar alterações”.`,
      icon: '🗑️',
      confirmText: 'Excluir registro',
      tone: 'danger'
    });

    if (!approved) return;
    const index = collection.findIndex(entry => entry.id === id);
    if (index >= 0) {
      collection.splice(index, 1);
      persist('Registro excluído.');
      renderCurrentView();
    }
  };

  const bindToolbar = draw => {
    const search = document.getElementById('searchInput');
    if (search) search.oninput = event => draw(event.target.value);
    root.querySelectorAll('[data-new]').forEach(button => {
      button.onclick = () => ensureAdmin(() => openForm(button.dataset.new));
    });
  };

  const bindRowActions = () => {
    root.querySelectorAll('[data-edit]').forEach(button => {
      button.onclick = () => ensureAdmin(() => openForm(button.dataset.edit, button.dataset.id));
    });
    root.querySelectorAll('[data-delete]').forEach(button => {
      button.onclick = () => ensureAdmin(() => deleteItem(button.dataset.delete, button.dataset.id));
    });
  };

  return {
    applyBirthdayPhoto,
    bindRowActions,
    bindToolbar,
    deleteItem,
    ensureAdmin,
    openForm,
    pageToolbar,
    rowActions
  };
}
