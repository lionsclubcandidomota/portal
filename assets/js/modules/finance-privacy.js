import { uiIcon } from './visual-helpers.js?v=6.49.1';

export function createFinancePrivacyController() {
  let hidden = sessionStorage.getItem('lions.finance.hidden') === '1';

  function sync() {
    document.body.classList.toggle('finance-values-hidden', hidden);

    document.querySelectorAll('[data-finance-privacy]').forEach(button => {
      const compact = button.classList.contains('is-compact');
      const label = hidden ? 'Mostrar valores' : 'Ocultar valores';
      const icon = hidden ? 'eye-off' : 'eye';

      button.setAttribute('aria-pressed', String(hidden));
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.innerHTML = `<span aria-hidden="true">${uiIcon(icon)}</span>${compact ? '' : `<span>${label}</span>`}`;
    });
  }

  function toggle() {
    hidden = !hidden;

    sessionStorage.setItem(
      'lions.finance.hidden',
      hidden ? '1' : '0'
    );

    sync();
  }

  function buttonHtml({ compact = false } = {}) {
    const label = hidden ? 'Mostrar valores' : 'Ocultar valores';
    const icon = hidden ? 'eye-off' : 'eye';

    return `
      <button
        type="button"
        class="btn btn-ghost btn-sm finance-privacy-btn${compact ? ' is-compact' : ''}"
        data-finance-privacy
        aria-label="${label}"
        title="${label}"
        aria-pressed="${hidden}"
      >
        <span aria-hidden="true">${uiIcon(icon)}</span>${compact ? '' : `<span>${label}</span>`}
      </button>
    `;
  }

  function bind(scope = document) {
    scope
      .querySelectorAll('[data-finance-privacy]')
      .forEach(button => {
        button.addEventListener('click', toggle);
      });

    sync();
  }

  function isHidden() {
    return hidden;
  }

  return {
    sync,
    toggle,
    buttonHtml,
    bind,
    isHidden
  };
}