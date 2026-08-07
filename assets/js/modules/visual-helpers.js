import { escapeHtml } from '../utils.js';

const PUBLIC_MEDIA_WORKER_URL = 'https://lions-portal-anexos.lionsclubcandidomota.workers.dev';

function publicMediaSource(value) {
  const reference = String(value || '').trim();
  if (!reference) return '';
  const match = reference.match(/^(?:\.\/)?(public\/[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{1,10})$/i);
  if (!match) return reference;
  const url = new URL('/api/public/media', PUBLIC_MEDIA_WORKER_URL);
  url.searchParams.set('key', match[1]);
  return url.href;
}

export function empty(icon, text) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><div>${text}</div></div>`;
}

export function kpi(icon, label, value, view = '') {
  return `<article class="card kpi-card ${view ? 'kpi-link' : ''}" ${view ? `data-go="${view}" role="button" tabindex="0" aria-label="Abrir ${escapeHtml(label)}"` : ''}><div class="kpi-icon">${icon}</div><div><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>${view ? '<span class="kpi-arrow">›</span>' : ''}</article>`;
}

export function avatar(person) {
  const name = String(person?.name || 'Associado');
  const photo = publicMediaSource(person?.photo);
  return photo
    ? `<img class="avatar" src="${escapeHtml(photo)}" alt="Foto de ${escapeHtml(name)}">`
    : `<div class="avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;
}

export function statusBadge(status) {
  return status === 'Confirmado'
    ? 'badge-success'
    : status === 'Cancelado'
      ? 'badge-danger'
      : 'badge-warning';
}

export function priorityBadge(priority) {
  return priority === 'Alta'
    ? 'badge-danger'
    : priority === 'Média'
      ? 'badge-warning'
      : 'badge-success';
}
