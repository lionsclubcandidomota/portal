import {
  createRecoverySnapshot,
  diagnosePortalIntegrity,
  mergeRecoveryAreas,
  summarizePortalState,
  verifyRecoverySnapshot
} from './domain.js?v=6.38.0';
import { createRecoverySnapshotStore } from './storage.js?v=6.38.0';
import {
  recoveryCenterHtml,
  recoveryLoadingHtml,
  recoveryRestoreHtml
} from './view.js?v=6.38.0';

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
  remoteRecovery = null,
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
  let remote = {
    available: false,
    loading: false,
    canWrite: false,
    backups: [],
    retention: 0,
    current: null,
    diagnostic: null,
    storage: null,
    error: ''
  };

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

  const remoteAvailable = () => Boolean(remoteRecovery?.isAvailable?.());

  const loadRemote = async () => {
    if (!remoteAvailable()) {
      remote = { ...remote, available: false, loading: false, canWrite: false, backups: [], current: null, diagnostic: null, storage: null, error: '' };
      return remote;
    }
    remote = { ...remote, available: true, loading: true, canWrite: Boolean(remoteRecovery?.canWrite?.()), error: '' };
    try {
      const [storage, backupPayload, diagnostic] = await Promise.all([
        Promise.resolve(remoteRecovery.status?.() || null).catch(() => null),
        remoteRecovery.listBackups(),
        remoteRecovery.diagnose()
      ]);
      remote = {
        available: true,
        loading: false,
        canWrite: Boolean(remoteRecovery?.canWrite?.()),
        backups: Array.isArray(backupPayload?.backups) ? backupPayload.backups : [],
        retention: Math.max(0, Number(backupPayload?.retention || 0)),
        current: backupPayload?.current || null,
        diagnostic: diagnostic || null,
        storage: storage || null,
        error: ''
      };
    } catch (error) {
      remote = { ...remote, available: true, loading: false, error: error?.message || 'Não foi possível consultar o R2.' };
    }
    return remote;
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
    storageMode: store?.mode || '',
    remoteStatus: remote.diagnostic?.status || (remote.error ? 'error' : remote.available ? 'unknown' : 'offline'),
    remoteBackups: remote.backups.length
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
      storageEstimate: estimate,
      remote
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

  const createRemoteBackup = async () => {
    if (!remote.canWrite) return;
    try {
      await remoteRecovery.createBackup('Backup manual criado pela Central de Recuperação');
      await loadRemote();
      renderOverview();
      toast?.('Backup privado criado no Cloudflare R2.');
    } catch (error) {
      toast?.(error?.message || 'Não foi possível criar o backup privado.');
    }
  };

  const restoreRemoteBackup = async key => {
    if (!remote.canWrite) return;
    const backup = remote.backups.find(item => item.key === key);
    if (!backup) return;
    const approved = await confirmation?.askConfirmation({
      title: 'Restaurar backup privado do R2?',
      message: 'A Tesouraria, as contas e as configurações privadas voltarão para a versão selecionada. Um backup de segurança do estado atual será criado automaticamente.',
      icon: '☁️',
      confirmText: 'Criar proteção e restaurar',
      tone: 'warning'
    });
    if (!approved) return;
    try {
      const payload = await remoteRecovery.restoreBackup(key);
      await remoteRecovery.applyRestoredState(payload, {
        message: 'Backup privado restaurado diretamente no Cloudflare R2.',
        successMessage: 'Tesouraria restaurada e sincronizada com o R2.'
      });
      await loadRemote();
      refreshDiagnostic();
      renderOverview();
    } catch (error) {
      toast?.(error?.message || 'Não foi possível restaurar o backup privado.');
    }
  };


  const migrateRemoteToD1 = async () => {
    if (!remote.canWrite || !remoteRecovery?.migrateToD1) return;
    const approved = await confirmation?.askConfirmation({
      title: 'Migrar o estado privado para o D1?',
      message: 'O Portal criará um backup no R2, copiará contas, movimentações, grupos, mútuas e configurações para o banco D1 e passará a utilizá-lo como fonte principal. O R2 continuará como espelho e armazenamento dos anexos.',
      icon: '🗄️',
      confirmText: 'Criar backup e migrar',
      tone: 'warning'
    });
    if (!approved) return;
    try {
      const result = await remoteRecovery.migrateToD1();
      await loadRemote();
      renderOverview();
      toast?.(result?.mirrorWarning
        ? `Migração concluída no D1. Atenção: ${result.mirrorWarning}`
        : 'Migração concluída. O D1 agora é a fonte principal dos dados privados.');
    } catch (error) {
      toast?.(error?.message || 'Não foi possível migrar os dados privados para o D1.');
    }
  };

  const rollbackRemoteToR2 = async () => {
    if (!remote.canWrite || !remoteRecovery?.rollbackToR2) return;
    const approved = await confirmation?.askConfirmation({
      title: 'Retornar temporariamente ao R2?',
      message: 'O estado atual do D1 será copiado para o R2 antes da troca. O banco não será apagado e poderá ser ativado novamente por uma nova migração.',
      icon: '↩️',
      confirmText: 'Copiar estado e retornar',
      tone: 'danger'
    });
    if (!approved) return;
    try {
      await remoteRecovery.rollbackToR2();
      await loadRemote();
      renderOverview();
      toast?.('O Portal voltou temporariamente a utilizar o estado privado do R2.');
    } catch (error) {
      toast?.(error?.message || 'Não foi possível retornar ao armazenamento do R2.');
    }
  };

  function bindOverview(body) {
    body.querySelector('#refreshPrivateRecoveryBtn')?.addEventListener('click', async () => {
      await loadRemote();
      renderOverview();
      if (!remote.error) toast?.('Integridade do armazenamento privado atualizada.');
    });
    body.querySelector('#createPrivateBackupBtn')?.addEventListener('click', createRemoteBackup);
    body.querySelector('#migratePrivateStorageD1Btn')?.addEventListener('click', migrateRemoteToD1);
    body.querySelector('#rollbackPrivateStorageR2Btn')?.addEventListener('click', rollbackRemoteToR2);
    body.querySelectorAll('[data-private-backup-restore]').forEach(button => {
      button.addEventListener('click', () => restoreRemoteBackup(button.dataset.privateBackupRestore));
    });
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
      await loadRemote();
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
