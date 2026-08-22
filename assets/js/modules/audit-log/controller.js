import { buildPublicationReview } from '../publication-review-domain.js?v=6.52.0';
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
} from './domain.js?v=6.52.0';
import { createAuditLogStore } from './storage.js?v=6.52.0';

let auditLogViewPromise = null;

function loadAuditLogView() {
  if (!auditLogViewPromise) {
    auditLogViewPromise = import('./view.js?v=6.52.0')
      .then(module => module.auditLogHtml)
      .catch(error => {
        auditLogViewPromise = null;
        throw error;
      });
  }
  return auditLogViewPromise;
}

function auditLogLoadingHtml() {
  return `<section class="feature-loading" role="status" aria-live="polite">
    <span class="feature-loading-spinner" aria-hidden="true"></span>
    <div><strong>Carregando histórico</strong><small>Organizando as alterações registradas…</small></div>
  </section>`;
}

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

  const renderOpenView = async ({ initial = false } = {}) => {
    const placeholder = initial
      ? modalController.open('Histórico de alterações', auditLogLoadingHtml())
      : modalController.body;
    try {
      const auditLogHtml = await loadAuditLogView();
      if (placeholder?.isConnected === false) return;
      const model = {
        summary: auditLogSummary(entries),
        batches: groupAuditBatches(entries, { status: filter, query }),
        filter,
        query
      };
      const body = modalController.setContent(auditLogHtml(model));
      body.querySelector('#auditLogFilter')?.addEventListener('change', event => {
        filter = event.currentTarget.value;
        void renderOpenView();
      });
      body.querySelector('#auditLogSearch')?.addEventListener('input', event => {
        query = event.currentTarget.value;
        const position = Number(event.currentTarget.selectionStart || 0);
        void renderOpenView().then(() => {
          const input = modalController.body.querySelector('#auditLogSearch');
          input?.focus();
          input?.setSelectionRange(position, position);
        });
      });
      body.querySelector('#auditLogExport')?.addEventListener('click', exportHistory);
    } catch (error) {
      console.error('Falha ao carregar o histórico de alterações.', error);
      if (placeholder?.isConnected !== false) {
        modalController.setContent('<section class="empty-state" role="alert"><div class="empty-icon" aria-hidden="true">!</div><h3>Histórico indisponível</h3><p>Feche esta janela e tente novamente.</p></section>');
      }
    }
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
