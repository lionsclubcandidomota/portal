import { cloneState } from '../../core/portal-state.js?v=6.39.0';
import { preparePortalMediaForPublication } from '../../core/portal-media.js?v=6.39.0';
import { buildPublicationMessage } from './domain.js?v=6.39.0';
import { ACCESS_CAPABILITIES, roleHasCapability } from './authorization.js?v=6.39.0';

export function createPublicationActions(context, privateSync = null) {
  const { dependencies, services, model } = context;

  const createSafetySnapshot = async (reason, label, metadata = {}) => {
    await dependencies.recoveryCenter?.createAutomaticSnapshot?.({
      state: context.currentState(),
      reason,
      label,
      metadata: { pendingChanges: model.pendingChanges, ...metadata }
    });
  };

  const ensurePrivateStateSaved = async () => {
    if (!privateSync?.flush || model.privateSavePending <= 0) return { ok: true };
    const result = await privateSync.flush();
    if (result?.ok) return result;
    throw result?.error || new Error('Os dados privados ainda não foram gravados no banco.');
  };

  const discardPendingChanges = async ({ skipConfirmation = false } = {}) => {
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.DISCARD_DATA)) {
      dependencies.toast?.('Este perfil não pode descartar alterações administrativas.');
      return { ok: false, reason: 'read-only' };
    }
    if (model.pendingChanges === 0) {
      dependencies.toast?.('Não há alterações públicas pendentes para descartar.');
      return { ok: false, reason: 'no-pending' };
    }
    if (!model.lastSyncedState) {
      dependencies.toast?.('Não foi encontrada uma cópia sincronizada para restaurar.');
      return { ok: false, reason: 'missing-synced-state' };
    }

    const approved = skipConfirmation || await dependencies.confirmation?.askConfirmation({
      title: 'Descartar alterações públicas pendentes?',
      message: `${model.pendingChanges} alteração(ões) públicas ainda não foram publicadas. Os dados privados já salvos no banco serão preservados.`,
      icon: '↩️',
      confirmText: 'Descartar alterações públicas',
      tone: 'danger'
    });
    if (!approved) return { ok: false, reason: 'cancelled' };

    try {
      await ensurePrivateStateSaved();
      await createSafetySnapshot(
        'before-discard',
        'Antes de descartar alterações públicas pendentes',
        { auditBatchId: model.pendingAuditBatchId || '' }
      );
    } catch (error) {
      dependencies.toast?.(error?.message || 'Não foi possível proteger os dados antes do descarte.');
      return { ok: false, reason: 'snapshot-failed', error };
    }

    const discardedBatchId = model.pendingAuditBatchId || dependencies.auditLog?.activeBatchId?.();
    context.replaceCurrentState(cloneState(model.lastSyncedState));
    services.saveState(context.currentState());
    model.pendingChanges = 0;
    model.pendingAuditBatchId = '';
    dependencies.auditLog?.closeBatch?.(discardedBatchId, 'discarded', 'Alterações públicas locais descartadas.');
    model.lastSyncInfo = null;
    context.storeSyncMeta();
    context.publishStatus(model.adminUnlocked ? 'synced' : 'offline');
    dependencies.applySettings();
    dependencies.renderCurrentView();
    dependencies.toast?.('Alterações públicas descartadas. Os dados privados salvos no banco foram mantidos.');
    return { ok: true, reason: 'discarded' };
  };

  const commitPendingChanges = async (commitMessage = '') => {
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.PUBLISH_DATA)) {
      dependencies.toast?.('Este perfil não pode publicar alterações.');
      return { ok: false, reason: 'read-only' };
    }
    if (!model.adminUnlocked || !services.hasActiveSecureStorageSession?.(context.currentState(), 'admin')) {
      dependencies.toast?.('Entre novamente como Administrador para publicar o conteúdo público.');
      return { ok: false, reason: 'unauthenticated' };
    }
    if (model.pendingChanges === 0) {
      dependencies.toast?.('Não há alterações públicas pendentes.');
      return { ok: false, reason: 'no-pending' };
    }

    try {
      await ensurePrivateStateSaved();
      await createSafetySnapshot(
        'before-publication',
        'Antes de publicar alterações públicas',
        { auditBatchId: model.pendingAuditBatchId || '' }
      );
    } catch (error) {
      dependencies.toast?.(error?.message || 'Não foi possível concluir o salvamento privado antes da publicação.');
      return { ok: false, reason: 'snapshot-failed', error };
    }

    dependencies.openPublishCenter?.();
    const count = model.pendingChanges;
    const message = buildPublicationMessage(count, commitMessage);
    const review = context.pendingPublicationReview();
    const auditBatchId = model.pendingAuditBatchId || dependencies.auditLog?.ensurePendingBatch?.({
      review,
      message: 'Alterações públicas consolidadas antes da publicação.'
    }) || '';
    model.pendingAuditBatchId = auditBatchId;
    context.publishStatus('syncing');

    try {
      const currentState = context.sanitizeCurrentState();
      services.saveState(currentState);
      const publicState = services.createPublicPortalState?.(currentState) || currentState;
      const publication = preparePortalMediaForPublication(publicState);
      const deletedPublicPaths = [...model.pendingDeletedPublicPaths];
      const result = await services.publishPublicPortalState(
        context.currentState(),
        publication.state,
        {
          expectedDataSha: model.githubFileSha,
          commitMessage: message,
          mediaAssets: publication.assets,
          deletedPaths: deletedPublicPaths
        }
      );

      model.githubFileSha = result.sha;
      model.lastSyncInfo = result;
      model.pendingChanges = 0;
      model.pendingAuditBatchId = '';
      model.privateMigrationPending = false;
      model.pendingDeletedPublicPaths.clear();
      dependencies.auditLog?.linkPublication?.(auditBatchId, { ...result, message });

      const privateState = services.createPrivatePortalState?.(context.currentState()) || {};
      const mergedState = services.mergePublicAndPrivatePortalState?.(publication.state, privateState)
        || publication.state;
      context.replaceCurrentState(mergedState);
      services.saveState(context.currentState());
      context.storeSyncedState(context.currentState());
      context.storeSyncMeta();

      context.setRemoteVersion(result.deploymentId);
      context.setAwaitingDeployment(result.deploymentId);

      model.latestCommitInfo = {
        sha: result.commitSha || '',
        url: result.commitUrl || '',
        date: result.committedAt || '',
        message
      };

      const uploadedFileCount = Number(result.mediaCount || 0);
      const uploadSummary = uploadedFileCount > 0
        ? `Conteúdo público enviado com ${uploadedFileCount} arquivo(s); atualizando visitantes`
        : 'Conteúdo público enviado; atualizando visitantes';
      context.publishStatus('publishing', uploadSummary);
      dependencies.toast?.({ type: 'info', title: 'Publicação enviada', message: uploadSummary });
      if (dependencies.getCurrentView?.() === 'admin') dependencies.renderAdmin?.();

      services.waitForPagesDeployment(result.deploymentId, {
        timeout: 120000,
        interval: 4000
      })
        .then(publicationResult => {
          model.lastSyncInfo = { ...model.lastSyncInfo, ...publicationResult };
          context.setAwaitingDeployment('');
          dependencies.auditLog?.confirmPublication?.(result.deploymentId, publicationResult.publishedAt);
          context.storeSyncMeta();
          context.publishStatus('published');
          dependencies.toast?.({ type: 'success', title: 'Portal público sincronizado', message: 'As alterações públicas já estão disponíveis para os visitantes.' });
          if (dependencies.getCurrentView?.() === 'admin') dependencies.renderAdmin?.();
        })
        .catch(() => {
          context.publishStatus('publishing', 'Envio concluído; propagação pública em andamento');
          if (dependencies.getCurrentView?.() === 'admin') dependencies.renderAdmin?.();
        });

      return { ok: true, reason: 'published', result };
    } catch (error) {
      console.error(error);
      context.publishStatus('error');
      dependencies.toast?.(error?.message || 'Falha ao sincronizar o conteúdo público com o GitHub.');
      return { ok: false, reason: 'error', error };
    }
  };

  return {
    commitPendingChanges,
    discardPendingChanges
  };
}
