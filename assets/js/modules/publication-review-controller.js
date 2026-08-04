import { publicationReviewHtml } from './publication-review.js?v=6.34.0';

export function createPublicationReviewController({ modalController, runtime }) {
  const open = () => {
    const review = runtime.getPendingPublicationReview();
    const canPublish = Boolean(runtime.canWrite && runtime.githubToken && runtime.pendingChanges > 0);
    const body = modalController.open(
      'Revisar alterações antes da publicação',
      publicationReviewHtml(review, { canPublish })
    );

    body.querySelectorAll('[data-publication-review-close]').forEach(button => {
      button.addEventListener('click', () => modalController.close());
    });
    body.querySelector('[data-publication-review-publish]')?.addEventListener('click', () => {
      modalController.close({ restoreFocus: false });
      runtime.commitPendingChanges();
    });
  };

  return { open };
}
