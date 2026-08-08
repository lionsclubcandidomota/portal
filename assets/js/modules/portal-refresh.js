export function createPortalRefreshController({
  button,
  getPendingChanges,
  refreshPortal,
  requestPendingDecision,
  publishPendingChanges,
  discardPendingChanges,
  toast
}) {
  if (!button) throw new TypeError('createPortalRefreshController requer button.');
  if (typeof getPendingChanges !== 'function') {
    throw new TypeError('createPortalRefreshController requer getPendingChanges().');
  }
  if (typeof refreshPortal !== 'function') {
    throw new TypeError('createPortalRefreshController requer refreshPortal().');
  }
  if (typeof requestPendingDecision !== 'function') {
    throw new TypeError('createPortalRefreshController requer requestPendingDecision().');
  }
  if (typeof publishPendingChanges !== 'function') {
    throw new TypeError('createPortalRefreshController requer publishPendingChanges().');
  }
  if (typeof discardPendingChanges !== 'function') {
    throw new TypeError('createPortalRefreshController requer discardPendingChanges().');
  }

  let bound = false;
  let running = false;
  const label = button.querySelector('[data-portal-refresh-label]');

  const pendingMessage = count => {
    const total = Number(count || 0);
    return total === 1
      ? 'Existe 1 alteração local ainda não publicada. Publique para mantê-la, descarte para restaurar a última versão sincronizada ou cancele a atualização.'
      : `Existem ${total} alterações locais ainda não publicadas. Publique para mantê-las, descarte para restaurar a última versão sincronizada ou cancele a atualização.`;
  };

  const setRunning = (value, text = 'Atualizando…') => {
    running = Boolean(value);
    button.disabled = running;
    button.classList.toggle('is-loading', running);
    button.setAttribute('aria-busy', String(running));
    if (label) label.textContent = running ? text : 'Atualizar Portal';
  };

  const resolvePendingChanges = async count => {
    setRunning(true, 'Aguardando decisão…');
    const decision = await requestPendingDecision({
      count: Number(count || 0),
      message: pendingMessage(count)
    });

    if (decision === 'cancel') {
      return { ok: false, reason: 'cancelled', pendingChanges: Number(count || 0) };
    }

    if (decision === 'primary') {
      setRunning(true, 'Publicando…');
      const publication = await publishPendingChanges();
      if (!publication?.ok) return publication || { ok: false, reason: 'publish-failed' };
      return { ok: true, reason: 'published' };
    }

    if (decision === 'secondary') {
      setRunning(true, 'Descartando…');
      const discard = await discardPendingChanges({ skipConfirmation: true });
      if (!discard?.ok) return discard || { ok: false, reason: 'discard-failed' };
      return { ok: true, reason: 'discarded' };
    }

    return { ok: false, reason: 'cancelled', pendingChanges: Number(count || 0) };
  };

  const executeRefresh = async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const pendingChanges = Number(getPendingChanges() || 0);
      if (pendingChanges > 0) {
        const resolution = await resolvePendingChanges(pendingChanges);
        if (!resolution?.ok) return resolution;
      }

      setRunning(true, 'Atualizando…');
      const result = await refreshPortal();
      if (result?.reason === 'pending') continue;
      return result;
    }

    return {
      ok: false,
      reason: 'pending',
      pendingChanges: Number(getPendingChanges() || 0)
    };
  };

  const run = async () => {
    if (running) return { ok: false, reason: 'busy' };

    try {
      const result = await executeRefresh();
      if (result?.reason === 'unauthenticated' || result?.reason === 'session-changed') {
        toast?.('A sessão administrativa mudou. Entre novamente para atualizar o painel.');
        return result;
      }
      if (result?.reason === 'pending') {
        toast?.('A atualização foi interrompida porque surgiram novas alterações pendentes.');
        return result;
      }
      if (result?.ok) {
        toast?.('Painel atualizado. Você permaneceu na mesma tela, com filtros e posição preservados.');
      }
      return result;
    } catch (error) {
      toast?.(error?.message || 'Não foi possível atualizar o painel. Verifique a conexão e tente novamente.');
      return { ok: false, reason: 'error', error };
    } finally {
      setRunning(false);
    }
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    button.addEventListener('click', run);
  };

  return {
    bind,
    isRunning: () => running,
    run
  };
}
