import { escapeHtml } from '../utils.js';

export function empty(icon, text) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><div>${text}</div></div>`;
}

export function kpi(icon, label, value, view = '') {
  return `<article class="card kpi-card ${view ? 'kpi-link' : ''}" ${view ? `data-go="${view}" role="button" tabindex="0" aria-label="Abrir ${escapeHtml(label)}"` : ''}><div class="kpi-icon">${icon}</div><div><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>${view ? '<span class="kpi-arrow">›</span>' : ''}</article>`;
}

export function avatar(person) {
  return person.photo
    ? `<img class="avatar" src="${person.photo}" alt="Foto de ${escapeHtml(person.name)}">`
    : `<div class="avatar">${escapeHtml(person.name.charAt(0).toUpperCase())}</div>`;
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
