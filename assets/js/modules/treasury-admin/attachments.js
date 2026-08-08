import { escapeHtml, optimizeDataUrl, uid } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.5';

export const TREASURY_ATTACHMENT_LIMITS = Object.freeze({
  maxFiles: 5,
  maxInputBytes: 5 * 1024 * 1024,
  maxStoredBytes: 1250 * 1024,
  maxTotalStoredBytes: 3200 * 1024,
  imageTargetBytes: 900 * 1024,
  imageMaxDimension: 1800
});

const MIME_BY_EXTENSION = Object.freeze({
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet'
});

const SUPPORTED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

const extensionOf = name => String(name || '').split('.').pop()?.toLowerCase() || '';
const mimeForFile = file => String(file?.type || MIME_BY_EXTENSION[extensionOf(file?.name)] || '').toLowerCase();

export function approximateDataUrlBytes(value) {
  const content = String(value || '').split(',')[1] || '';
  return Math.ceil(content.replace(/\s+/g, '').length * 0.75);
}

export function formatAttachmentSize(bytes) {
  const value = Math.max(0, Number(bytes || 0));
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeAttachmentName(name, fallback = 'documento') {
  return String(name || fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback;
}

export function isSupportedTreasuryAttachment(file) {
  return SUPPORTED_MIME_TYPES.has(mimeForFile(file));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo ${file?.name || ''}.`));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function jpegName(name) {
  const base = normalizeAttachmentName(name).replace(/\.[^.]+$/, '') || 'comprovante';
  return `${base}.jpg`;
}

export async function prepareTreasuryAttachmentFile(file) {
  if (!file) throw new Error('Selecione um arquivo válido.');
  if (!isSupportedTreasuryAttachment(file)) {
    throw new Error(`O arquivo “${file.name}” não possui um formato permitido.`);
  }
  if (Number(file.size || 0) > TREASURY_ATTACHMENT_LIMITS.maxInputBytes) {
    throw new Error(`O arquivo “${file.name}” excede o limite de ${formatAttachmentSize(TREASURY_ATTACHMENT_LIMITS.maxInputBytes)}.`);
  }

  const type = mimeForFile(file);
  const originalSize = Number(file.size || 0);
  let dataUrl = await readFileAsDataUrl(file);
  let name = normalizeAttachmentName(file.name);
  let storedType = type;
  let optimized = false;

  if (type.startsWith('image/') && type !== 'image/gif') {
    dataUrl = await optimizeDataUrl(dataUrl, {
      maxSize: TREASURY_ATTACHMENT_LIMITS.imageMaxDimension,
      quality: 0.9,
      targetBytes: TREASURY_ATTACHMENT_LIMITS.imageTargetBytes
    });
    name = jpegName(name);
    storedType = 'image/jpeg';
    optimized = true;
  }

  const size = approximateDataUrlBytes(dataUrl);
  if (size > TREASURY_ATTACHMENT_LIMITS.maxStoredBytes) {
    throw new Error(`O arquivo “${file.name}” ainda possui ${formatAttachmentSize(size)} após o processamento. O limite por anexo é ${formatAttachmentSize(TREASURY_ATTACHMENT_LIMITS.maxStoredBytes)}.`);
  }

  return {
    id: uid('att'),
    name,
    type: storedType,
    size,
    originalSize,
    optimized,
    dataUrl
  };
}

export function totalAttachmentBytes(attachments) {
  return (Array.isArray(attachments) ? attachments : []).reduce((total, attachment) => total + Number(attachment?.size || 0), 0);
}

export function validateTreasuryAttachmentCollection(attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (list.length > TREASURY_ATTACHMENT_LIMITS.maxFiles) {
    throw new Error(`Cada movimentação pode possuir no máximo ${TREASURY_ATTACHMENT_LIMITS.maxFiles} anexos.`);
  }
  const total = totalAttachmentBytes(list);
  if (total > TREASURY_ATTACHMENT_LIMITS.maxTotalStoredBytes) {
    throw new Error(`O total dos anexos não pode ultrapassar ${formatAttachmentSize(TREASURY_ATTACHMENT_LIMITS.maxTotalStoredBytes)}.`);
  }
  return list;
}

export function attachmentReference(attachment) {
  const reference = String(attachment?.url || attachment?.reference || attachment?.dataUrl || '').trim();
  if (/^\.\/public\/treasury\/[a-z0-9/_-]+\.[a-z0-9]+(?:\?[^\s]*)?$/i.test(reference)) return reference;
  if (/^data:(?:image\/(?:jpeg|jpg|png|webp|gif)|application\/(?:pdf|msword|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.(?:wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.oasis\.opendocument\.(?:text|spreadsheet))|text\/(?:plain|csv));base64,[a-z0-9+/=\s]+$/i.test(reference)) return reference;
  return '';
}

function attachmentIcon(type = '') {
  const normalized = String(type).toLowerCase();
  if (normalized.startsWith('image/')) return uiIcon('image');
  if (normalized === 'application/pdf') return uiIcon('file-text');
  if (normalized.includes('sheet') || normalized.includes('excel') || normalized === 'text/csv') return uiIcon('chart-bar');
  if (normalized.includes('word') || normalized.includes('text')) return uiIcon('file-text');
  return uiIcon('paperclip');
}

export function renderTreasuryAttachmentPicker(attachments = []) {
  const list = Array.isArray(attachments) ? attachments : [];
  const items = list.length
    ? list.map(attachment => `<li class="treasury-attachment-editor-item" data-attachment-id="${escapeHtml(attachment.id)}"><span class="treasury-attachment-editor-icon" aria-hidden="true">${attachmentIcon(attachment.type)}</span><span class="treasury-attachment-editor-copy"><strong>${escapeHtml(attachment.name)}</strong><small>${formatAttachmentSize(attachment.size)}${attachment.optimized ? ' · imagem otimizada' : ''}</small></span><button class="icon-btn" type="button" data-remove-treasury-attachment="${escapeHtml(attachment.id)}" aria-label="Remover ${escapeHtml(attachment.name)}">×</button></li>`).join('')
    : '<li class="treasury-attachment-empty">Nenhum comprovante anexado.</li>';

  return `<div class="treasury-attachment-picker" data-treasury-attachment-picker>
    <div class="treasury-attachment-dropzone">
      <input id="treasuryEntryAttachments" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.odt,.ods" data-treasury-attachment-input>
      <label for="treasuryEntryAttachments"><span aria-hidden="true">${uiIcon('paperclip')}</span><strong>Adicionar comprovantes</strong><small>Imagens, PDFs e documentos. Até ${TREASURY_ATTACHMENT_LIMITS.maxFiles} arquivos; seleção de até ${formatAttachmentSize(TREASURY_ATTACHMENT_LIMITS.maxInputBytes)} e limite final de ${formatAttachmentSize(TREASURY_ATTACHMENT_LIMITS.maxStoredBytes)} por anexo.</small></label>
    </div>
    <p class="treasury-attachment-feedback" data-treasury-attachment-feedback aria-live="polite"></p>
    <ul class="treasury-attachment-editor-list" data-treasury-attachment-list>${items}</ul>
    <div class="treasury-attachment-summary"><span><strong data-treasury-attachment-count>${list.length}</strong> anexo(s)</span><span><strong data-treasury-attachment-size>${formatAttachmentSize(totalAttachmentBytes(list))}</strong> armazenados</span></div>
  </div>`;
}

export function bindTreasuryAttachmentPicker(form, initialAttachments = [], { toast } = {}) {
  const root = form?.querySelector('[data-treasury-attachment-picker]');
  const input = root?.querySelector('[data-treasury-attachment-input]');
  const listElement = root?.querySelector('[data-treasury-attachment-list]');
  const feedback = root?.querySelector('[data-treasury-attachment-feedback]');
  const count = root?.querySelector('[data-treasury-attachment-count]');
  const size = root?.querySelector('[data-treasury-attachment-size]');
  let attachments = (Array.isArray(initialAttachments) ? initialAttachments : []).map(item => ({ ...item }));

  if (!root || !input || !listElement) return { getAttachments: () => attachments };

  const render = () => {
    const html = renderTreasuryAttachmentPicker(attachments);
    const shell = document.createElement('div');
    shell.innerHTML = html;
    const next = shell.firstElementChild;
    const nextList = next?.querySelector('[data-treasury-attachment-list]');
    if (nextList) listElement.innerHTML = nextList.innerHTML;
    if (count) count.textContent = String(attachments.length);
    if (size) size.textContent = formatAttachmentSize(totalAttachmentBytes(attachments));
  };

  const setFeedback = (message, tone = '') => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `treasury-attachment-feedback ${tone}`.trim();
  };

  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    input.value = '';
    if (!files.length) return;
    if (attachments.length + files.length > TREASURY_ATTACHMENT_LIMITS.maxFiles) {
      setFeedback(`Selecione no máximo ${TREASURY_ATTACHMENT_LIMITS.maxFiles - attachments.length} arquivo(s) adicional(is).`, 'is-error');
      return;
    }

    input.disabled = true;
    setFeedback('Processando e otimizando os anexos…', 'is-loading');
    try {
      const preparedFiles = [];
      for (const file of files) preparedFiles.push(await prepareTreasuryAttachmentFile(file));
      const candidate = [...attachments, ...preparedFiles];
      validateTreasuryAttachmentCollection(candidate);
      attachments = candidate;
      render();
      setFeedback('Anexos prontos para serem salvos com a movimentação.', 'is-success');
      toast?.({ type: 'success', title: 'Anexos preparados', message: `${files.length} arquivo(s) adicionado(s) à movimentação.` });
    } catch (error) {
      setFeedback(error.message || 'Não foi possível processar os anexos.', 'is-error');
      toast?.({ type: 'error', title: 'Falha no anexo', message: error.message || 'Não foi possível processar o arquivo.' });
    } finally {
      input.disabled = false;
    }
  });

  listElement.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-treasury-attachment]');
    if (!button) return;
    attachments = attachments.filter(item => item.id !== button.dataset.removeTreasuryAttachment);
    render();
    setFeedback('Anexo removido do cadastro. Salve a movimentação para confirmar.', 'is-info');
  });

  return {
    getAttachments: () => validateTreasuryAttachmentCollection(attachments).map(item => ({ ...item }))
  };
}
