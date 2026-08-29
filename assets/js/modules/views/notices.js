import { els, icon, escapeHtml, formatDate, simpleMarkdown, empty, state, lastUpdateText } from '../core.js';
import { publicNotices, historicalNotices } from '../model.js';

function noticeSection(title, subtitle, items, prefix, openFirst = false) {
  return `<section class="notice-section">
    <div class="card-header notice-section-header"><div><h3>${icon(prefix === 'history' ? 'clock' : 'megaphone')} ${title}</h3><div class="card-subtitle">${subtitle}</div></div></div>
    ${items.length ? `<div class="notices-list">${items.map((notice, index) => `<article class="notice-card ${prefix === 'history' ? 'notice-card-history' : ''}">
      <button class="notice-summary" type="button" data-notice-toggle="${prefix}-${index}" aria-expanded="${openFirst && index === 0 ? 'true' : 'false'}">
        <span class="notice-icon">${icon(prefix === 'history' ? 'clock' : 'megaphone')}</span>
        <span><strong>${escapeHtml(notice.title)}</strong><small>${formatDate(notice.date)}${notice.endDate ? ` até ${formatDate(notice.endDate)}` : ''}</small></span>
        <span class="priority">${escapeHtml(prefix === 'history' ? 'Encerrado' : (notice.priority || 'Normal'))}</span>
      </button>
      <div class="notice-details markdown" data-notice-details="${prefix}-${index}" ${openFirst && index === 0 ? '' : 'hidden'}>${simpleMarkdown(notice.text)}</div>
    </article>`).join('')}</div>` : empty(prefix === 'history' ? 'Nenhum aviso anterior publicado.' : 'Nenhum aviso ativo no momento.')}
  </section>`;
}

export function toggleNotice(id) {
  const details = document.querySelector(`[data-notice-details="${CSS.escape(id)}"]`);
  const button = document.querySelector(`[data-notice-toggle="${CSS.escape(id)}"]`);
  if (!details || !button) return;
  const open = !details.hidden;
  details.hidden = open;
  button.setAttribute('aria-expanded', String(!open));
}

export function renderNotices() {
  const active = publicNotices();
  const history = historicalNotices();
  const logo = escapeHtml(state.data?.settings?.logo || './public/logo.png');
  els.root.innerHTML = `
    <section class="hero hero-impact hero-impact-clean section-hero-home notices-hero-home">
      <div class="hero-watermark" aria-hidden="true"><img src="${logo}" alt=""></div>
      <div class="hero-content">
        <span class="hero-eyebrow">Comunicados do clube</span>
        <div class="hero-kicker">Informações públicas</div>
        <h2>Avisos públicos</h2>
        <p>Consulte os comunicados atuais e o histórico recente do clube.</p>
        <div class="hero-meta"><span class="pill">${icon('refresh')} ${escapeHtml(lastUpdateText())}</span></div>
        <div class="hero-chip-row notice-summary-chips" aria-label="Resumo dos avisos"><span class="hero-chip">${icon('megaphone')} Ativos: ${active.length}</span><span class="hero-chip">${icon('clock')} Histórico: ${history.length}</span></div>
      </div>
      <div class="hero-badge hero-badge-impact section-hero-badge" aria-hidden="true">
        <div class="hero-logo-wrap"><img src="${logo}" alt=""></div>
        <div class="hero-seal-copy"><strong>Nós Servimos</strong><small>Distrito LB 1</small></div>
      </div>
    </section>
    ${noticeSection('Avisos atuais', 'Comunicados que ainda estão em vigor ou visíveis ao público.', active, 'active', true)}
    ${noticeSection('Histórico de avisos', 'Avisos anteriores, preservados para consulta pública.', history, 'history', active.length === 0)}`;
}
