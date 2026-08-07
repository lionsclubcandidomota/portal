export function createDatabaseSyncIndicator(elements) {
  if (!elements?.chip || !elements.icon || !elements.label || !elements.detail) {
    throw new TypeError('createDatabaseSyncIndicator requer os elementos do indicador.');
  }
  const { chip, icon, label, detail } = elements;

  const setStatus = (status = 'idle', message = '') => {
    const safeStatus = ['saving', 'saved', 'error', 'warning', 'idle'].includes(status) ? status : 'idle';
    chip.hidden = safeStatus === 'idle';
    chip.classList.toggle('is-saving', safeStatus === 'saving');
    chip.classList.toggle('is-error', safeStatus === 'error');
    chip.classList.toggle('is-warning', safeStatus === 'warning');
    chip.disabled = safeStatus !== 'error';
    icon.textContent = safeStatus === 'saving' ? '↻' : safeStatus === 'error' ? '!' : safeStatus === 'warning' ? '•' : '✓';
    label.textContent = safeStatus === 'saving'
      ? 'Salvando no banco'
      : safeStatus === 'error'
        ? 'Falha ao salvar'
        : safeStatus === 'warning'
          ? 'Banco pendente'
          : 'Banco sincronizado';
    detail.textContent = message || (safeStatus === 'saved' ? 'Dados privados salvos' : '');
    chip.title = safeStatus === 'error'
      ? 'Clique para tentar salvar novamente'
      : detail.textContent || label.textContent;
  };

  const bindRetry = callback => {
    chip.addEventListener('click', () => {
      if (chip.classList.contains('is-error')) callback?.();
    });
  };

  return { bindRetry, setStatus };
}
