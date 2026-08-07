const STATUS_LABELS = {
  offline: 'Somente local',
  pending: 'Alterações públicas pendentes',
  syncing: 'Criando commit…',
  publishing: 'Publicando no site…',
  published: 'Disponível no site',
  synced: 'Sincronizado',
  error: 'Falha na sincronização'
};

const DEFAULT_EDIT_AUTOCLOSE_MS = 4800;
const SUCCESS_VISIBILITY_MS = 5200;

function formatSyncDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(new Date(iso));
}

export function createPublishCenterController({
  panel,
  title,
  detail,
  popoverTitle,
  popoverDetail,
  bar,
  count,
  toggle,
  closeButton,
  reviewButton,
  reviewSummary,
  sendButton,
  discardButton,
  getAdminUnlocked,
  getPendingChanges,
  getGithubToken,
  getLastSyncInfo,
  getPendingReview,
  onReview,
  onPublish,
  onDiscard
}) {
  if (!panel) throw new TypeError('createPublishCenterController requer panel.');
  if (!title || !detail || !bar) throw new TypeError('A central de publicação está incompleta.');
  if (typeof getAdminUnlocked !== 'function') throw new TypeError('createPublishCenterController requer getAdminUnlocked().');
  if (typeof getPendingChanges !== 'function') throw new TypeError('createPublishCenterController requer getPendingChanges().');
  if (typeof getGithubToken !== 'function') throw new TypeError('createPublishCenterController requer getGithubToken().');
  if (typeof getLastSyncInfo !== 'function') throw new TypeError('createPublishCenterController requer getLastSyncInfo().');

  let status = 'offline';
  let statusMessage = '';
  let minimized = true;
  let concealed = false;
  let bound = false;
  let autoCloseTimer = 0;
  let successHideTimer = 0;
  let attentionTimer = 0;
  let attentionMessage = '';
  let busyDismissed = false;

  const statusIcon = panel.querySelector('.publish-progress-icon');
  const popoverStatusIcon = panel.querySelector('.sync-popover-status-icon');
  const flowSteps = [...panel.querySelectorAll('[data-sync-step]')];

  const clearAutoClose = () => {
    if (!autoCloseTimer) return;
    window.clearTimeout(autoCloseTimer);
    autoCloseTimer = 0;
  };

  const clearSuccessHide = () => {
    if (!successHideTimer) return;
    window.clearTimeout(successHideTimer);
    successHideTimer = 0;
  };

  const clearAttention = ({ renderAfter = false } = {}) => {
    if (attentionTimer) window.clearTimeout(attentionTimer);
    attentionTimer = 0;
    attentionMessage = '';
    panel.classList.remove('is-refresh-blocked');
    if (renderAfter) render();
  };

  const renderStatusLabels = () => {
    document.querySelectorAll('.sync-status-label').forEach(label => {
      label.textContent = statusMessage || STATUS_LABELS[status] || status;
      label.className = `sync-status-label badge ${['synced', 'published'].includes(status) ? 'badge-success' : status === 'error' ? 'badge-danger' : status === 'pending' ? 'badge-warning' : 'badge-info'}`;
    });
  };

  const render = () => {
    renderStatusLabels();

    const adminUnlocked = getAdminUnlocked();
    const pendingChanges = Number(getPendingChanges() || 0);
    const githubToken = getGithubToken();
    const lastSyncInfo = getLastSyncInfo();
    const pendingReview = typeof getPendingReview === 'function' ? getPendingReview() : null;
    const reviewCount = Number(pendingReview?.total || 0);
    const reviewAreaCount = Number(pendingReview?.groups?.length || 0);
    const displayCount = reviewCount > 0 ? reviewCount : pendingChanges;
    const isBusy = ['syncing', 'publishing'].includes(status);
    const isComplete = status === 'published' && pendingChanges === 0;
    const isError = status === 'error';

    panel.hidden = !adminUnlocked || (concealed && pendingChanges === 0 && !isBusy && !isError);
    if (panel.hidden) return;

    panel.classList.toggle('is-minimized', minimized);
    panel.classList.toggle('is-complete', isComplete);
    panel.classList.toggle('is-error', isError);
    panel.classList.toggle('is-busy', isBusy);
    panel.classList.toggle('has-pending', pendingChanges > 0);
    panel.classList.toggle('is-reminder', pendingChanges > 0 && minimized);
    toggle?.setAttribute('aria-expanded', String(!minimized));
    if (closeButton) {
      closeButton.setAttribute('aria-label', isBusy ? 'Minimizar sincronização em andamento' : 'Minimizar central de sincronização');
      closeButton.title = isBusy ? 'Minimizar sem interromper' : 'Minimizar';
    }

    const stepState = status === 'syncing'
      ? 'send'
      : status === 'publishing' || status === 'published' || status === 'synced'
        ? 'publish'
        : 'review';
    const stepOrder = ['review', 'send', 'publish'];
    const activeIndex = stepOrder.indexOf(stepState);
    flowSteps.forEach(step => {
      const index = stepOrder.indexOf(step.dataset.syncStep);
      step.classList.toggle('is-active', index === activeIndex);
      step.classList.toggle('is-complete', index < activeIndex || ['published', 'synced'].includes(status));
    });

    if (count) {
      count.hidden = pendingChanges === 0;
      count.textContent = String(displayCount);
    }

    let percent = 0;
    if (attentionMessage && pendingChanges > 0) {
      percent = 12;
      title.textContent = 'Atualização bloqueada';
      detail.textContent = attentionMessage;
      if (statusIcon) statusIcon.textContent = '!';
    } else if (status === 'syncing') {
      percent = 35;
      title.textContent = 'Salvando alterações';
      detail.textContent = 'Criando a atualização no GitHub…';
      if (statusIcon) statusIcon.textContent = '↻';
    } else if (status === 'publishing') {
      percent = 88;
      title.textContent = 'Publicando alterações';
      detail.textContent = statusMessage || 'O envio foi concluído. Finalizando a atualização pública…';
      if (statusIcon) statusIcon.textContent = '↑';
    } else if (status === 'synced') {
      percent = 100;
      title.textContent = 'Portal sincronizado';
      detail.textContent = lastSyncInfo?.publishedAt
        ? `Última publicação em ${formatSyncDate(lastSyncInfo.publishedAt)}.`
        : 'Nenhuma alteração pendente.';
      if (statusIcon) statusIcon.textContent = '✓';
    } else if (status === 'published') {
      percent = 100;
      title.textContent = 'Publicação concluída';
      detail.textContent = 'As informações já estão disponíveis no portal.';
      if (statusIcon) statusIcon.textContent = '✓';
    } else if (status === 'error') {
      percent = 100;
      title.textContent = 'Falha na publicação';
      detail.textContent = statusMessage || 'As alterações continuam salvas neste navegador.';
      if (statusIcon) statusIcon.textContent = '!';
    } else if (pendingChanges > 0) {
      percent = 12;
      title.textContent = `${displayCount} alteraç${displayCount === 1 ? 'ão' : 'ões'} pendente${displayCount === 1 ? '' : 's'}`;
      detail.textContent = attentionMessage || 'Publique somente o conteúdo público quando estiver pronto.';
      if (statusIcon) statusIcon.textContent = '•';
    } else {
      percent = 100;
      title.textContent = 'Portal sincronizado';
      detail.textContent = lastSyncInfo?.publishedAt
        ? `Última publicação em ${formatSyncDate(lastSyncInfo.publishedAt)}.`
        : 'Nenhuma alteração pendente.';
      if (statusIcon) statusIcon.textContent = '✓';
    }

    if (popoverStatusIcon) {
      const icon = isError ? '!' : isBusy ? '↻' : pendingChanges > 0 ? '•' : '✓';
      popoverStatusIcon.textContent = icon;
      popoverStatusIcon.className = `sync-popover-status-icon ${isError ? 'is-error' : isBusy ? 'is-busy' : pendingChanges > 0 ? 'is-pending' : 'is-success'}`;
    }
    if (popoverTitle) popoverTitle.textContent = title.textContent;
    if (popoverDetail) popoverDetail.textContent = detail.textContent;
    bar.style.width = `${percent}%`;
    bar.parentElement?.setAttribute('aria-valuenow', String(percent));

    if (reviewButton) {
      reviewButton.hidden = pendingChanges === 0 && !isError;
      reviewButton.disabled = pendingChanges === 0 || isBusy;
    }
    if (reviewSummary) {
      reviewSummary.textContent = reviewCount > 0
        ? `${reviewCount} alteraç${reviewCount === 1 ? 'ão' : 'ões'} em ${reviewAreaCount} área${reviewAreaCount === 1 ? '' : 's'}`
        : pendingChanges > 0
          ? 'Revise apenas o conteúdo que ficará público'
          : 'Nenhuma alteração pública para revisar';
    }

    if (sendButton) {
      sendButton.disabled = !githubToken || pendingChanges === 0 || isBusy;
      sendButton.textContent = status === 'syncing'
        ? 'Salvando…'
        : status === 'publishing'
          ? 'Publicando…'
          : 'Publicar conteúdo público';
    }
    if (discardButton) discardButton.disabled = pendingChanges === 0 || isBusy;
  };

  const scheduleAutoClose = (delay = DEFAULT_EDIT_AUTOCLOSE_MS) => {
    clearAutoClose();
    if (!delay) return;
    autoCloseTimer = window.setTimeout(() => {
      autoCloseTimer = 0;
      minimized = true;
      render();
    }, delay);
  };

  const scheduleSuccessHide = (delay = SUCCESS_VISIBILITY_MS) => {
    clearSuccessHide();
    successHideTimer = window.setTimeout(() => {
      successHideTimer = 0;
      concealed = true;
      minimized = true;
      render();
    }, delay);
  };

  const open = ({ autoCloseAfter = 0 } = {}) => {
    concealed = false;
    minimized = false;
    busyDismissed = false;
    clearSuccessHide();
    render();
    if (autoCloseAfter) scheduleAutoClose(autoCloseAfter);
  };

  const close = ({ focus = true } = {}) => {
    clearAutoClose();
    if (['syncing', 'publishing'].includes(status)) busyDismissed = true;
    minimized = true;
    render();
    if (focus && minimized) toggle?.focus();
  };

  const toggleOpen = () => {
    concealed = false;
    minimized = !minimized;
    if (!minimized) busyDismissed = false;
    clearSuccessHide();
    if (!minimized) clearAutoClose();
    render();
  };

  const setStatus = (nextStatus, message = '') => {
    status = nextStatus;
    statusMessage = message;

    if (nextStatus !== 'pending') clearAttention();

    if (nextStatus === 'pending') {
      concealed = false;
      busyDismissed = false;
      clearSuccessHide();
    } else if (['syncing', 'publishing'].includes(nextStatus)) {
      concealed = false;
      if (!busyDismissed) minimized = false;
      clearAutoClose();
      clearSuccessHide();
    } else if (nextStatus === 'error') {
      concealed = false;
      minimized = false;
      busyDismissed = false;
      clearAutoClose();
      clearSuccessHide();
    } else if (nextStatus === 'published') {
      busyDismissed = false;
      concealed = false;
      minimized = true;
      clearAutoClose();
      render();
      scheduleSuccessHide();
      return;
    }

    render();
  };

  const requestAttention = ({ message = '', focus = true, duration = 6200 } = {}) => {
    clearAttention();
    concealed = false;
    minimized = false;
    attentionMessage = String(message || 'Existem dados não sincronizados. Conclua a sincronização antes de atualizar o painel.');
    panel.classList.add('is-refresh-blocked');
    clearAutoClose();
    clearSuccessHide();
    render();

    if (focus) {
      window.setTimeout(() => {
        const target = sendButton && !sendButton.disabled
          ? sendButton
          : reviewButton && !reviewButton.disabled
            ? reviewButton
            : toggle;
        target?.focus();
      }, 0);
    }

    attentionTimer = window.setTimeout(() => {
      attentionTimer = 0;
      attentionMessage = '';
      panel.classList.remove('is-refresh-blocked');
      render();
    }, duration);
  };

  const bind = () => {
    if (bound) return;
    bound = true;

    toggle?.addEventListener('click', event => {
      event.stopPropagation();
      toggleOpen();
    });
    closeButton?.addEventListener('click', () => close());
    reviewButton?.addEventListener('click', event => {
      event.stopPropagation();
      onReview?.();
    });
    sendButton?.addEventListener('click', () => onPublish?.());
    discardButton?.addEventListener('click', () => onDiscard?.());

    document.addEventListener('click', event => {
      if (minimized || panel.contains(event.target)) return;
      close({ focus: false });
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || minimized) return;
      close();
    });
  };

  return {
    bind,
    close,
    getStatus: () => status,
    isMinimized: () => minimized,
    open,
    refresh: render,
    requestAttention,
    setStatus,
    toggle: toggleOpen
  };
}
