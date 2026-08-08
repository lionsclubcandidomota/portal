import {
  createRecoverySnapshot,
  diagnosePortalIntegrity,
  mergeRecoveryAreas,
  summarizePortalState,
  verifyRecoverySnapshot
} from './domain.js?v=6.44.1';
import { createRecoverySnapshotStore } from './storage.js?v=6.44.1';
import {
  recoveryCenterHtml,
  recoveryLoadingHtml,
  recoveryRestoreHtml
} from './view.js?v=6.44.1';

function snapshotDownload(snapshot) {
  const blob = new Blob([JSON.stringify(snapshot.payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `backup-recuperacao-lions-${snapshot.createdAt.slice(0, 10)}-${snapshot.id.slice(-8)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function createRecoveryCenterController({
  getState,
  modalController,
  confirmation,
  toast,
  onRestore,
  onSummaryChange,
  storeFactory = createRecoverySnapshotStore,
  storageEstimate = () => globalThis.navigator?.storage?.estimate?.()
} = {}) {
  if (typeof getState !== 'function') throw new TypeError('createRecoveryCenterController requer getState().');
  if (!modalController) throw new TypeError('createRecoveryCenterController requer modalController.');
  if (typeof onRestore !== 'function') throw new TypeError('createRecoveryCenterController requer onRestore().');

  let store = null;
  let snapshots = [];
  let diagnostic = diagnosePortalIntegrity(getState());
  let estimate = null;
  let initialized = false;

  const loadSnapshots = async () => {
    snapshots = await store.list();
    snapshots = snapshots.map(snapshot => {
      const verification = verifyRecoverySnapshot(snapshot);
      return {
        ...snapshot,
        integrity: { valid: verification.valid, errors: verification.errors }
      };
    });
    return snapshots;
  };

  const notifySummary = () => onSummaryChange?.(getSummary());

  const initialize = async () => {
    if (initialized) return;
    store = await storeFactory();
    await loadSnapshots();
    try {
      estimate = await storageEstimate?.() || null;
    } catch {
      estimate = null;
    }
    diagnostic = diagnosePortalIntegrity(getState());
    initialized = true;
    notifySummary();
  };

  const ensureReady = async () => {
    if (!initialized) await initialize();
  };

  const getSummary = () => ({
    snapshots: snapshots.length,
    latestAt: snapshots[0]?.createdAt || '',
    diagnosticStatus: diagnostic.status,
    errors: diagnostic.errors,
    warnings: diagnostic.warnings,
    storageMode: store?.mode || ''
  });

  const createSnapshot = async ({
    state = getState(),
    reason = 'manual',
    label = '',
    metadata = {},
    quiet = false,
    deduplicate = true
  } = {}) => {
    await ensureReady();
    const snapshot = createRecoverySnapshot({ state, reason, label, metadata });
    const recentDuplicate = snapshots.find(item => item.reason === reason && item.checksum === snapshot.checksum);
    if (deduplicate && recentDuplicate) return recentDuplicate;

    await store.put(snapshot);
    await loadSnapshots();
    notifySummary();
    if (!quiet) toast?.('Ponto de recuperação criado com sucesso.');
    return snapshot;
  };

  const createAutomaticSnapshot = options => createSnapshot({
    ...options,
    quiet: true,
    deduplicate: true
  });

  const refreshDiagnostic = () => {
    diagnostic = diagnosePortalIntegrity(getState());
    notifySummary();
    return diagnostic;
  };

  const renderOverview = ({ initial = false } = {}) => {
    const html = recoveryCenterHtml({
      snapshots,
      diagnostic,
      storageMode: store?.mode || '',
      storageEstimate: estimate
    });
    const body = initial
      ? modalController.open('Recuperação e integridade', html)
      : modalController.setContent(html);
    bindOverview(body);
  };

  const openRestore = async id => {
    const snapshot = snapshots.find(item => item.id === id);
    if (!snapshot) return;
    const verification = verifyRecoverySnapshot(snapshot);
    if (!verification.valid) {
      toast?.('Este ponto não passou na verificação de integridade.');
      return;
    }

    const body = modalController.setContent(recoveryRestoreHtml({
      snapshot,
      currentSummary: summarizePortalState(getState())
    }));
    body.querySelector('#recoveryRestoreBack')?.addEventListener('click', () => renderOverview());
    body.querySelector('#recoverySelectNone')?.addEventListener('click', () => {
      body.querySelectorAll('input[name="recoveryArea"]').forEach(input => { input.checked = false; });
    });
    body.querySelector('#recoveryRestoreForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const selected = [...new FormData(event.currentTarget).getAll('recoveryArea')];
      if (!selected.length) {
        toast?.('Selecione pelo menos uma área para restaurar.');
        return;
      }
      const approved = await confirmation?.askConfirmation({
        title: 'Restaurar áreas selecionadas?',
        message: `${selected.length} área(s) serão substituídas pela versão de ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(snapshot.createdAt))}.`,
        icon: '↶',
        confirmText: 'Criar ponto e restaurar',
        tone: 'warning'
      });
      if (!approved) return;

      try {
        await createAutomaticSnapshot({
          reason: 'before-restore',
          label: `Antes de restaurar ${snapshot.label}`,
          metadata: { restoredSnapshotId: snapshot.id, selectedAreas: selected }
        });
        const nextState = mergeRecoveryAreas(getState(), verification.state, selected);
        await onRestore(nextState, {
          snapshot,
          selectedAreas: selected,
          message: `Restauração seletiva de ${selected.length} área(s).`
        });
        refreshDiagnostic();
        modalController.close({ restoreFocus: false });
        toast?.('Áreas restauradas. Revise e publique as alterações quando estiver pronto.');
      } catch (error) {
        toast?.(error?.message || 'Não foi possível concluir a restauração.');
      }
    });
  };

  const deleteSnapshot = async id => {
    const snapshot = snapshots.find(item => item.id === id);
    if (!snapshot) return;
    const approved = await confirmation?.askConfirmation({
      title: 'Excluir ponto de recuperação?',
      message: 'Este ponto será removido somente deste navegador e não poderá ser restaurado depois.',
      icon: '🗑️',
      confirmText: 'Excluir ponto',
      tone: 'danger'
    });
    if (!approved) return;
    await store.remove(id);
    await loadSnapshots();
    notifySummary();
    renderOverview();
    toast?.('Ponto de recuperação excluído.');
  };

  function bindOverview(body) {
    body.querySelector('#createRecoverySnapshotBtn')?.addEventListener('click', async () => {
      try {
        await createSnapshot({ reason: 'manual', label: 'Ponto criado pelo administrador' });
        renderOverview();
      } catch (error) {
        toast?.(error?.message || 'Não foi possível criar o ponto de recuperação.');
      }
    });
    body.querySelector('#refreshRecoveryDiagnosticBtn')?.addEventListener('click', () => {
      refreshDiagnostic();
      renderOverview();
      toast?.('Diagnóstico de integridade atualizado.');
    });
    body.querySelectorAll('[data-recovery-restore]').forEach(button => {
      button.addEventListener('click', () => openRestore(button.dataset.recoveryRestore));
    });
    body.querySelectorAll('[data-recovery-export]').forEach(button => {
      button.addEventListener('click', () => {
        const snapshot = snapshots.find(item => item.id === button.dataset.recoveryExport);
        if (snapshot) snapshotDownload(snapshot);
      });
    });
    body.querySelectorAll('[data-recovery-delete]').forEach(button => {
      button.addEventListener('click', () => deleteSnapshot(button.dataset.recoveryDelete));
    });
  }

  const open = async () => {
    modalController.open('Recuperação e integridade', recoveryLoadingHtml());
    try {
      await ensureReady();
      refreshDiagnostic();
      renderOverview();
    } catch (error) {
      modalController.setContent('<div class="recovery-empty"><span aria-hidden="true">!</span><h3>Recuperação indisponível</h3><p>O navegador não permitiu abrir o armazenamento local de recuperação.</p></div>');
      toast?.('Não foi possível abrir a área de recuperação.');
    }
  };

  return {
    createAutomaticSnapshot,
    createSnapshot,
    getSummary,
    initialize,
    open,
    refreshDiagnostic
  };
}
