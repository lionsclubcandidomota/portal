import { state, normalize, toast } from './core.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawInitial(ctx, person, cx, cy, radius) {
  ctx.fillStyle = '#075ca8';
  ctx.fillRect(cx - radius, cy - radius, 2 * radius, 2 * radius);
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${radius}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(person.name || '?').charAt(0).toUpperCase(), cx, cy);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

async function createBirthdayArtwork(person) {
  const template = await loadImage('./assets/templates/birthday-template.webp');
  const canvas = document.createElement('canvas');
  canvas.width = template.naturalWidth || 1248;
  canvas.height = template.naturalHeight || 1248;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

  const sx = canvas.width / 1248;
  const sy = canvas.height / 1248;
  const scale = Math.min(sx, sy);
  const cx = 414 * sx;
  const cy = 684 * sy;
  const radius = 322 * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#eaf2f8';
  ctx.fillRect(cx - radius, cy - radius, 2 * radius, 2 * radius);

  if (person.photo) {
    try {
      const photo = await loadImage(person.photo);
      const zoom = Math.max((2 * radius) / photo.width, (2 * radius) / photo.height);
      const width = photo.width * zoom;
      const height = photo.height * zoom;
      ctx.drawImage(photo, cx - width / 2, cy - height / 2 - radius * .035, width, height);
    } catch {
      drawInitial(ctx, person, cx, cy, radius);
    }
  } else {
    drawInitial(ctx, person, cx, cy, radius);
  }
  ctx.restore();

  ctx.strokeStyle = '#e8b737';
  ctx.lineWidth = 15 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2 * scale, 0, Math.PI * 2);
  ctx.stroke();

  const x = 92 * sx;
  const y = 958 * sy;
  const width = 645 * sx;
  const height = 112 * sy;
  ctx.fillStyle = 'rgba(2,38,70,.95)';
  roundRect(ctx, x, y, width, height, 28 * scale);
  ctx.fill();
  ctx.strokeStyle = '#e8b737';
  ctx.lineWidth = 3 * scale;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let fontSize = 46 * scale;
  ctx.font = `800 ${fontSize}px system-ui`;
  while (ctx.measureText(person.name).width > width - 40 * scale && fontSize > 24 * scale) {
    fontSize -= 2 * scale;
    ctx.font = `800 ${fontSize}px system-ui`;
  }
  ctx.fillText(person.name, x + width / 2, y + height / 2);

  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('blob')),
    'image/png'
  ));
}

export async function shareBirthday(id) {
  const person = state.data.birthdays.find(item => String(item.id) === String(id));
  if (!person) return;

  const buttons = [...document.querySelectorAll(`[data-birthday-share="${CSS.escape(String(id))}"]`)];
  buttons.forEach(button => { button.disabled = true; });

  try {
    const blob = await createBirthdayArtwork(person);
    const fileName = `feliz-aniversario-${normalize(person.name).replace(/\s+/g, '-')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ title: `Feliz aniversário, ${person.name}!`, files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
      toast('Arte de aniversário baixada.');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') toast('Não foi possível criar a homenagem.');
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}
