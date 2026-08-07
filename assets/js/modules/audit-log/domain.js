export const AUDIT_LOG_SCHEMA_VERSION = 1;
export const AUDIT_LOG_MAX_ENTRIES = 400;

const STATUS_ORDER = Object.freeze({ pending: 0, published: 1, confirmed: 2, discarded: 3, replaced: 4 });

function text(value, limit = 300) {
  const normalized = String(value ?? '').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit).trim()}…` : normalized;
}

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function createAuditId(prefix = 'audit') {
  const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${randomId}`;
}

export function normalizeAuditActor(actor = {}) {
  const safeActor = actor && typeof actor === 'object' ? actor : {};
  const login = text(safeActor.login || safeActor.username || '', 80);
  const name = text(safeActor.name || safeActor.displayName || '', 120);
  return {
    id: text(safeActor.id || '', 80),
    login,
    name: name || login || 'Administrador',
    avatarUrl: /^https:\/\//i.test(String(safeActor.avatarUrl || safeActor.avatar_url || ''))
      ? String(safeActor.avatarUrl || safeActor.avatar_url)
      : ''
  };
}

function sanitizeField(field = {}) {
  return {
    label: text(field.label || field.field || 'Campo', 120),
    before: text(field.before || 'Não informado'),
    after: text(field.after || 'Não informado')
  };
}

function sanitizeChange(change = {}) {
  return {
    type: ['added', 'updated', 'removed'].includes(change.type) ? change.type : 'updated',
    title: text(change.title || 'Registro alterado', 180),
    description: text(change.description || '', 220),
    fields: Array.isArray(change.fields) ? change.fields.map(sanitizeField).slice(0, 30) : []
  };
}

export function sanitizeAuditReview(review = {}) {
  const groups = Array.isArray(review.groups) ? review.groups.map(group => ({
    key: text(group.key || '', 80),
    title: text(group.title || 'Área alterada', 140),
    icon: text(group.icon || '•', 8),
    changes: Array.isArray(group.changes) ? group.changes.map(sanitizeChange).slice(0, 50) : []
  })).filter(group => group.changes.length) : [];

  return {
    total: groups.reduce((sum, group) => sum + group.changes.length, 0),
    fieldsTotal: groups.reduce((sum, group) => sum + group.changes.reduce((subtotal, change) => subtotal + change.fields.length, 0), 0),
    groups
  };
}

export function createAuditEntry({
  message,
  review,
  actor,
  batchId,
  now = new Date().toISOString(),
  id = createAuditId('change')
} = {}) {
  const sanitizedReview = sanitizeAuditReview(review);
  if (!sanitizedReview.total) return null;

  return {
    id: text(id, 160),
    batchId: text(batchId || createAuditId('publication'), 160),
    createdAt: String(now),
    action: text(message || 'Alteração registrada', 180),
    actor: normalizeAuditActor(actor),
    status: 'pending',
    review: sanitizedReview,
    publication: null,
    outcome: null
  };
}

export function normalizeAuditEntry(entry = {}) {
  const status = Object.hasOwn(STATUS_ORDER, entry.status) ? entry.status : 'pending';
  return {
    id: text(entry.id || createAuditId('change'), 160),
    batchId: text(entry.batchId || createAuditId('publication'), 160),
    createdAt: entry.createdAt || new Date().toISOString(),
    action: text(entry.action || 'Alteração registrada', 180),
    actor: normalizeAuditActor(entry.actor),
    status,
    review: sanitizeAuditReview(entry.review),
    publication: entry.publication ? {
      commitSha: text(entry.publication.commitSha || '', 80),
      commitUrl: /^https:\/\//i.test(String(entry.publication.commitUrl || '')) ? String(entry.publication.commitUrl) : '',
      committedAt: entry.publication.committedAt || '',
      confirmedAt: entry.publication.confirmedAt || '',
      deploymentId: text(entry.publication.deploymentId || '', 180),
      message: text(entry.publication.message || '', 240)
    } : null,
    outcome: entry.outcome ? {
      at: entry.outcome.at || '',
      reason: text(entry.outcome.reason || '', 240)
    } : null
  };
}

export function normalizeAuditEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map(normalizeAuditEntry)
    .filter(entry => entry.review.total > 0)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, AUDIT_LOG_MAX_ENTRIES);
}

export function pendingAuditBatchId(entries) {
  return normalizeAuditEntries(entries).find(entry => entry.status === 'pending')?.batchId || '';
}

export function updateAuditBatch(entries, batchId, update) {
  const normalized = normalizeAuditEntries(entries);
  return normalized.map(entry => {
    if (entry.batchId !== batchId) return entry;
    return normalizeAuditEntry(typeof update === 'function' ? update(clone(entry)) : { ...entry, ...update });
  });
}

export function linkAuditPublication(entries, batchId, publication = {}) {
  return updateAuditBatch(entries, batchId, entry => ({
    ...entry,
    status: 'published',
    publication: {
      commitSha: publication.commitSha || '',
      commitUrl: publication.commitUrl || '',
      committedAt: publication.committedAt || new Date().toISOString(),
      confirmedAt: '',
      deploymentId: publication.deploymentId || '',
      message: publication.message || ''
    },
    outcome: null
  }));
}

export function confirmAuditPublication(entries, deploymentId, confirmedAt = new Date().toISOString()) {
  return normalizeAuditEntries(entries).map(entry => {
    if (!entry.publication || entry.publication.deploymentId !== deploymentId) return entry;
    return normalizeAuditEntry({
      ...entry,
      status: 'confirmed',
      publication: { ...entry.publication, confirmedAt }
    });
  });
}

export function closeAuditBatch(entries, batchId, status = 'discarded', reason = '') {
  const safeStatus = ['discarded', 'replaced'].includes(status) ? status : 'discarded';
  return updateAuditBatch(entries, batchId, entry => ({
    ...entry,
    status: safeStatus,
    outcome: { at: new Date().toISOString(), reason }
  }));
}

export function auditLogSummary(entries) {
  const normalized = normalizeAuditEntries(entries);
  const batches = new Map();
  normalized.forEach(entry => {
    if (!batches.has(entry.batchId)) batches.set(entry.batchId, []);
    batches.get(entry.batchId).push(entry);
  });

  const statuses = { pending: 0, published: 0, confirmed: 0, discarded: 0, replaced: 0 };
  for (const batchEntries of batches.values()) {
    const status = batchEntries.map(entry => entry.status).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b])[0] || 'pending';
    statuses[status] += 1;
  }

  return {
    operations: normalized.length,
    publications: statuses.published + statuses.confirmed,
    pendingBatches: statuses.pending,
    discardedBatches: statuses.discarded + statuses.replaced,
    latestAt: normalized[0]?.createdAt || '',
    latestAction: normalized[0]?.action || ''
  };
}

export function groupAuditBatches(entries, { status = 'all', query = '' } = {}) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('pt-BR');
  const batches = new Map();

  for (const entry of normalizeAuditEntries(entries)) {
    if (!batches.has(entry.batchId)) batches.set(entry.batchId, []);
    batches.get(entry.batchId).push(entry);
  }

  return [...batches.entries()].map(([batchId, batchEntries]) => {
    const sorted = [...batchEntries].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const batchStatus = sorted.map(entry => entry.status).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b])[0] || 'pending';
    const publication = sorted.find(entry => entry.publication)?.publication || null;
    const searchable = sorted.flatMap(entry => [
      entry.action,
      entry.actor.name,
      entry.actor.login,
      ...entry.review.groups.flatMap(group => [group.title, ...group.changes.map(change => change.title)])
    ]).join(' ').toLocaleLowerCase('pt-BR');

    return {
      batchId,
      status: batchStatus,
      createdAt: sorted.at(-1)?.createdAt || sorted[0]?.createdAt || '',
      updatedAt: sorted[0]?.createdAt || '',
      actor: sorted[0]?.actor || normalizeAuditActor(),
      entries: sorted,
      operations: sorted.length,
      changes: sorted.reduce((sum, entry) => sum + entry.review.total, 0),
      publication,
      outcome: sorted.find(entry => entry.outcome)?.outcome || null,
      searchable
    };
  }).filter(batch => {
    const statusMatches = status === 'all'
      || (status === 'published' && ['published', 'confirmed'].includes(batch.status))
      || batch.status === status;
    return statusMatches && (!normalizedQuery || batch.searchable.includes(normalizedQuery));
  }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function createAuditExport(entries) {
  return {
    app: 'Portal Lions — Histórico de alterações',
    schemaVersion: AUDIT_LOG_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entries: normalizeAuditEntries(entries)
  };
}
