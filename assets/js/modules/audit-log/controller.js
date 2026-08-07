import { buildPublicationReview } from '../publication-review.js?v=6.26.0';
import {
  auditLogSummary,
  closeAuditBatch,
  confirmAuditPublication,
  createAuditEntry,
  createAuditExport,
  createAuditId,
  groupAuditBatches,
  linkAuditPublication,
  normalizeAuditActor,
  pendingAuditBatchId
} from './domain.js?v=6.26.0';
import { createAuditLogStore } from './storage.js?v=6.26.0';
import { auditLogHtml } from './view.js?v=6.26.0';

export function createAuditLogController({
  storage = globalThis.localStorage,
  modalController,
  toast
} = {}) {
  if (!modalController) throw new TypeError('createAuditLogController requer modalController.');
  const store = createAuditLogStore(storage);
  let entries = store.read();
  let actor = normalizeAuditActor();
  let filter = 'all';
  let query = '';

  const save = nextEntries => {
    entries = store.write(nextEntries);
    return entries;
  };

  const activeBatchId = () => pendingAuditBatchId(entries);

  const recordChange = ({ message, previousState, currentState, batchId = '' } = {}) => {
    const review = buildPublicationReview(previousState, currentState);
    const resolvedBatchId = batchId || activeBatchId() || createAuditId('publication');
    const entry = createAuditEntry({ message, review, actor, batchId: resolvedBatchId });
    if (!entry) return { batchId: resolvedBatchId, entry: null };
    save([entry, ...entries]);
    return { batchId: resolvedBatchId, entry };
  };

  const ensurePendingBatch = ({ review, message = 'Alterações pendentes consolidadas', batchId = '' } = {}) => {
    const existing = batchId || activeBatchId();
    if (existing) return existing;
    const resolvedBatchId = createAuditId('publication');
    const entry = createAuditEntry({ review, message, actor, batchId: resolvedBatchId });
    if (entry) save([entry, ...entries]);
    return resolvedBatchId;
  };

  const linkPublication = (batchId, publication) => {
    if (!batchId) return;
    save(linkAuditPublication(entries, batchId, publication));
  };

  const confirmPublication = (deploymentId, confirmedAt) => {
    if (!deploymentId) return;
    save(confirmAuditPublication(entries, deploymentId, confirmedAt));
  };

  const closeBatch = (batchId, status, reason) => {
    if (!batchId) return;
    save(closeAuditBatch(entries, batchId, status, reason));
  };

  const exportHistory = () => {
    const payload = createAuditExport(entries);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `historico-alteracoes-lions-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast?.('Histórico exportado.');
  };

  const renderOpenView = ({ initial = false } = {}) => {
    const model = {
      summary: auditLogSummary(entries),
      batches: groupAuditBatches(entries, { status: filter, query }),
      filter,
      query
    };
    const html = auditLogHtml(model);
    const body = initial
      ? modalController.open('Histórico de alterações', html)
      : modalController.setContent(html);
    body.querySelector('#auditLogFilter')?.addEventListener('change', event => {
      filter = event.currentTarget.value;
      renderOpenView();
    });
    body.querySelector('#auditLogSearch')?.addEventListener('input', event => {
      query = event.currentTarget.value;
      const position = Number(event.currentTarget.selectionStart || 0);
      renderOpenView();
      const input = modalController.body.querySelector('#auditLogSearch');
      input?.focus();
      input?.setSelectionRange(position, position);
    });
    body.querySelector('#auditLogExport')?.addEventListener('click', exportHistory);
  };

  const open = () => renderOpenView({ initial: true });

  return {
    activeBatchId,
    closeBatch,
    confirmPublication,
    ensurePendingBatch,
    exportHistory,
    getEntries: () => entries.map(entry => ({ ...entry })),
    getSummary: () => auditLogSummary(entries),
    linkPublication,
    open,
    recordChange,
    setActor: value => { actor = normalizeAuditActor(value); }
  };
}
