const DATA_URL_PATTERN = /^data:([^;,\s]+)(?:;charset=[^;,\s]+)?;base64,([a-z0-9+/=\s]+)$/i;

const MIME_EXTENSIONS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods'
});

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function parseEmbeddedFile(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(DATA_URL_PATTERN);
  if (!match) return null;

  const contentType = match[1].toLowerCase();
  const extension = MIME_EXTENSIONS[contentType];
  if (!extension) return null;

  const content = match[2].replace(/\s+/g, '');
  if (!content) return null;

  return { contentType, extension, content };
}

export function parseEmbeddedImage(value) {
  const parsed = parseEmbeddedFile(value);
  return parsed?.contentType?.startsWith('image/') ? parsed : null;
}

export function stableMediaHash(value) {
  const text = String(value || '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

export function sanitizeMediaIdentifier(value, fallback = 'media') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return normalized || fallback;
}

export function normalizePublicMediaReference(value) {
  const reference = String(value || '').trim();
  if (!reference) return '';
  if (reference.startsWith('public/')) return `./${reference}`;
  return reference;
}

function memberPhotoAsset(member, embedded) {
  const ownerId = sanitizeMediaIdentifier(member?.id || member?.memberNumber || member?.name, 'associado');
  const hash = stableMediaHash(embedded.content);
  const path = `public/members/${ownerId}-${hash}.${embedded.extension}`;
  return {
    path,
    reference: `./${path}`,
    content: embedded.content,
    contentType: embedded.contentType,
    encoding: 'base64',
    kind: 'member-photo',
    ownerId: String(member?.id || ''),
    label: String(member?.name || member?.memberNumber || 'Associado')
  };
}

function clubLogoAsset(embedded) {
  const hash = stableMediaHash(embedded.content);
  const path = `public/branding/club-logo-${hash}.${embedded.extension}`;
  return {
    path,
    reference: `./${path}`,
    content: embedded.content,
    contentType: embedded.contentType,
    encoding: 'base64',
    kind: 'club-logo',
    ownerId: 'settings',
    label: 'Logotipo do clube'
  };
}

function treasuryAttachmentAsset(entry, attachment, embedded) {
  const movementId = sanitizeMediaIdentifier(entry?.id, 'movimentacao');
  const attachmentId = sanitizeMediaIdentifier(attachment?.id || attachment?.name, 'anexo');
  const hash = stableMediaHash(embedded.content);
  const path = `public/treasury/${movementId}/${attachmentId}-${hash}.${embedded.extension}`;
  return {
    path,
    reference: `./${path}`,
    content: embedded.content,
    contentType: embedded.contentType,
    encoding: 'base64',
    kind: 'treasury-attachment',
    ownerId: String(entry?.id || ''),
    label: String(attachment?.name || 'Anexo da movimentação')
  };
}

function prepareTreasuryAttachments(entry, assetsByPath) {
  if (!Array.isArray(entry?.attachments)) return [];

  return entry.attachments.map(attachment => {
    const embedded = parseEmbeddedFile(attachment?.dataUrl || attachment?.content || attachment?.url);
    if (!embedded) {
      return {
        ...attachment,
        url: normalizePublicMediaReference(attachment?.url || attachment?.reference),
        dataUrl: undefined,
        content: undefined,
        reference: undefined
      };
    }

    const asset = treasuryAttachmentAsset(entry, attachment, embedded);
    assetsByPath.set(asset.path, asset);
    return {
      id: String(attachment?.id || ''),
      name: String(attachment?.name || asset.label),
      type: embedded.contentType,
      size: Number(attachment?.size || Math.ceil(embedded.content.length * 0.75)),
      originalSize: Number(attachment?.originalSize || attachment?.size || 0),
      optimized: Boolean(attachment?.optimized),
      url: asset.reference
    };
  }).filter(attachment => attachment.url);
}

/**
 * Converte imagens e anexos Data URL ainda presentes no estado em arquivos
 * publicáveis. O estado original não é alterado. As referências só devem
 * substituir o estado corrente depois que o commit remoto for confirmado.
 */
export function preparePortalMediaForPublication(state) {
  const preparedState = cloneValue(state || {});
  const assetsByPath = new Map();

  preparedState.birthdays = Array.isArray(preparedState.birthdays)
    ? preparedState.birthdays.map(member => {
      const photo = String(member?.photo || '');
      const embedded = parseEmbeddedImage(photo);
      if (!embedded) {
        return { ...member, photo: normalizePublicMediaReference(photo) };
      }

      const asset = memberPhotoAsset(member, embedded);
      assetsByPath.set(asset.path, asset);
      return { ...member, photo: asset.reference };
    })
    : [];

  preparedState.treasury = Array.isArray(preparedState.treasury)
    ? preparedState.treasury.map(entry => ({
      ...entry,
      attachments: prepareTreasuryAttachments(entry, assetsByPath)
    }))
    : [];

  if (preparedState.settings && typeof preparedState.settings === 'object') {
    const logo = String(preparedState.settings.logo || '');
    const embeddedLogo = parseEmbeddedImage(logo);
    if (embeddedLogo) {
      const asset = clubLogoAsset(embeddedLogo);
      assetsByPath.set(asset.path, asset);
      preparedState.settings = { ...preparedState.settings, logo: asset.reference };
    } else {
      preparedState.settings = {
        ...preparedState.settings,
        logo: normalizePublicMediaReference(logo)
      };
    }
  }

  return {
    state: preparedState,
    assets: [...assetsByPath.values()],
    convertedCount: assetsByPath.size
  };
}

export function countEmbeddedPortalMedia(state) {
  let count = 0;
  if (parseEmbeddedImage(state?.settings?.logo)) count += 1;
  for (const member of Array.isArray(state?.birthdays) ? state.birthdays : []) {
    if (parseEmbeddedImage(member?.photo)) count += 1;
  }
  for (const entry of Array.isArray(state?.treasury) ? state.treasury : []) {
    for (const attachment of Array.isArray(entry?.attachments) ? entry.attachments : []) {
      if (parseEmbeddedFile(attachment?.dataUrl || attachment?.content || attachment?.url)) count += 1;
    }
  }
  return count;
}

export function publicMediaPathFromReference(reference) {
  const normalized = normalizePublicMediaReference(reference);
  if (!normalized.startsWith('./public/')) return '';
  return normalized.slice(2);
}
