import { bootstrapPortal } from './modules/portal-app.js?v=6.52.3';
import { enableHomologationReload } from './core/homologation-reload.js?v=6.52.3';
import { uiIcon } from './modules/visual-helpers.js?v=6.52.3';


const PORTAL_THEME_KEY = 'lions.portal.theme';

function storedTheme() {
  const value = localStorage.getItem(PORTAL_THEME_KEY);
  return value === 'dark' || value === 'light' ? value : '';
}

function applyPortalTheme(theme = storedTheme() || 'light') {
  const resolved = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolved;
  const toggle = document.getElementById('themeToggle');
  const dark = resolved === 'dark';
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
    toggle.title = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
    const icon = toggle.querySelector('[data-theme-icon]');
    const label = toggle.querySelector('[data-theme-label]');
    if (icon) icon.textContent = dark ? '☀' : '☾';
    if (label) label.textContent = dark ? 'Claro' : 'Escuro';
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = dark ? '#0d1724' : '#00529B';
  return resolved;
}

function bindPortalTheme() {
  const toggle = document.getElementById('themeToggle');
  applyPortalTheme();
  toggle?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(PORTAL_THEME_KEY, next);
    applyPortalTheme(next);
  });
}

function bindStaticImageFallbacks() {
  const sidebarLogo = document.getElementById('sidebarLogo');
  const fallbackLogo = document.getElementById('fallbackLogo');
  if (sidebarLogo && fallbackLogo) {
    sidebarLogo.addEventListener('error', () => {
      sidebarLogo.hidden = true;
      fallbackLogo.style.display = 'grid';
    });
  }

  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    const fallback = image.dataset.photoFallback;
    if (!fallback || image.dataset.photoFallbackUsed === 'true') return;

    image.dataset.photoFallbackUsed = 'true';
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.src = fallback;
  }, true);
}

async function startPortal() {
  bindPortalTheme();
  bindStaticImageFallbacks();

  try {
    await bootstrapPortal();
  } catch (error) {
    console.error('Não foi possível iniciar o Portal Lions.', error);
    document.body.classList.remove('app-loading');

    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `<div class="card empty-state" role="alert">
        <div class="empty-icon" aria-hidden="true">${uiIcon('warning')}</div>
        <h2>Não foi possível carregar o portal</h2>
        <p>Atualize a página. Se o problema continuar, verifique a conexão e tente novamente.</p>
        <button class="btn btn-primary" type="button" data-reload-portal>Atualizar página</button>
      </div>`;
      root.querySelector('[data-reload-portal]')?.addEventListener('click', () => location.reload());
    }
  }
}

enableHomologationReload();
startPortal();
