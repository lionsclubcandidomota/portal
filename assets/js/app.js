import { bootstrapPortal } from './modules/portal-app.js?v=6.44.1';
import { enableHomologationReload } from './core/homologation-reload.js?v=6.44.1';

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
  bindStaticImageFallbacks();

  try {
    await bootstrapPortal();
  } catch (error) {
    console.error('Não foi possível iniciar o Portal Lions.', error);
    document.body.classList.remove('app-loading');

    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `<div class="card empty-state" role="alert">
        <div class="empty-icon" aria-hidden="true">⚠️</div>
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
