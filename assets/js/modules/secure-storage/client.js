import {
  createPrivatePortalState,
  mergePublicAndPrivatePortalState
} from '../../core/portal-data-boundary.js?v=6.34.1';

const SESSION_REFRESH_MARGIN_MS = 60_000;
const R2_STORAGE_KIND = 'r2';
const LEGACY_PUBLIC_ATTACHMENT = /^\.\/public\/treasury\/[a-z0-9/_-]+\.[a-z0-9]+(?:\?[^\s]*)?$/i;
const SAFE_OBJECT_KEY = /^treasury\/[a-z0-9/_-]+\.[a-z0-9]+$/i;

let activeSession = {
  workerUrl: '',
  role: '',
  token: '',
  expiresAt: 0,
  privateRevision: ''
};

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function jsonHeaders(token = '') {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function safeUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return '';
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return '';
  }
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
  const cloudflareWorker = parsed.hostname.endsWith('.workers.dev');
  if (!cloudflareWorker && !local) return '';
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return '';
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

async function readJson(response, fallback) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // A resposta pode não possuir JSON em falhas de rede intermediárias.
  }
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `${fallback} (${response.status}).`);
  }
  return payload || {};
}

function apiUrl(workerUrl, path) {
  return `${safeUrl(workerUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

function base64ToBytes(value) {
  const binary = atob(String(value || '').replace(/\s+/g, ''));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([a-z0-9+/=\s]+)$/i);
  if (!match) throw new Error('O conteúdo do anexo não possui um formato compatível para envio seguro.');
  return new Blob([base64ToBytes(match[2])], { type: match[1].toLowerCase() });
}

function absoluteLegacyUrl(reference, baseUrl = globalThis.document?.baseURI || globalThis.location?.href || '') {
  const value = String(reference || '').trim();
  if (!LEGACY_PUBLIC_ATTACHMENT.test(value)) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function cleanR2Attachment(attachment) {
  const source = attachment && typeof attachment === 'object' ? attachment : {};
  const objectKey = String(source.objectKey || '').trim();
  if (!SAFE_OBJECT_KEY.test(objectKey)) return null;
  return {
    id: String(source.id || ''),
    name: String(source.name || 'Documento').slice(0, 120),
    type: String(source.type || 'application/octet-stream').slice(0, 120),
    size: Math.max(0, Number(source.size || 0)),
    originalSize: Math.max(0, Number(source.originalSize || source.size || 0)),
    optimized: Boolean(source.optimized),
    storage: R2_STORAGE_KIND,
    objectKey,
    checksum: String(source.checksum || '').slice(0, 128),
    uploadedAt: String(source.uploadedAt || '')
  };
}

export function secureStorageProfileFromState(state) {
  const source = state?.settings?.secureStorage;
  const workerUrl = safeUrl(source?.workerUrl);
  return {
    version: Math.max(1, Number(source?.version || 1)),
    enabled: Boolean(source?.enabled && workerUrl),
    workerUrl,
    provider: 'cloudflare-r2'
  };
}

export function normalizeSecureStorageWorkerUrl(value) {
  const normalized = safeUrl(value);
  if (!normalized) {
    throw new Error('Informe uma URL HTTPS válida do Cloudflare Worker.');
  }
  return normalized;
}

export function isSecureTreasuryAttachment(attachment) {
  return String(attachment?.storage || '').toLowerCase() === R2_STORAGE_KIND
    && SAFE_OBJECT_KEY.test(String(attachment?.objectKey || '').trim());
}

export function legacyTreasuryAttachmentPath(attachment) {
  const reference = String(attachment?.url || attachment?.reference || '').trim();
  if (!LEGACY_PUBLIC_ATTACHMENT.test(reference)) return '';
  return reference.slice(2).split('?')[0];
}

export function collectSecureTreasuryObjectKeys(state) {
  const keys = new Set();
  for (const movement of Array.isArray(state?.treasury) ? state.treasury : []) {
    for (const attachment of Array.isArray(movement?.attachments) ? movement.attachments : []) {
      if (isSecureTreasuryAttachment(attachment)) keys.add(String(attachment.objectKey));
    }
  }
  return keys;
}

export function secureStorageSessionSnapshot() {
  return { ...activeSession, token: activeSession.token ? 'configured' : '' };
}

export function clearSecureStorageSession() {
  activeSession = { workerUrl: '', role: '', token: '', expiresAt: 0, privateRevision: '' };
}

export async function testSecureStorageConnection(workerUrl) {
  const normalized = normalizeSecureStorageWorkerUrl(workerUrl);
  const response = await fetch(apiUrl(normalized, '/health'), {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível consultar o Cloudflare Worker');
  if (payload.status !== 'ok' || payload.storage !== 'cloudflare-r2') {
    throw new Error('O endereço respondeu, mas não corresponde ao Worker de anexos do Portal.');
  }
  return payload;
}

export async function connectSecureStorageSession({ state, role, credential }) {
  const profile = secureStorageProfileFromState(state);
  if (!profile.enabled) {
    clearSecureStorageSession();
    return { enabled: false, role: '' };
  }

  if (String(role || '').toLowerCase() === 'director') {
    const iterations = Number(state?.settings?.accessProfiles?.director?.iterations || 0);
    if (iterations > 100000) {
      throw new Error('A senha da Diretoria utiliza uma configuração anterior incompatível com o Cloudflare Worker. Entre como Administrador, defina novamente a senha da Diretoria e publique a alteração.');
    }
  }

  const previousRevision = activeSession.workerUrl === profile.workerUrl
    && activeSession.role === String(role || '')
    ? activeSession.privateRevision
    : '';

  const response = await fetch(apiUrl(profile.workerUrl, '/api/session'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ role, credential: String(credential || '') }),
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível criar a sessão do armazenamento privado');
  const expiresAt = Date.parse(payload.expiresAt || '') || (Date.now() + 25 * 60_000);
  activeSession = {
    workerUrl: profile.workerUrl,
    role: String(payload.role || role || ''),
    token: String(payload.token || ''),
    expiresAt,
    privateRevision: previousRevision
  };
  if (!activeSession.token) throw new Error('O Worker não retornou uma sessão segura válida.');
  return { enabled: true, role: activeSession.role, expiresAt: payload.expiresAt || '' };
}


export async function loadPrivatePortalState(state) {
  const profile = secureStorageProfileFromState(state);
  if (!profile.enabled) {
    return { enabled: false, found: false, state: null, revision: '' };
  }
  const { token } = requireSession(state, ['admin', 'director']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/private-state'), {
    method: 'GET',
    headers: jsonHeaders(token),
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível carregar os dados privados do Portal');
  activeSession.privateRevision = String(payload.revision || '');
  return {
    enabled: true,
    found: Boolean(payload.found && payload.state),
    state: payload.state && typeof payload.state === 'object' ? payload.state : null,
    revision: activeSession.privateRevision,
    updatedAt: String(payload.updatedAt || ''),
    integrity: payload.integrity && typeof payload.integrity === 'object' ? payload.integrity : null
  };
}

export async function savePrivatePortalState(state) {
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/private-state'), {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      state: createPrivatePortalState(state),
      expectedRevision: activeSession.privateRevision
    }),
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível salvar os dados privados do Portal');
  activeSession.privateRevision = String(payload.revision || '');
  return {
    saved: true,
    revision: activeSession.privateRevision,
    updatedAt: String(payload.updatedAt || '')
  };
}

export async function listPrivateStateBackups(state) {
  const { profile, token } = requireSession(state, ['admin', 'director']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/private-state/backups'), {
    method: 'GET',
    headers: jsonHeaders(token),
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível listar os backups privados');
  return {
    backups: Array.isArray(payload.backups) ? payload.backups : [],
    retention: Math.max(0, Number(payload.retention || 0)),
    current: payload.current && typeof payload.current === 'object' ? payload.current : null
  };
}

export async function createPrivateStateBackup(state, label = '') {
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/private-state/backups'), {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ label: String(label || '') }),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível criar o backup privado');
}

export async function restorePrivateStateBackup(state, key) {
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/private-state/backups/restore'), {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ key: String(key || ''), expectedRevision: activeSession.privateRevision }),
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível restaurar o backup privado');
  activeSession.privateRevision = String(payload.revision || '');
  return {
    found: Boolean(payload.found && payload.state),
    state: payload.state && typeof payload.state === 'object' ? payload.state : null,
    revision: activeSession.privateRevision,
    updatedAt: String(payload.updatedAt || ''),
    integrity: payload.integrity && typeof payload.integrity === 'object' ? payload.integrity : null
  };
}

export async function diagnosePrivateStorageIntegrity(state) {
  const { profile, token } = requireSession(state, ['admin', 'director']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/private-state/integrity'), {
    method: 'GET',
    headers: jsonHeaders(token),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível verificar a integridade do armazenamento privado');
}

export function mergePrivatePortalState(publicState, privatePayload) {
  if (!privatePayload?.found || !privatePayload.state) return cloneValue(publicState || {});
  return mergePublicAndPrivatePortalState(publicState, privatePayload.state);
}

export function hasActiveSecureStorageSession(state, role = '') {
  const profile = secureStorageProfileFromState(state);
  if (!profile.enabled) return false;
  return activeSession.workerUrl === profile.workerUrl
    && activeSession.token
    && (!role || activeSession.role === role)
    && activeSession.expiresAt > Date.now() + SESSION_REFRESH_MARGIN_MS;
}

function requireSession(state, allowedRoles = []) {
  const profile = secureStorageProfileFromState(state);
  if (!profile.enabled) throw new Error('O armazenamento privado de anexos ainda não foi configurado.');
  if (
    activeSession.workerUrl !== profile.workerUrl
    || !activeSession.token
    || activeSession.expiresAt <= Date.now()
  ) {
    throw new Error('A sessão dos anexos privados expirou. Saia e entre novamente no painel.');
  }
  if (allowedRoles.length && !allowedRoles.includes(activeSession.role)) {
    throw new Error('Este perfil não possui permissão para executar esta operação nos anexos.');
  }
  return { profile, token: activeSession.token };
}

async function uploadAttachmentBlob(state, movement, attachment, blob) {
  const { profile, token } = requireSession(state, ['admin']);
  const form = new FormData();
  form.set('movementId', String(movement?.id || ''));
  form.set('attachmentId', String(attachment?.id || ''));
  form.set('name', String(attachment?.name || 'Documento'));
  form.set('originalSize', String(Math.max(0, Number(attachment?.originalSize || attachment?.size || blob.size || 0))));
  form.set('optimized', String(Boolean(attachment?.optimized)));
  form.set('file', blob, String(attachment?.name || 'documento'));

  const response = await fetch(apiUrl(profile.workerUrl, '/api/attachments/upload'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível enviar o anexo ao armazenamento privado');
  return cleanR2Attachment({
    ...attachment,
    storage: R2_STORAGE_KIND,
    objectKey: payload.objectKey,
    checksum: payload.checksum,
    uploadedAt: payload.uploadedAt,
    size: payload.size || blob.size,
    type: payload.type || blob.type
  });
}

async function attachmentBlob(attachment, { baseUrl } = {}) {
  const dataUrl = String(attachment?.dataUrl || attachment?.content || '').trim();
  if (dataUrl.startsWith('data:')) return dataUrlToBlob(dataUrl);

  const legacyUrl = absoluteLegacyUrl(attachment?.url || attachment?.reference, baseUrl);
  if (!legacyUrl) throw new Error(`O anexo “${attachment?.name || 'Documento'}” não possui uma origem válida para migração.`);
  const response = await fetch(legacyUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o anexo público “${attachment?.name || 'Documento'}” para migrá-lo (${response.status}).`);
  }
  return response.blob();
}

export async function prepareSecureTreasuryAttachmentsForPublication(state, options = {}) {
  const profile = secureStorageProfileFromState(state);
  const preparedState = cloneValue(state || {});
  if (!profile.enabled) {
    return {
      state: preparedState,
      enabled: false,
      convertedCount: 0,
      uploadedObjectKeys: [],
      deletedPublicPaths: []
    };
  }

  requireSession(state, ['admin']);
  const uploadedObjectKeys = [];
  const deletedPublicPaths = new Set();
  let convertedCount = 0;

  try {
    preparedState.treasury = [];
    for (const movement of Array.isArray(state?.treasury) ? state.treasury : []) {
      const attachments = [];
      for (const attachment of Array.isArray(movement?.attachments) ? movement.attachments : []) {
        if (isSecureTreasuryAttachment(attachment)) {
          const clean = cleanR2Attachment(attachment);
          if (clean) attachments.push(clean);
          continue;
        }

        const blob = await attachmentBlob(attachment, options);
        const uploaded = await uploadAttachmentBlob(state, movement, attachment, blob);
        if (!uploaded) throw new Error(`O Worker retornou dados inválidos ao migrar “${attachment?.name || 'Documento'}”.`);
        attachments.push(uploaded);
        uploadedObjectKeys.push(uploaded.objectKey);
        const legacyPath = legacyTreasuryAttachmentPath(attachment);
        if (legacyPath) deletedPublicPaths.add(legacyPath);
        convertedCount += 1;
      }
      preparedState.treasury.push({ ...movement, attachments });
    }
  } catch (error) {
    if (uploadedObjectKeys.length) {
      await deleteSecureTreasuryObjects(state, uploadedObjectKeys).catch(() => {});
    }
    throw error;
  }

  return {
    state: preparedState,
    enabled: true,
    convertedCount,
    uploadedObjectKeys,
    deletedPublicPaths: [...deletedPublicPaths]
  };
}

export async function requestSecureAttachmentAccess(state, attachment, disposition = 'inline') {
  const { profile, token } = requireSession(state, ['admin', 'director']);
  if (!isSecureTreasuryAttachment(attachment)) {
    throw new Error('Este anexo ainda não foi migrado para o armazenamento privado.');
  }
  const response = await fetch(apiUrl(profile.workerUrl, '/api/attachments/access'), {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      objectKey: attachment.objectKey,
      filename: attachment.name || 'documento',
      disposition: disposition === 'attachment' ? 'attachment' : 'inline'
    }),
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível autorizar o acesso ao anexo');
  if (!payload.url) throw new Error('O Worker não retornou o endereço temporário do anexo.');
  return payload.url;
}

export async function deleteSecureTreasuryObjects(state, objectKeys) {
  const keys = [...new Set((Array.isArray(objectKeys) ? objectKeys : []).filter(key => SAFE_OBJECT_KEY.test(String(key || ''))))];
  if (!keys.length) return { deleted: 0 };
  const { profile, token } = requireSession(state, ['admin']);
  const response = await fetch(apiUrl(profile.workerUrl, '/api/attachments'), {
    method: 'DELETE',
    headers: jsonHeaders(token),
    body: JSON.stringify({ objectKeys: keys }),
    cache: 'no-store'
  });
  return readJson(response, 'Não foi possível remover os anexos privados antigos');
}
