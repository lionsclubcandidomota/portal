export const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const fullDateFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}
export function parseLocalDate(value) {
  if (!value) return null;
  const [y,m,d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function toInputDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
export function formatDate(value) {
  const d = parseLocalDate(value);
  return d ? dateFormat.format(d) : '—';
}
export function calculateAge(birthDate) {
  const birth = parseLocalDate(birthDate);
  if (!birth) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
export function nextBirthdayDate(birthDate) {
  const birth = parseLocalDate(birthDate);
  if (!birth) return null;
  const now = new Date();
  now.setHours(0,0,0,0);
  let next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < now) next = new Date(now.getFullYear()+1, birth.getMonth(), birth.getDate());
  return next;
}
export function daysUntil(date) {
  const now = new Date(); now.setHours(0,0,0,0);
  const target = new Date(date); target.setHours(0,0,0,0);
  return Math.round((target - now) / 86400000);
}
export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
export function normalize(text = '') {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
export function fileToDataUrl(file, maxSize = 900, quality = .84) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function optimizeDataUrl(dataUrl, options = {}) {
  const maxSize = options.maxSize || 1200;
  const initialQuality = options.quality || .9;
  const targetBytes = options.targetBytes || 420000;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * ratio));
      canvas.height = Math.max(1, Math.round(img.height * ratio));
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = initialQuality;
      let result = canvas.toDataURL('image/jpeg', quality);
      const approximateBytes = value => Math.ceil((value.length - value.indexOf(',') - 1) * .75);
      while (approximateBytes(result) > targetBytes && quality > .76) {
        quality -= .03;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result);
    };
    img.src = dataUrl;
  });
}

function treasuryStatusKey(item) {
  const value = String(item?.status || '').trim().toLocaleLowerCase('pt-BR');
  if (value) return value;
  const date = parseLocalDate(item?.date || '');
  const today = new Date();
  today.setHours(0,0,0,0);
  return date > today ? 'programado' : 'realizado';
}

function treasuryIsProgrammed(item) {
  const status = treasuryStatusKey(item);
  return status === 'programado'
    || status === 'agendado'
    || status === 'pendente'
    || status === 'vencida'
    || status === 'vencido';
}

export function sumTreasury(items) {
  const totals = {
    entries: 0,
    exits: 0,
    balance: 0,
    programmedEntries: 0,
    programmedExits: 0,
    projectedBalance: 0,
    realizedCount: 0,
    programmedCount: 0
  };

  for (const item of items || []) {
    const entry = Number(item?.entry || 0);
    const exit = Number(item?.exit || 0);
    if (treasuryIsProgrammed(item)) {
      totals.programmedEntries += entry;
      totals.programmedExits += exit;
      totals.programmedCount += 1;
    } else {
      totals.entries += entry;
      totals.exits += exit;
      totals.realizedCount += 1;
    }
  }

  totals.balance = totals.entries - totals.exits;
  totals.projectedBalance = totals.balance + totals.programmedEntries - totals.programmedExits;
  return totals;
}
