import { money } from '../../utils.js';

const FONT_STACK = 'Inter, Segoe UI, Arial, sans-serif';

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'LC';
  return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
}

function truncateText(value = '', max = 40) {
  const normalized = String(value || '').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function splitLines(value = '', maxChars = 34, maxLines = 2) {
  const text = String(value || '').trim();
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  const rest = lines.slice(maxLines - 1).join(' ');
  kept[maxLines - 1] = truncateText(rest, maxChars);
  return kept;
}

function linesMarkup({ lines = [], x = 0, y = 0, lineHeight = 18, fontSize = 14, fontWeight = 600, fill = '#123', anchor = 'start' } = {}) {
  if (!lines.length) return '';
  const safeLines = lines.map(line => escapeXml(line));
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}">${safeLines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${line}</tspan>`).join('')}</text>`;
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

export function svgMarkupToDataUrl(markup = '') {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(String(markup || ''))}`;
}

export function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function svgToPngBlob(markup, width, height) {
  const image = new Image();
  image.decoding = 'sync';
  const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = svgUrl;
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f7fb';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível gerar o PNG da cobrança.'));
    }, 'image/png');
  });
}

function buildAvatarMarkup({ name = '', photoDataUrl = '', size = 88, fontSize = 30, key = 'avatar' } = {}) {
  const clipId = `avatarClip_${String(key || 'avatar').replace(/[^a-z0-9_-]+/gi, '_')}_${size}`;
  if (photoDataUrl) {
    return `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#ffffff" stroke="#d6e1ec" stroke-width="2"/><clipPath id="${clipId}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}"/></clipPath><image href="${photoDataUrl}" x="6" y="6" width="${size - 12}" height="${size - 12}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`;
  }

  return `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#ffffff" stroke="#d6e1ec" stroke-width="2"/><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}" fill="#eef3f9"/><text x="50%" y="54%" text-anchor="middle" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="800" fill="#1a568f">${escapeXml(initials(name))}</text>`;
}

function buildLinkedCards(linked = [], startY = 0, contentX = 98, contentWidth = 1004) {
  const gap = 20;
  const columns = linked.length <= 1 ? 1 : 2;
  const cardWidth = columns === 1 ? contentWidth : Math.floor((contentWidth - gap) / 2);
  const cardHeight = 74;
  return linked.map((item, index) => {
    const column = columns === 1 ? 0 : index % 2;
    const row = columns === 1 ? index : Math.floor(index / 2);
    const x = contentX + column * (cardWidth + gap);
    const y = startY + row * (cardHeight + 16);
    const maxNameChars = columns === 1 ? 42 : 24;
    return `<g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${cardWidth}" height="${cardHeight}" rx="18" fill="#f8fbff" stroke="#dbe5ef" stroke-width="1.4"/>
      <g transform="translate(10,13)">${buildAvatarMarkup({ name: item.name, photoDataUrl: item.avatar, size: 48, fontSize: 18, key: `linked_${index}` })}</g>
      ${linesMarkup({ lines: splitLines(item.name, maxNameChars, 2), x: 70, y: 25, lineHeight: 16, fontSize: 15, fontWeight: 800, fill: '#173960' })}
      <text x="70" y="61" font-family="${FONT_STACK}" font-size="13" font-weight="600" fill="#74879d">${escapeXml(item.role || 'Vinculado')}</text>
    </g>`;
  }).join('');
}

export function buildChargeSvg(payload) {
  const {
    clubName = 'Lions Clube',
    clubLogoDataUrl = '',
    variant = 'individual',
    title = 'Mensalidades',
    subtitle = '',
    responsibleLabel = '',
    responsibleName = '',
    responsibleAvatar = '',
    badgeLabel = '',
    linkedMembers = [],
    summaryStats = [],
    tableTitle = '',
    rows = [],
    totalLabel = 'Total',
    total = 0,
    note = '',
    footer = ''
  } = payload;

    const linked = Array.isArray(linkedMembers) ? linkedMembers : [];
    const dataRows = Array.isArray(rows) ? rows : [];
    const stats = Array.isArray(summaryStats) ? summaryStats.filter(item => Number(item?.amount || 0) >= 0) : [];

    const canvasWidth = 1280;
    const cardX = 36;
    const cardY = 36;
    const cardWidth = canvasWidth - 72;
    const contentX = 98;
    const contentWidth = cardWidth - 124;
    const headerHeight = 196;
    const profileHeight = 150;
    const linkedColumns = linked.length <= 1 ? 1 : 2;
    const linkedRows = linked.length ? Math.ceil(linked.length / linkedColumns) : 0;
    const linkedSectionHeight = linked.length ? 38 + (linkedRows * 90) + 10 : 0;
    const statsSectionHeight = stats.length ? 198 : 0;
    const tableHeaderHeight = 56;
    const rowHeight = 46;
    const tableHeight = tableHeaderHeight + (dataRows.length * rowHeight) + 12;
    const totalHeight = 116;
    const footerHeight = footer ? 60 : 30;
    const cardHeight = headerHeight + profileHeight + linkedSectionHeight + statsSectionHeight + tableHeight + totalHeight + footerHeight + 60;
    const canvasHeight = cardHeight + 72;

    const profileY = cardY + headerHeight + 28;
    const linkedSectionY = profileY + profileHeight + 8;
    const statsSectionY = linked.length ? linkedSectionY + linkedSectionHeight : profileY + profileHeight + 18;
    const tableY = stats.length ? statsSectionY + statsSectionHeight : statsSectionY;
    const totalY = tableY + tableHeight + 22;
    const footerY = totalY + totalHeight + 10;

    const logoMarkup = clubLogoDataUrl
      ? `<image href="${clubLogoDataUrl}" x="88" y="70" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle cx="120" cy="102" r="30" fill="#ffffff"/><text x="120" y="112" text-anchor="middle" font-family="${FONT_STACK}" font-size="28" font-weight="900" fill="#165794">L</text>`;

    const linkedMarkup = linked.length ? buildLinkedCards(linked, linkedSectionY + 16, contentX, contentWidth) : '';
    const statsGap = 18;
    const statsWidth = stats.length <= 1
      ? contentWidth
      : Math.floor((contentWidth - (statsGap * (stats.length - 1))) / stats.length);
    const statCardHeight = 164;
    const statsMarkup = stats.map((item, index) => {
      const x = contentX + (index * (statsWidth + statsGap));
      const detailLines = splitLines(item.detail || '', stats.length === 1 ? 60 : 28, 2);
      const hintLines = splitLines(item.hint || '', stats.length === 1 ? 64 : 30, 2);
      return `<g transform="translate(${x}, ${statsSectionY + 10})">
        <rect x="0" y="0" width="${statsWidth}" height="${statCardHeight}" rx="18" fill="#f8fbff" stroke="#dbe5ef" stroke-width="1.4"/>
        <text x="22" y="25" font-family="${FONT_STACK}" font-size="15" font-weight="800" fill="#6f829a">${escapeXml(item.label)}</text>
        ${linesMarkup({ lines: detailLines, x: 22, y: 51, lineHeight: 17, fontSize: 15, fontWeight: 800, fill: '#244b75' })}
        ${hintLines.length ? linesMarkup({ lines: hintLines, x: 22, y: 88, lineHeight: 15, fontSize: 12, fontWeight: 600, fill: '#7d8ea4' }) : ''}
        <line x1="22" y1="119" x2="${statsWidth - 22}" y2="119" stroke="#dfe8f1" stroke-width="1"/>
        <text x="22" y="144" font-family="${FONT_STACK}" font-size="12" font-weight="800" fill="#7a8ea5">EM ABERTO</text>
        <text x="${statsWidth - 22}" y="145" text-anchor="end" font-family="${FONT_STACK}" font-size="27" font-weight="900" fill="#0b63ad">${escapeXml(money.format(Number(item.amount || 0)))}</text>
      </g>`;
    }).join('');

    const tableRowsMarkup = dataRows.map((item, index) => {
      const top = tableY + tableHeaderHeight + (index * rowHeight);
      return `<rect x="${contentX}" y="${top}" width="${contentWidth}" height="${rowHeight}" fill="${index % 2 === 0 ? '#ffffff' : '#fbfcfe'}"/>
        <line x1="${contentX + 18}" y1="${top + rowHeight}" x2="${contentX + contentWidth - 18}" y2="${top + rowHeight}" stroke="#e5edf5" stroke-width="1"/>
        <text x="${contentX + 24}" y="${top + 29}" font-family="${FONT_STACK}" font-size="19" font-weight="${item.emphasis ? '800' : '600'}" fill="#193c68">${escapeXml(truncateText(item.label, variant === 'family' ? 66 : 40))}</text>
        <text x="${contentX + contentWidth - 24}" y="${top + 29}" text-anchor="end" font-family="${FONT_STACK}" font-size="19" font-weight="800" fill="#12385f">${escapeXml(money.format(Number(item.amount || 0)))}</text>`;
    }).join('');

    const clubHeaderText = truncateText(clubName, 58);
    const titleText = title || 'Mensalidades';
    const subtitleText = subtitle || (variant === 'family' ? 'Grupo familiar' : 'Associado');
    const noteLines = splitLines(note, 80, 2);

    return {
      width: canvasWidth,
      height: canvasHeight,
      markup: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <defs>
    <linearGradient id="chargeHeader" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0a5ea6"/>
      <stop offset="100%" stop-color="#0d7bc7"/>
    </linearGradient>
    <linearGradient id="totalPanel" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f8fbff"/>
      <stop offset="100%" stop-color="#eef5fc"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#f4f7fb"/>
  <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="32" fill="#ffffff" stroke="#dbe5ef" stroke-width="2"/>
  <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${headerHeight}" rx="32" fill="url(#chargeHeader)"/>
  <circle cx="1090" cy="74" r="140" fill="rgba(255,255,255,.08)"/>
  <circle cx="1170" cy="128" r="88" fill="rgba(255,255,255,.06)"/>
  <rect x="74" y="58" width="92" height="92" rx="26" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.16)" stroke-width="1.4"/>
  ${logoMarkup}
  <rect x="186" y="64" width="440" height="30" rx="15" fill="rgba(255,255,255,.14)"/>
  <text x="202" y="84" font-family="${FONT_STACK}" font-size="15" font-weight="700" fill="#eef7ff">${escapeXml(clubHeaderText)}</text>
  <text x="186" y="127" font-family="${FONT_STACK}" font-size="48" font-weight="900" fill="#ffffff">${escapeXml(titleText)}</text>
  <text x="186" y="158" font-family="${FONT_STACK}" font-size="20" font-weight="800" fill="#f4d678">${escapeXml(subtitleText)}</text>

  <g transform="translate(${contentX}, ${profileY})">${buildAvatarMarkup({ name: responsibleName, photoDataUrl: responsibleAvatar, size: 92, fontSize: 30, key: 'responsible' })}</g>
  <text x="${contentX + 114}" y="${profileY + 22}" font-family="${FONT_STACK}" font-size="18" font-weight="700" fill="#70839a">${escapeXml(responsibleLabel)}</text>
  ${linesMarkup({ lines: splitLines(responsibleName, 36, 2), x: contentX + 114, y: profileY + 52, lineHeight: 24, fontSize: 26, fontWeight: 900, fill: '#163b67' })}
  ${badgeLabel ? `<rect x="${contentX + 114}" y="${profileY + 94}" width="156" height="28" rx="14" fill="#edf4fb"/><text x="${contentX + 192}" y="${profileY + 113}" text-anchor="middle" font-family="${FONT_STACK}" font-size="13" font-weight="800" fill="#0c5ea6">${escapeXml(badgeLabel)}</text>` : ''}

  ${linked.length ? `<text x="${contentX}" y="${linkedSectionY + 4}" font-family="${FONT_STACK}" font-size="21" font-weight="800" fill="#163b67">Pessoas vinculadas à cobrança</text>${linkedMarkup}` : ''}
  ${stats.length ? statsMarkup : ''}

  <rect x="${contentX}" y="${tableY}" width="${contentWidth}" height="${tableHeight}" rx="18" fill="#ffffff" stroke="#dbe5ef" stroke-width="1.4"/>
  <rect x="${contentX}" y="${tableY}" width="${contentWidth}" height="${tableHeaderHeight}" rx="18" fill="#f1f6fb"/>
  <text x="${contentX + 24}" y="${tableY + 35}" font-family="${FONT_STACK}" font-size="20" font-weight="800" fill="#163b67">${escapeXml(tableTitle || (variant === 'family' ? 'Competências da cobrança' : 'Mensalidades selecionadas'))}</text>
  <text x="${contentX + contentWidth - 24}" y="${tableY + 35}" text-anchor="end" font-family="${FONT_STACK}" font-size="20" font-weight="800" fill="#163b67">Valor</text>
  ${tableRowsMarkup}

  <rect x="${contentX}" y="${totalY}" width="${contentWidth}" height="${totalHeight}" rx="20" fill="url(#totalPanel)" stroke="#dbe5ef" stroke-width="1.4"/>
  ${noteLines.length ? linesMarkup({ lines: noteLines, x: contentX + 24, y: totalY + 24, lineHeight: 15, fontSize: 13, fontWeight: 700, fill: '#7a8ea5' }) : ''}
  <text x="${contentX + 24}" y="${totalY + 78}" font-family="${FONT_STACK}" font-size="28" font-weight="900" fill="#0c5ea6">${escapeXml(totalLabel)}</text>
  <text x="${contentX + contentWidth - 24}" y="${totalY + 77}" text-anchor="end" font-family="${FONT_STACK}" font-size="42" font-weight="900" fill="#163b67">${escapeXml(money.format(Number(total || 0)))}</text>

  <text x="${contentX}" y="${footerY + 18}" font-family="${FONT_STACK}" font-size="15" font-weight="700" fill="#0c5ea6">Tesouraria do ${escapeXml(truncateText(clubName, 72))}</text>
  ${footer ? `<text x="${contentX}" y="${footerY + 40}" font-family="${FONT_STACK}" font-size="14" font-weight="600" fill="#778ba2">${escapeXml(footer)}</text>` : ''}
</svg>`
    };
}
