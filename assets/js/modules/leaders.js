import { memberPhotoSourceSet } from '../core/member-photo-sources.js?v=6.44.1';
import {
  currentPublicLeaders,
  publicLeadershipSummary
} from '../core/public-leadership.js?v=6.44.1';
import { escapeHtml } from '../utils.js';
import { uiIcon } from './visual-helpers.js?v=6.44.1';

export { currentPublicLeaders, publicLeadershipSummary };

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

export function renderLeaders(state, { root, empty, at = new Date() } = {}) {
  if (!root) throw new TypeError('renderLeaders requer um elemento raiz.');
  const summary = publicLeadershipSummary(state, at);
  const cards = summary.leaders.map(({ member, role }, index) => `
    <article class="leader-card ${index === 0 ? 'is-featured' : ''}">
      <div class="leader-card-photo">${leaderPhoto(member)}</div>
      <div class="leader-card-content">
        <span class="leader-role">${escapeHtml(role.name)}</span>
        <h3>${escapeHtml(member.name)}</h3>
        <p>Dirigente do Lions Clube de Cândido Mota</p>
      </div>
    </article>`).join('');

  root.innerHTML = `
    <section class="leaders-hero">
      <div class="leaders-hero-copy">
        <span class="leaders-eyebrow">Diretoria do clube</span>
        <h2>Dirigentes do AL ${escapeHtml(summary.lionYear)}</h2>
        <p>Conheça as pessoas responsáveis pela condução do clube neste Ano Leonístico.</p>
      </div>
      <div class="leaders-year-card" aria-label="Ano Leonístico vigente">
        ${uiIcon('users', 'leaders-year-icon')}
        <div><small>Ano Leonístico</small><strong>${escapeHtml(summary.lionYear)}</strong></div>
      </div>
    </section>
    <section class="leaders-overview" aria-label="Resumo da diretoria">
      <article><strong>${summary.count}</strong><span>${summary.count === 1 ? 'dirigente' : 'dirigentes'}</span></article>
      <article><strong>${summary.roleCount}</strong><span>${summary.roleCount === 1 ? 'cargo representado' : 'cargos representados'}</span></article>
      <article><strong>01/07</strong><span>início do Ano Leonístico</span></article>
    </section>
    ${cards
      ? `<section class="leaders-grid" aria-label="Dirigentes do Ano Leonístico ${escapeHtml(summary.lionYear)}">${cards}</section>`
      : `<section class="card leaders-empty-state">${typeof empty === 'function'
          ? empty('🦁', `Os dirigentes do AL ${escapeHtml(summary.lionYear)} ainda não foram publicados.`)
          : `<h3>Dirigentes ainda não publicados</h3><p>As informações do Ano Leonístico vigente serão exibidas aqui.</p>`}</section>`}
    <p class="leaders-footnote">As informações são atualizadas a partir dos cargos registrados no Portal.</p>`;
}
