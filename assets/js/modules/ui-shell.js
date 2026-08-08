export function createUiShellController({
  toastRegion,
  clock,
  currentDate,
  fullDateFormat,
  confirmAccept,
  confirmSecondary,
  confirmModal,
  confirmation,
  closeModal,
  closeSidebar,
  shareBirthday
}) {
  if (!toastRegion) throw new TypeError('createUiShellController requer toastRegion.');
  if (typeof fullDateFormat?.format !== 'function') throw new TypeError('createUiShellController requer fullDateFormat.');

  let bound = false;

  const toast = (notification, options = {}) => {
    const source = notification && typeof notification === 'object'
      ? notification
      : { message: notification, ...options };
    const normalizedMessage = String(source.message || '').toLocaleLowerCase('pt-BR');
    const inferredType = /falha|erro|não foi possível|inválid|excede|sem espaço/.test(normalizedMessage)
      ? 'error'
      : /atenção|pendente|bloquead|interrompid|não há|não pode|descartar/.test(normalizedMessage)
        ? 'warning'
        : /sucesso|concluíd|liberad|atualizad|adicionad|salv[ao]|publicad|sincronizad|removid|configurad/.test(normalizedMessage)
          ? 'success'
          : 'info';
    const type = ['success', 'info', 'warning', 'error'].includes(source.type) ? source.type : inferredType;
    const defaults = {
      success: { icon: '✓', title: 'Operação concluída' },
      info: { icon: 'i', title: 'Informação' },
      warning: { icon: '!', title: 'Atenção' },
      error: { icon: '×', title: 'Não foi possível concluir' }
    };
    const duration = Math.max(1800, Number(source.duration || (type === 'error' ? 6200 : 4200)));
    const element = document.createElement('article');
    element.className = `portal-toast is-${type}`;
    element.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
    element.setAttribute('aria-atomic', 'true');

    const icon = document.createElement('span');
    icon.className = 'portal-toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = source.icon || defaults[type].icon;

    const copy = document.createElement('div');
    copy.className = 'portal-toast-copy';
    const title = document.createElement('strong');
    title.textContent = String(source.title || defaults[type].title);
    const message = document.createElement('p');
    message.textContent = String(source.message || '');
    copy.append(title, message);

    const close = document.createElement('button');
    close.className = 'portal-toast-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar notificação');
    close.textContent = '×';

    const progress = document.createElement('span');
    progress.className = 'portal-toast-progress';
    progress.style.setProperty('--toast-duration', `${duration}ms`);

    element.append(icon, copy, close, progress);
    toastRegion.appendChild(element);

    let timer = 0;
    const remove = () => {
      window.clearTimeout(timer);
      element.classList.add('is-leaving');
      window.setTimeout(() => element.remove(), 180);
    };
    close.addEventListener('click', remove);
    timer = window.setTimeout(remove, duration);
    return { close: remove, element };
  };

  const updateClock = () => {
    const now = new Date();
    if (clock) {
      clock.textContent = now.toLocaleTimeString('pt-BR');
      clock.dateTime = now.toISOString();
    }
    if (currentDate) currentDate.textContent = fullDateFormat.format(now);
  };

  const setupBackToTop = () => {
    let button = document.getElementById('backToTopBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'backToTopBtn';
      button.className = 'back-to-top';
      button.type = 'button';
      button.setAttribute('aria-label', 'Voltar para o início da página');
      button.innerHTML = '<span aria-hidden="true">↑</span><span>Topo</span>';
      document.body.appendChild(button);
    }

    const sync = () => button.classList.toggle('is-visible', window.scrollY > 520);
    window.addEventListener('scroll', sync, { passive: true });
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    sync();
  };

  const handleDocumentClick = event => {
    const modalClose = event.target.closest('[data-close-modal]');
    if (modalClose) closeModal?.();

    const birthdayShare = event.target.closest('[data-birthday-share]');
    if (birthdayShare) {
      event.preventDefault();
      shareBirthday?.(birthdayShare.dataset.birthdayShare);
      return;
    }

    const cardToggle = event.target.closest('[data-card-toggle]');
    if (cardToggle) {
      event.preventDefault();
      const card = cardToggle.closest('[data-expandable-card]');
      const details = card?.querySelector('.expandable-record-details');
      if (card && details) {
        const expanded = card.classList.toggle('is-expanded');
        details.hidden = !expanded;
        cardToggle.setAttribute('aria-expanded', String(expanded));
      }
      return;
    }

    const structuredToggle = event.target.closest('[data-structured-toggle]');
    if (!structuredToggle) return;

    event.preventDefault();
    event.stopPropagation();
    const box = structuredToggle.closest('[data-structured-text]');
    if (!box) return;
    const expanded = box.classList.toggle('expanded');
    structuredToggle.textContent = expanded ? 'Ver menos' : 'Ver mais';
    structuredToggle.setAttribute('aria-expanded', String(expanded));
  };

  const handleEscape = event => {
    if (event.key !== 'Escape') return;
    if (confirmModal && !confirmModal.hidden) confirmation?.closeConfirmModal(false);
    else closeModal?.();
    closeSidebar?.();
  };

  const bind = () => {
    if (bound) return;
    bound = true;

    confirmAccept?.addEventListener('click', () => confirmation?.closeConfirmModal('primary'));
    confirmSecondary?.addEventListener('click', () => confirmation?.closeConfirmModal('secondary'));
    confirmModal?.querySelectorAll('[data-close-confirm]').forEach(element => {
      element.addEventListener('click', () => confirmation?.closeConfirmModal(false));
    });

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);
    setupBackToTop();
  };

  return {
    bind,
    toast,
    updateClock
  };
}
