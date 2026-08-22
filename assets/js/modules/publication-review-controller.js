let publicationReviewPromise = null;

function loadPublicationReviewHtml() {
  if (!publicationReviewPromise) {
    publicationReviewPromise = import('./publication-review.js?v=6.52.0')
      .then(module => module.publicationReviewHtml)
      .catch(error => {
        publicationReviewPromise = null;
        throw error;
      });
  }
  return publicationReviewPromise;
}

function loadingReview() {
  return `<section class="feature-loading" role="status" aria-live="polite">
    <span class="feature-loading-spinner" aria-hidden="true"></span>
    <div><strong>Preparando revisão</strong><small>Organizando as alterações pendentes…</small></div>
  </section>`;
}

function reviewError() {
  return `<section class="empty-state" role="alert">
    <div class="empty-icon" aria-hidden="true">⚠️</div>
    <h3>Não foi possível abrir a revisão</h3>
    <p>Feche esta janela e tente novamente.</p>
  </section>`;
}

export function createPublicationReviewController({ modalController, runtime }) {
  const bindActions = body => {
    body.querySelectorAll('[data-publication-review-close]').forEach(button => {
      button.addEventListener('click', () => modalController.close());
    });
    body.querySelector('[data-publication-review-publish]')?.addEventListener('click', () => {
      modalController.close({ restoreFocus: false });
      runtime.commitPendingChanges();
    });
  };

  const open = async () => {
    const body = modalController.open(
      'Revisar alterações antes da publicação',
      loadingReview()
    );

    try {
      const publicationReviewHtml = await loadPublicationReviewHtml();
      if (!body.isConnected) return;
      const review = runtime.getPendingPublicationReview();
      const canPublish = Boolean(runtime.canWrite && runtime.githubToken && runtime.pendingChanges > 0);
      body.innerHTML = publicationReviewHtml(review, { canPublish });
      bindActions(body);
    } catch (error) {
      console.error('Falha ao carregar a revisão de publicação.', error);
      if (body.isConnected) body.innerHTML = reviewError();
    }
  };

  return { load: loadPublicationReviewHtml, open };
}
