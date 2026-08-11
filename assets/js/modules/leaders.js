import { memberPhotoSourceSet } from '../core/member-photo-sources.js?v=6.46.7';
import {
  currentPublicLeaders,
  publicLeadershipSummary,
  publicLeadersForYear,
  availablePublicLionYears
} from '../core/public-leadership.js?v=6.46.7';
import { escapeHtml } from '../utils.js';
import { uiIcon } from './visual-helpers.js?v=6.46.7';
import { resolveDisplayLogo } from './settings-appearance.js?v=6.46.7';

export {
  currentPublicLeaders,
  publicLeadershipSummary,
  publicLeadersForYear,
  availablePublicLionYears
};

function leaderPhoto(member) {
  const name = String(member?.name || 'Dirigente').trim() || 'Dirigente';
  const photo = String(member?.photo || '').trim();
  if (!photo) {
    return `<div class="leader-photo leader-photo-fallback" aria-hidden="true">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;
  }

  const sourceSet = memberPhotoSourceSet(photo);
  const responsive = sourceSet
    ? ` srcset="${escapeHtml(sourceSet)}" sizes="(max-width: 600px) 76px, 96px" data-photo-fallback="${escapeHtml(photo)}"`
    : '';
  return `<img class="leader-photo" src="${escapeHtml(photo)}"${responsive} alt="Foto de ${escapeHtml(name)}" width="96" height="96" loading="lazy" decoding="async" fetchpriority="low">`;
}

function renderLeaderCards(summary) {
  return summary.leaders.map(({ member, role }, index) => `
    <article class="leader-card ${index === 0 ? 'is-featured' : ''}">
      <div class="leader-card-photo">${leaderPhoto(member)}</div>
      <div class="leader-card-content">
        <span class="leader-role">${escapeHtml(role.name)}</span>
        <h3>${escapeHtml(member.name)}</h3>
        <p>${summary.historical ? `Dirigente no AL ${escapeHtml(summary.lionYear)}` : 'Dirigente do Lions Clube de Cândido Mota'}</p>
      </div>
    </article>`).join('');
}

export function renderLeaders(state, { root, empty, at = new Date(), lionYear = '' } = {}) {
  if (!root) throw new TypeError('renderLeaders requer um elemento raiz.');
  const requestedYear = lionYear || root.dataset?.leadersYear || '';
  const summary = publicLeadershipSummary(state, at, requestedYear);
  if (root.dataset) root.dataset.leadersYear = summary.lionYear;
  const cards = renderLeaderCards(summary);
  const heroLogo = resolveDisplayLogo(state?.settings?.logo);
  const clubName = String(state?.settings?.clubName || 'Lions Clube de Cândido Mota').trim() || 'Lions Clube de Cândido Mota';
  const historyAvailable = summary.availableYears.length > 1;
  const historicalYears = summary.availableYears.filter(year => year !== summary.currentLionYear);

  root.innerHTML = `
    <section class="leaders-hero institutional-banner ${summary.historical ? 'is-history' : ''}">
      <img class="institutional-banner-watermark" src="${escapeHtml(heroLogo)}" alt="" aria-hidden="true" width="360" height="360" decoding="async">
      <div class="leaders-hero-copy institutional-banner-copy">
        <span class="leaders-eyebrow">${summary.historical ? 'Memória da diretoria' : 'Diretoria do clube'}</span>
        <h2>Dirigentes do AL ${escapeHtml(summary.lionYear)}</h2>
        <p>${summary.historical
          ? `Consulte quem conduziu o ${escapeHtml(clubName)} neste Ano Leonístico.`
          : 'Conheça as pessoas responsáveis pela condução do clube neste Ano Leonístico.'}</p>
      </div>
      <div class="leaders-banner-tools">
        <div class="leaders-year-card" aria-label="Ano Leonístico selecionado">
          ${uiIcon('users', 'leaders-year-icon')}
          <div><small>Ano Leonístico</small><strong>${escapeHtml(summary.lionYear)}</strong></div>
        </div>
        ${historyAvailable ? `<label class="leaders-year-selector" for="leadersYearSelect"><span>${uiIcon('history')} Histórico</span><select id="leadersYearSelect" aria-label="Selecionar Ano Leonístico">${summary.availableYears.map(year => `<option value="${escapeHtml(year)}" ${year === summary.lionYear ? 'selected' : ''}>AL ${escapeHtml(year)}${year === summary.currentLionYear ? ' · Atual' : ''}</option>`).join('')}</select></label>` : ''}
      </div>
    </section>
    <section class="leaders-overview" aria-label="Resumo da diretoria">
      <article><strong>${summary.count}</strong><span>${summary.count === 1 ? 'dirigente' : 'dirigentes'}</span></article>
      <article><strong>${summary.roleCount}</strong><span>${summary.roleCount === 1 ? 'cargo representado' : 'cargos representados'}</span></article>
      <article><strong>${summary.historical ? 'Histórico' : 'Vigente'}</strong><span>${summary.historical ? 'registro preservado' : 'diretoria atual'}</span></article>
    </section>
    ${cards
      ? `<section class="leaders-grid" aria-label="Dirigentes do Ano Leonístico ${escapeHtml(summary.lionYear)}">${cards}</section>`
      : `<section class="card leaders-empty-state">${typeof empty === 'function'
          ? empty('users', `Os dirigentes do AL ${escapeHtml(summary.lionYear)} ainda não foram publicados.`)
          : `<h3>Dirigentes ainda não publicados</h3><p>As informações do Ano Leonístico selecionado serão exibidas aqui.</p>`}</section>`}
    ${historicalYears.length ? `<section class="leaders-history-panel card" aria-labelledby="leadersHistoryTitle">
      <div class="leaders-history-copy"><span class="leaders-history-icon" aria-hidden="true">${uiIcon('history')}</span><div><h3 id="leadersHistoryTitle">Histórico dos Anos Leonísticos</h3><p>Consulte as diretorias registradas nos períodos anteriores.</p></div></div>
      <div class="leaders-history-years" role="list" aria-label="Anos Leonísticos disponíveis">${summary.availableYears.map(year => `<button class="leaders-history-year ${year === summary.lionYear ? 'is-selected' : ''}" type="button" data-leaders-year="${escapeHtml(year)}" aria-pressed="${year === summary.lionYear ? 'true' : 'false'}"><strong>AL ${escapeHtml(year)}</strong><span>${year === summary.currentLionYear ? 'Atual' : 'Histórico'}</span></button>`).join('')}</div>
    </section>` : ''}
    <p class="leaders-footnote">As informações são atualizadas a partir do histórico de cargos registrado no Portal.</p>`;

  const selectYear = year => {
    if (root.dataset) root.dataset.leadersYear = year;
    renderLeaders(state, { root, empty, at, lionYear: year });
  };
  root.querySelector?.('#leadersYearSelect')?.addEventListener('change', event => selectYear(event.target.value));
  root.querySelectorAll?.('[data-leaders-year]')?.forEach(button => button.addEventListener('click', () => selectYear(button.dataset.leadersYear)));
}
