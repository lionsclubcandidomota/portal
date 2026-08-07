import { createPublishCenterController } from '../publish-center.js?v=6.38.0';
import { createPortalRefreshController } from '../portal-refresh.js?v=6.38.0';
import { createPublicationReviewController } from '../publication-review-controller.js?v=6.38.0';

export function createPublicationFeature({
  elements,
  modalController,
  confirmation,
  runtime,
  refreshButton,
  toast
}) {
  const review = createPublicationReviewController({ modalController, runtime });
  const publishCenter = createPublishCenterController({
    ...elements,
    getAdminUnlocked: runtime.isWriteAllowed,
    getPendingChanges: () => runtime.pendingChanges,
    getGithubToken: () => runtime.githubToken,
    getLastSyncInfo: () => runtime.lastSyncInfo,
    getPendingReview: () => runtime.getPendingPublicationReview(),
    onReview: review.open,
    onPublish: runtime.commitPendingChanges,
    onDiscard: runtime.discardPendingChanges
  });

  const portalRefresh = createPortalRefreshController({
    button: refreshButton,
    getPendingChanges: () => runtime.pendingChanges,
    refreshPortal: runtime.refreshPortalInterface,
    requestPendingDecision: ({ count, message }) => confirmation.askChoice({
      title: count === 1 ? 'Existe uma alteração pública pendente' : `Existem ${count} alterações públicas pendentes`,
      message,
      icon: '☁️',
      primaryText: 'Publicar conteúdo público',
      primaryTone: 'primary',
      secondaryText: 'Descartar alterações públicas',
      secondaryTone: 'danger-soft',
      cancelText: 'Cancelar atualização',
      tone: 'warning'
    }),
    publishPendingChanges: runtime.commitPendingChanges,
    discardPendingChanges: runtime.discardPendingChanges,
    toast
  });

  return { review, publishCenter, portalRefresh };
}
