import {
  escapeHtml,
  formatDate,
  normalize,
  parseLocalDate
} from '../utils.js';

export function getAppointments(state) {
  const events = state.events.map(item => ({
    ...item,
    appointmentType: 'event',
    title: item.name,
    details: item.description || '',
    status: item.status || 'Confirmado'
  }));

  const meetings = state.meetings.map(item => ({
    ...item,
    appointmentType: 'meeting',
    title: item.theme,
    details: item.notes || '',
    status: item.status || 'Confirmado'
  }));

  return [...events, ...meetings];
}

export function compareAppointments(first, second) {
  const dateDifference = parseLocalDate(first.date) - parseLocalDate(second.date);
  return dateDifference || String(first.time || '').localeCompare(String(second.time || ''));
}

export function appointmentTypeBadge(item) {
  return item.appointmentType === 'meeting'
    ? '<span class="appointment-type-chip meeting"><span class="appointment-type-icon">🤝</span><span>Reunião</span></span>'
    : '<span class="appointment-type-chip event"><span class="appointment-type-icon">📅</span><span>Evento</span></span>';
}

function normalizeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;

  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function virtualPlatform(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();

    if (host.includes('meet.google')) return { name: 'Google Meet', icon: '🎥' };
    if (host.includes('teams.microsoft') || host.includes('teams.live')) return { name: 'Microsoft Teams', icon: '🟣' };
    if (host.includes('zoom.')) return { name: 'Zoom', icon: '🔵' };
    if (host.includes('webex.')) return { name: 'Cisco Webex', icon: '🟢' };

    return { name: 'Reunião virtual', icon: '🌐' };
  } catch {
    return { name: 'Reunião virtual', icon: '🌐' };
  }
}

export function locationInfo(value) {
  const item = value && typeof value === 'object' ? value : { location: value };
  const rawLocation = String(item.location || '').trim();
  const explicitUrl = normalizeExternalUrl(item.onlineUrl || item.meetingUrl || '');
  const legacyUrl = normalizeExternalUrl(rawLocation);
  const url = explicitUrl || legacyUrl;
  const isVirtual = item.locationType === 'virtual' || Boolean(url);

  if (isVirtual && url) {
    return {
      type: 'virtual',
      url,
      ...virtualPlatform(url)
    };
  }

  return {
    type: 'physical',
    text: rawLocation || 'Local não informado'
  };
}

export function renderLocation(value, { compact = false } = {}) {
  const info = locationInfo(value);

  if (info.type === 'physical') {
    return `<span class="location-text">📍 ${escapeHtml(info.text)}</span>`;
  }

  const label = compact ? 'Acessar reunião' : 'Acessar sala';

  return `<div class="virtual-location ${compact ? 'is-compact' : ''}"><span class="virtual-location-platform"><span aria-hidden="true">${info.icon}</span><span>${escapeHtml(info.name)}</span></span><a class="location-link" href="${escapeHtml(info.url)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🔗</span><span>${label}</span><span class="location-link-arrow" aria-hidden="true">↗</span></a></div>`;
}

export function appointmentLocationText(item) {
  const info = locationInfo(item);
  return info.type === 'virtual' ? info.name : info.text;
}

function escapeIcs(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function downloadAppointmentCalendar(item) {
  const start = new Date(`${item.date}T${item.time || '09:00'}:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = date => `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}00`;
  const info = locationInfo(item);
  const location = info.type === 'virtual' ? info.url : info.text;
  const description = [
    item.details || '',
    info.type === 'virtual' ? `Acesso: ${info.url}` : ''
  ].filter(Boolean).join('\n');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lions Clube de Cândido Mota//Portal//PT-BR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${item.id}@lionsclubcandidomota`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs(item.title)}`,
    `LOCATION:${escapeIcs(location)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');

  link.href = URL.createObjectURL(blob);
  link.download = `${normalize(item.title).replace(/\s+/g, '-') || 'compromisso'}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function appointmentListItem(item) {
  return `<article class="appointment-home-item">
    <span class="appointment-home-icon ${item.appointmentType}" aria-hidden="true">${item.appointmentType === 'meeting' ? '🤝' : '📅'}</span>
    <div class="appointment-home-content">
      <strong>${escapeHtml(item.title)}</strong>
      <div class="appointment-home-details">
        <span class="appointment-home-date">${formatDate(item.date)} · ${escapeHtml(item.time || 'Sem horário')}</span>
        <span class="appointment-home-location">${renderLocation(item, { compact: true })}</span>
      </div>
    </div>
    <div class="appointment-home-type">${appointmentTypeBadge(item)}</div>
  </article>`;
}
