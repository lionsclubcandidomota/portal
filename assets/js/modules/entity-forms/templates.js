import { MEMBER_STATUS, memberStatusLabel } from '../../core/portal-members.js?v=6.46.4';
import { escapeHtml, toInputDate } from '../../utils.js';
import { markdownEditor } from '../markdown.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.4';

export function normalizeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;

  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function locationFormValues(item = {}) {
  const legacyUrl = normalizeExternalUrl(item.location || '');
  const type = item.locationType || (item.onlineUrl || legacyUrl ? 'virtual' : 'physical');

  return {
    type,
    physical: type === 'physical' ? (item.location || '') : '',
    url: item.onlineUrl || legacyUrl || ''
  };
}

export function locationFieldsHtml(item = {}, requiredMark = '') {
  const location = locationFormValues(item);

  return `<div class="form-field full-row"><label>Tipo do local ${requiredMark}</label><div class="location-type-picker"><label><input type="radio" name="locationType" value="physical" ${location.type === 'physical' ? 'checked' : ''}> <span>${uiIcon('map-pin')} Presencial</span></label><label><input type="radio" name="locationType" value="virtual" ${location.type === 'virtual' ? 'checked' : ''}> <span>${uiIcon('globe')} Online</span></label></div></div><div class="form-field full-row" data-location-physical><label>Local ${requiredMark}</label><input name="location" value="${escapeHtml(location.physical)}" placeholder="Ex.: Sede do Lions Clube"><small>Informe o endereço ou nome do local.</small></div><div class="form-field full-row" data-location-virtual><label>Link de acesso <span class="optional-mark">opcional</span></label><input name="onlineUrl" type="url" value="${escapeHtml(location.url)}" placeholder="Pode ser adicionado depois"><small>Deixe em branco quando o link ainda não estiver disponível.</small></div>`;
}

export function setupLocationFields(form) {
  const synchronize = () => {
    const isVirtual = form.elements.locationType?.value === 'virtual';
    const physicalField = form.querySelector('[data-location-physical]');
    const virtualField = form.querySelector('[data-location-virtual]');

    if (physicalField) physicalField.hidden = isVirtual;
    if (virtualField) virtualField.hidden = !isVirtual;
    if (form.elements.location) form.elements.location.required = !isVirtual;
    if (form.elements.onlineUrl) form.elements.onlineUrl.required = false;
  };

  form.querySelectorAll('[name="locationType"]').forEach(radio => {
    radio.addEventListener('change', synchronize);
  });
  synchronize();
}

export function normalizeLocationData(data) {
  data.locationType = data.locationType || 'physical';

  if (data.locationType === 'virtual') {
    const rawOnlineUrl = String(data.onlineUrl || '').trim();
    data.onlineUrl = normalizeExternalUrl(rawOnlineUrl);
    data.location = '';
    if (rawOnlineUrl && !data.onlineUrl) throw new Error('Confira o link informado ou deixe o campo em branco.');
  } else {
    data.location = String(data.location || '').trim();
    data.onlineUrl = '';
    if (!data.location) throw new Error('Informe o local do compromisso.');
  }

  return data;
}


const EVENT_STATUSES = ['Confirmado', 'Em planejamento', 'Cancelado'];
const MEETING_STATUSES = ['Pendente', 'Em andamento', 'Concluído', 'Cancelado'];

export function defaultMeetingStatus(item = {}) {
  if (item.status) return item.status;
  const today = toInputDate(new Date());
  if (item.date && item.date < today) return 'Concluído';
  if (item.date === today) return 'Em andamento';
  return 'Pendente';
}

export function statusOptionsHtml(options, selected = '') {
  return options.map(option => `<option value="${escapeHtml(option)}" ${selected === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('');
}

export function setupAppointmentStatusOptions(form) {
  const typeSelect = form?.elements?.appointmentType;
  const statusSelect = form?.elements?.status;
  if (!typeSelect || !statusSelect) return;

  const synchronize = () => {
    const options = typeSelect.value === 'meeting' ? MEETING_STATUSES : EVENT_STATUSES;
    const current = statusSelect.value;
    statusSelect.innerHTML = statusOptionsHtml(options, options.includes(current) ? current : options[0]);
  };

  typeSelect.addEventListener('change', synchronize);
  synchronize();
}

export function entityFormHtml(type, item = {}) {
  const value = key => escapeHtml(item[key] ?? '');
  const required = '<span class="required-mark">*</span>';
  const selectedMemberStatus = memberStatusLabel(item);
  const section = (icon, title, subtitle, content) => `<section class="admin-form-section"><div class="admin-form-section-heading"><span>${uiIcon(icon)}</span><div><h3>${title}</h3><p>${subtitle}</p></div></div><div class="form-grid admin-form-section-grid">${content}</div></section>`;
  const forms = {
    birthday: section(
      'user',
      'Dados da pessoa',
      'Informe os dados de identificação, a situação e a data comemorativa.',
      `<div class="form-field full-row"><label>Foto</label><div class="photo-picker"><div class="photo-preview" id="birthdayPhotoPreview">${item.photo ? `<img src="${escapeHtml(item.photo)}" alt="Pré-visualização da foto selecionada" decoding="async">` : `<span>${uiIcon('user')}</span><small>Nenhuma foto selecionada</small>`}</div><div class="photo-actions"><button type="button" class="btn btn-ghost" id="photoBtn">Selecionar foto</button><button type="button" class="btn btn-ghost" id="removePhotoBtn" ${item.photo ? '' : 'hidden'}>Remover foto</button><small>Use uma imagem quadrada e confira a pré-visualização.</small></div></div></div><div class="form-field"><label>Número do associado</label><input name="memberNumber" value="${value('memberNumber')}" inputmode="numeric" autocomplete="off" placeholder="Ex.: 5287412"><small>Para Mutuários, este campo pode permanecer vazio.</small></div><div class="form-field"><label>Nome completo ${required}</label><input name="name" value="${value('name')}" autocomplete="name" required placeholder="Nome completo"></div><div class="form-field"><label>Data de nascimento ${required}</label><input name="birthDate" type="date" value="${value('birthDate')}" required><small>O ano permanece interno e não aparece nas listas.</small></div><div class="form-field"><label>Situação do associado ${required}</label><select name="status" required><option value="${MEMBER_STATUS.ACTIVE}" ${selectedMemberStatus === MEMBER_STATUS.ACTIVE ? 'selected' : ''}>Ativo</option><option value="${MEMBER_STATUS.MUTUAL}" ${selectedMemberStatus === MEMBER_STATUS.MUTUAL ? 'selected' : ''}>Mútua</option><option value="${MEMBER_STATUS.INACTIVE}" ${selectedMemberStatus === MEMBER_STATUS.INACTIVE ? 'selected' : ''}>Inativo</option></select><small>Mutuários participam das mútuas, mas não entram no controle de mensalidades.</small></div>`
    ),
    appointment: section(
      'info',
      'Informações principais',
      'Escolha o tipo e identifique o compromisso.',
      `<div class="form-field"><label>Tipo ${required}</label><select name="appointmentType" required><option value="event">Evento</option><option value="meeting">Reunião</option></select></div><div class="form-field"><label>Status</label><select name="status" data-appointment-status>${statusOptionsHtml(EVENT_STATUSES, 'Confirmado')}</select></div><div class="form-field full-row"><label>Título ou tema ${required}</label><input name="title" required placeholder="Ex.: Reunião de diretoria"></div>`
    ) + section(
      'calendar',
      'Quando e onde',
      'Informe data, horário e local do compromisso.',
      `<div class="form-field"><label>Data ${required}</label><input name="date" type="date" required></div><div class="form-field"><label>Horário ${required}</label><input name="time" type="time" required></div>${locationFieldsHtml({}, required)}<div class="form-field full-row"><label>Descrição ou observações</label>${markdownEditor('details', '', { placeholder: 'Pauta, orientações ou outras informações importantes' })}</div>`
    ),
    event: section(
      'info',
      'Dados do evento',
      'Atualize as informações principais do evento.',
      `<div class="form-field full-row"><label>Nome ${required}</label><input name="name" value="${value('name')}" required></div><div class="form-field"><label>Data ${required}</label><input name="date" type="date" value="${value('date')}" required></div><div class="form-field"><label>Horário ${required}</label><input name="time" type="time" value="${value('time')}" required></div>${locationFieldsHtml(item, required)}<div class="form-field"><label>Status</label><select name="status">${statusOptionsHtml(EVENT_STATUSES, item.status || 'Confirmado')}</select></div><div class="form-field full-row"><label>Descrição</label>${markdownEditor('description', item.description || '', { placeholder: 'Detalhes, orientações e informações importantes' })}</div>`
    ),
    meeting: section(
      'handshake',
      'Dados da reunião',
      'Atualize tema, data, horário e local.',
      `<div class="form-field full-row"><label>Tema ${required}</label><input name="theme" value="${value('theme')}" required></div><div class="form-field"><label>Data ${required}</label><input name="date" type="date" value="${value('date')}" required></div><div class="form-field"><label>Horário ${required}</label><input name="time" type="time" value="${value('time')}" required></div>${locationFieldsHtml(item, required)}<div class="form-field"><label>Status</label><select name="status">${statusOptionsHtml(MEETING_STATUSES, defaultMeetingStatus(item))}</select></div><div class="form-field full-row"><label>Observações</label>${markdownEditor('notes', item.notes || '', { placeholder: 'Pauta, decisões e orientações da reunião' })}</div>`
    ),
    notice: section(
      'megaphone',
      'Identificação do aviso',
      'Defina título, publicação e nível de prioridade.',
      `<div class="form-field full-row"><label>Título ${required}</label><input name="title" value="${value('title')}" required placeholder="Título curto e objetivo"></div><div class="form-field"><label>Data inicial ${required}</label><input name="date" type="date" value="${value('date') || toInputDate(new Date())}" required><small>Primeiro dia em que o aviso ficará disponível.</small></div><div class="form-field"><label>Data final</label><input name="endDate" type="date" value="${value('endDate')}"><small>Após essa data, o aviso deixa de aparecer para visitantes.</small></div><div class="form-field"><label>Prioridade</label><select name="priority">${['Alta', 'Média', 'Baixa'].map(option => `<option ${item.priority === option ? 'selected' : ''}>${option}</option>`).join('')}</select></div>`
    ) + section(
      'edit',
      'Mensagem',
      'Use parágrafos e quebras de linha para facilitar a leitura.',
      `<div class="form-field full-row"><label>Texto do aviso ${required}</label>${markdownEditor('text', item.text || '', { required: true, placeholder: 'Digite a mensagem do comunicado...' })}</div>`
    )
  };

  if (!forms[type]) throw new Error(`Tipo de formulário não suportado: ${type}`);

  return `<form id="entityForm" class="admin-entity-form"><div class="admin-form-intro"><span>Campos marcados com ${required} são obrigatórios.</span></div>${forms[type]}<div class="form-actions admin-form-actions"><button type="button" class="btn btn-ghost" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${item.id ? 'Salvar alterações' : 'Adicionar cadastro'}</button></div></form>`;
}
