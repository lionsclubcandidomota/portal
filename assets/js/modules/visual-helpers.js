import { memberPhotoSourceSet } from '../core/member-photo-sources.js?v=6.46.13';
import { escapeHtml } from '../utils.js';


const renderedHtml = new WeakMap();

export function renderHtmlIfChanged(element, html) {
  if (!element) return false;

  const nextHtml = String(html ?? '');
  if (renderedHtml.get(element) === nextHtml) return false;

  element.innerHTML = nextHtml;
  renderedHtml.set(element, nextHtml);
  return true;
}


export function uiIcon(name, className = '') {
  const iconName = /^[a-z0-9-]+$/.test(String(name || '')) ? String(name) : 'warning';
  const classes = ['ui-icon', String(className || '').trim()].filter(Boolean).join(' ');
  return `<svg class="${classes}" aria-hidden="true" focusable="false"><use href="./assets/icons/ui-icons.svg#${iconName}"></use></svg>`;
}

export function empty(icon, text) {
  const iconMarkup = /^[a-z0-9-]+$/.test(String(icon || ''))
    ? uiIcon(icon, 'empty-svg-icon')
    : String(icon || '');
  return `<div class="empty"><div class="empty-icon">${iconMarkup}</div><div>${text}</div></div>`;
}

export function kpi(icon, label, value, view = '') {
  return `<article class="card kpi-card ${view ? 'kpi-link' : ''}" ${view ? `data-go="${view}" role="button" tabindex="0" aria-label="Abrir ${escapeHtml(label)}"` : ''}><div class="kpi-icon">${icon}</div><div><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>${view ? `<span class="kpi-arrow">${uiIcon('chevron-right')}</span>` : ''}</article>`;
}

export function avatar(person) {
  if (!person.photo) return `<div class="avatar">${escapeHtml(person.name.charAt(0).toUpperCase())}</div>`;

  const photo = String(person.photo);
  const sourceSet = memberPhotoSourceSet(photo);
  const responsive = sourceSet
    ? ` srcset="${escapeHtml(sourceSet)}" sizes="40px" data-photo-fallback="${escapeHtml(photo)}"`
    : '';
  return `<img class="avatar" src="${escapeHtml(photo)}"${responsive} alt="Foto de ${escapeHtml(person.name)}" width="40" height="40" loading="lazy" decoding="async" fetchpriority="low">`;
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
