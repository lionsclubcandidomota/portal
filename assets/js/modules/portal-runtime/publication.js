import { cloneState } from '../../core/portal-state.js?v=6.28.0';
import { preparePortalMediaForPublication } from '../../core/portal-media.js?v=6.28.0';
import { buildPublicationMessage } from './domain.js?v=6.28.0';
import { ACCESS_CAPABILITIES, roleHasCapability } from './authorization.js?v=6.28.0';

export function createPublicationActions(context) {
  const { dependencies, services, model } = context;

  const createSafetySnapshot = async (reason, label, metadata = {}) => {
    await dependencies.recoveryCenter?.createAutomaticSnapshot?.({
      state: context.currentState(),
      reason,
      label,
      metadata: { pendingChanges: model.pendingChanges, ...metadata }
    });
  };

  const discardPendingChanges = async ({ skipConfirmation = false } = {}) => {
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.DISCARD_DATA)) {
      dependencies.toast?.('Este perfil não pode descartar alterações administrativas.');
      return { ok: false, reason: 'read-only' };
    }
    if (model.pendingChanges === 0) {
      dependencies.toast?.('Não há alterações pendentes para descartar.');
      return { ok: false, reason: 'no-pending' };
    }
    if (!model.lastSyncedState) {
      dependencies.toast?.('Não foi encontrada uma cópia sincronizada para restaurar.');
      return { ok: false, reason: 'missing-synced-state' };
    }

    const approved = skipConfirmation || await dependencies.confirmation?.askConfirmation({
      title: 'Descartar alterações pendentes?',
      message: `${model.pendingChanges} alteração(ões) ainda não foram publicadas. O portal voltará para a última versão sincronizada e esta ação não poderá ser desfeita.`,
      icon: '↩️',
      confirmText: 'Descartar alterações',
      tone: 'danger'
    });
    if (!approved) return { ok: false, reason: 'cancelled' };

    try {
      await createSafetySnapshot(
        'before-discard',
        'Antes de descartar alterações pendentes',
        { auditBatchId: model.pendingAuditBatchId || '' }
      );
    } catch (error) {
      dependencies.toast?.(error?.message || 'Não foi possível criar o ponto de recuperação. O descarte foi cancelado.');
      return { ok: false, reason: 'snapshot-failed', error };
    }

    const discardedBatchId = model.pendingAuditBatchId || dependencies.auditLog?.activeBatchId?.();
    context.replaceCurrentState(cloneState(model.lastSyncedState));
    services.saveState(context.currentState());
    model.pendingChanges = 0;
    model.pendingAuditBatchId = '';
    dependencies.auditLog?.closeBatch?.(discardedBatchId, 'discarded', 'Alterações locais descartadas antes da publicação.');
    model.lastSyncInfo = null;
    context.storeSyncMeta();
    context.publishStatus(model.adminUnlocked && model.githubToken ? 'synced' : 'offline');
    dependencies.applySettings();
    dependencies.renderCurrentView();
    dependencies.toast?.('Alterações pendentes descartadas.');
    return { ok: true, reason: 'discarded' };
  };

  const commitPendingChanges = async (commitMessage = '') => {
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.PUBLISH_DATA)) {
      dependencies.toast?.('Este perfil não pode publicar alterações.');
      return { ok: false, reason: 'read-only' };
    }
    if (!model.githubToken || !model.adminUnlocked) {
      dependencies.toast?.('Conecte o acesso administrativo ao GitHub.');
      return { ok: false, reason: 'unauthenticated' };
    }
    if (model.pendingChanges === 0) {
      dependencies.toast?.('Não há alterações pendentes.');
      return { ok: false, reason: 'no-pending' };
    }

    try {
      await createSafetySnapshot(
        'before-publication',
        'Antes de publicar alterações',
        { auditBatchId: model.pendingAuditBatchId || '' }
      );
    } catch (error) {
      dependencies.toast?.(error?.message || 'Não foi possível criar o ponto de recuperação. A publicação foi cancelada.');
      return { ok: false, reason: 'snapshot-failed', error };
    }

    dependencies.openPublishCenter?.();
    const count = model.pendingChanges;
    const message = buildPublicationMessage(count, commitMessage);
    const review = context.pendingPublicationReview();
    const auditBatchId = model.pendingAuditBatchId || dependencies.auditLog?.ensurePendingBatch?.({
      review,
      message: 'Alterações pendentes consolidadas antes da publicação.'
    }) || '';
    model.pendingAuditBatchId = auditBatchId;
    context.publishStatus('syncing');

    try {
      const state = context.sanitizeCurrentState();
      services.saveState(state);
      const publication = preparePortalMediaForPublication(state);
      const result = await services.saveGitHubState(
        model.githubToken,
        publication.state,
        model.githubFileSha,
        message,
        publication.assets
      );
      model.githubFileSha = result.sha;
      model.lastSyncInfo = result;
      model.pendingChanges = 0;
      model.pendingAuditBatchId = '';
      dependencies.auditLog?.linkPublication?.(auditBatchId, { ...result, message });
      context.replaceCurrentState(publication.state);
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

      const uploadSummary = result.mediaCount > 0
        ? `Envio concluído com ${result.mediaCount} arquivo(s); atualizando visitantes`
        : 'Envio concluído; atualizando visitantes';
      context.publishStatus('publishing', uploadSummary);
      dependencies.toast?.({ type: 'info', title: 'Publicação enviada', message: uploadSummary });
      if (dependencies.getCurrentView?.() === 'admin') dependencies.renderAdmin?.();

      services.waitForPagesDeployment(result.deploymentId, {
        timeout: 120000,
        interval: 4000
      })
        .then(publication => {
          model.lastSyncInfo = { ...model.lastSyncInfo, ...publication };
          context.setAwaitingDeployment('');
          dependencies.auditLog?.confirmPublication?.(result.deploymentId, publication.publishedAt);
          context.storeSyncMeta();
          context.publishStatus('published');
          dependencies.toast?.({ type: 'success', title: 'Portal sincronizado', message: 'As alterações já estão disponíveis para os visitantes.' });
          if (dependencies.getCurrentView?.() === 'admin') dependencies.renderAdmin?.();
        })
        .catch(() => {
          context.publishStatus('publishing', 'Envio concluído; propagação em andamento');
          if (dependencies.getCurrentView?.() === 'admin') dependencies.renderAdmin?.();
        });

      return { ok: true, reason: 'published', result };
    } catch (error) {
      console.error(error);
      context.publishStatus('error');
      dependencies.toast?.(error?.message || 'Falha ao sincronizar com o GitHub.');
      return { ok: false, reason: 'error', error };
    }
  };



  return {
    commitPendingChanges,
    discardPendingChanges
  };
}
