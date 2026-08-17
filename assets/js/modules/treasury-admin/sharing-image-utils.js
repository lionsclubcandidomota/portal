import { money } from '../../utils.js';

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

  return `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#ffffff" stroke="#d6e1ec" stroke-width="2"/><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}" fill="#eef3f9"/><text x="50%" y="54%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800" fill="#1a568f">${escapeXml(initials(name))}</text>`;
}

function buildLinkedCards(linked = [], startY = 0) {
  return linked.map((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 92 + (column * 434);
    const y = startY + (row * 76);
    return `<g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="402" height="58" rx="18" fill="#f7fafe" stroke="#dce5ef" stroke-width="1.5"/>
      <g transform="translate(10,5)">${buildAvatarMarkup({ name: item.name, photoDataUrl: item.avatar, size: 48, fontSize: 18, key: `linked_${index}` })}</g>
      <text x="70" y="24" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" fill="#153a67">${escapeXml(truncateText(item.name, 26))}</text>
      <text x="70" y="43" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="600" fill="#74879d">${escapeXml(item.role || 'Vinculado')}</text>
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
  const canvasWidth = 1080;
  const cardX = 40;
  const cardY = 40;
  const cardWidth = canvasWidth - 80;
  const headerHeight = 132;
  const profileHeight = 118;
  const linkedSectionHeight = linked.length ? 38 + (Math.ceil(linked.length / 2) * 76) + 18 : 0;
  const stats = Array.isArray(summaryStats) ? summaryStats.filter(item => Number(item?.amount || 0) >= 0) : [];
  const statsSectionHeight = stats.length ? 98 : 0;
  const tableHeaderHeight = 50;
  const rowHeight = 48;
  const tableHeight = tableHeaderHeight + (dataRows.length * rowHeight) + 16;
  const totalHeight = 92;
  const footerHeight = footer ? 84 : 40;
  const bodyHeight = headerHeight + profileHeight + linkedSectionHeight + statsSectionHeight + tableHeight + totalHeight + footerHeight + 64;
  const cardHeight = bodyHeight;
  const canvasHeight = cardHeight + 80;

  const profileY = cardY + headerHeight + 18;
  const linkedSectionY = profileY + profileHeight + 12;
  const statsSectionY = linked.length ? linkedSectionY + linkedSectionHeight : profileY + profileHeight + 18;
  const tableY = stats.length ? statsSectionY + statsSectionHeight : statsSectionY;
  const totalY = tableY + tableHeight + 20;
  const footerY = totalY + totalHeight + 18;

  const logoMarkup = clubLogoDataUrl
    ? `<image href="${clubLogoDataUrl}" x="70" y="64" width="62" height="62" preserveAspectRatio="xMidYMid meet"/>`
    : `<circle cx="101" cy="95" r="28" fill="#ffffff"/><text x="101" y="106" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#165794">L</text>`;

  const linkedMarkup = linked.length ? buildLinkedCards(linked, linkedSectionY + 30) : '';
  const statsMarkup = stats.map((item, index) => {
    const boxWidth = 438;
    const gap = 20;
    const x = 84 + (index * (boxWidth + gap));
    return `<g transform="translate(${x}, ${statsSectionY + 10})">
      <rect x="0" y="0" width="${boxWidth}" height="74" rx="18" fill="#f8fbff" stroke="#dbe5ef" stroke-width="1.5"/>
      <text x="22" y="22" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" fill="#70839a">${escapeXml(item.label)}</text>
      <text x="22" y="42" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#8798ab">${escapeXml(item.detail || '')}</text>
      <text x="22" y="65" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900" fill="#0c5ea6">${escapeXml(money.format(Number(item.amount || 0)))}</text>
    </g>`;
  }).join('');

  const tableRowsMarkup = dataRows.map((item, index) => {
    const top = tableY + tableHeaderHeight + (index * rowHeight);
    return `<rect x="84" y="${top}" width="912" height="${rowHeight}" fill="${index % 2 === 0 ? '#ffffff' : '#fbfcfe'}"/>
      <line x1="96" y1="${top + rowHeight}" x2="984" y2="${top + rowHeight}" stroke="#e6edf5" stroke-width="1"/>
      <text x="108" y="${top + 31}" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="${item.emphasis ? '800' : '600'}" fill="#193c68">${escapeXml(truncateText(item.label, variant === 'family' ? 50 : 30))}</text>
      <text x="968" y="${top + 31}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="800" fill="#12385f">${escapeXml(money.format(Number(item.amount || 0)))}</text>`;
  }).join('');

  return {
    width: canvasWidth,
    height: canvasHeight,
    markup: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <rect width="100%" height="100%" fill="#f4f7fb"/>
  <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="28" fill="#ffffff" stroke="#dbe5ef" stroke-width="2"/>
  <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${headerHeight}" rx="28" fill="#0c5ea6"/>
  <rect x="64" y="56" width="74" height="74" rx="20" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>
  ${logoMarkup}
  <rect x="154" y="58" width="404" height="24" rx="12" fill="rgba(255,255,255,.12)"/>
  <text x="170" y="75" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#eff7ff">${escapeXml(truncateText(clubName, 46))}</text>
  <text x="154" y="106" font-family="Arial, Helvetica, sans-serif" font-size="37" font-weight="900" fill="#ffffff">${escapeXml(title)}</text>
  <text x="154" y="131" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="800" fill="#f6d16f">${escapeXml(subtitle)}</text>

  <g transform="translate(84, ${profileY})">${buildAvatarMarkup({ name: responsibleName, photoDataUrl: responsibleAvatar, size: 88, fontSize: 30, key: 'responsible' })}</g>
  <text x="194" y="${profileY + 20}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" fill="#70839a">${escapeXml(responsibleLabel)}</text>
  <text x="194" y="${profileY + 56}" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900" fill="#163b67">${escapeXml(truncateText(responsibleName, 30))}</text>
  ${badgeLabel ? `<rect x="194" y="${profileY + 72}" width="160" height="28" rx="14" fill="#edf4fb"/><text x="274" y="${profileY + 91}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="800" fill="#0c5ea6">${escapeXml(badgeLabel)}</text>` : ''}

  ${linked.length ? `<text x="84" y="${linkedSectionY + 10}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#163b67">Pessoas vinculadas à cobrança</text>${linkedMarkup}` : ''}
  ${stats.length ? statsMarkup : ''}

  <rect x="84" y="${tableY}" width="912" height="${tableHeight}" rx="22" fill="#ffffff" stroke="#dbe5ef" stroke-width="1.5"/>
  <rect x="84" y="${tableY}" width="912" height="${tableHeaderHeight}" rx="22" fill="#f1f6fb"/>
  <text x="108" y="${tableY + 33}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#163b67">${escapeXml(tableTitle || (variant === 'family' ? 'Competências da cobrança' : 'Mensalidades selecionadas'))}</text>
  <text x="968" y="${tableY + 33}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" fill="#163b67">Valor</text>
  ${tableRowsMarkup}

  <rect x="84" y="${totalY}" width="912" height="${totalHeight}" rx="22" fill="#f8fbff" stroke="#dbe5ef" stroke-width="1.5"/>
  <text x="108" y="${totalY + 34}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#7a8ea5">${escapeXml(truncateText(note, 54))}</text>
  <text x="108" y="${totalY + 69}" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900" fill="#0c5ea6">${escapeXml(totalLabel)}</text>
  <text x="968" y="${totalY + 64}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="900" fill="#163b67">${escapeXml(money.format(Number(total || 0)))}</text>

  <text x="84" y="${footerY + 24}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#0c5ea6">Tesouraria do ${escapeXml(truncateText(clubName, 52))}</text>
  ${footer ? `<text x="84" y="${footerY + 50}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600" fill="#778ba2">${escapeXml(footer)}</text>` : ''}
</svg>`
  };
}
