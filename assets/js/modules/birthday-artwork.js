import { normalize } from '../utils.js';

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawBirthdayInitial(context, person, centerX, centerY, radius) {
  const initial = (person.name || '?').trim().charAt(0).toUpperCase();
  const gradient = context.createLinearGradient(
    centerX - radius,
    centerY - radius,
    centerX + radius,
    centerY + radius
  );
  gradient.addColorStop(0, '#0b69a6');
  gradient.addColorStop(1, '#032a50');
  context.fillStyle = gradient;
  context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `900 ${radius * .72}px Arial, sans-serif`;
  context.fillText(initial, centerX, centerY + radius * .04);
  context.textBaseline = 'alphabetic';
}

function splitBirthdayName(context, name, maxWidth, maxLines = 2) {
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return ['Aniversariante'];

  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (context.measureText(test).width <= maxWidth || !current) current = test;
    else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const first = lines.shift();
  return [first, lines.join(' ')];
}

function drawBirthdayName(context, name, x, y, width, height, scale) {
  const maxWidth = width - 54 * scale;
  let fontSize = 42 * scale;
  let lines = [];

  while (fontSize >= 25 * scale) {
    context.font = `900 ${fontSize}px Arial, sans-serif`;
    lines = splitBirthdayName(context, name, maxWidth, 2);
    if (lines.every(line => context.measureText(line).width <= maxWidth)) break;
    fontSize -= 2 * scale;
  }

  context.textAlign = 'center';
  context.fillStyle = '#ffffff';
  context.shadowColor = 'rgba(0,0,0,.30)';
  context.shadowBlur = 5 * scale;

  const lineHeight = fontSize * 1.04;
  const totalHeight = lines.length * lineHeight;
  const firstBaseline = y + (height - totalHeight) / 2 + fontSize * .82;

  lines.forEach((line, index) => {
    context.fillText(line, x + width / 2, firstBaseline + index * lineHeight);
  });

  context.shadowBlur = 0;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível gerar a imagem da homenagem.'));
    }, 'image/png');
  });
}

export async function createBirthdayArtwork(
  person,
  { templateUrl = './assets/templates/birthday-template.webp' } = {}
) {
  const template = await loadCanvasImage(templateUrl);
  const canvas = document.createElement('canvas');
  canvas.width = template.naturalWidth || template.width || 1248;
  canvas.height = template.naturalHeight || template.height || 1248;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('O navegador não disponibilizou o editor de imagem.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(template, 0, 0, canvas.width, canvas.height);

  // Coordenadas calibradas para o template oficial 1248 × 1248.
  const scaleX = canvas.width / 1248;
  const scaleY = canvas.height / 1248;
  const scale = Math.min(scaleX, scaleY);
  const centerX = 414 * scaleX;
  const centerY = 684 * scaleY;
  const radius = 322 * scale;

  // Substitui integralmente a fotografia original do template.
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = '#eaf2f8';
  context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

  if (person.photo) {
    try {
      const photo = await loadCanvasImage(person.photo);
      const photoScale = Math.max(
        (radius * 2) / photo.width,
        (radius * 2) / photo.height
      );
      const photoWidth = photo.width * photoScale;
      const photoHeight = photo.height * photoScale;

      // Leve deslocamento para cima favorece retratos e evita cortar o topo da cabeça.
      context.drawImage(
        photo,
        centerX - photoWidth / 2,
        centerY - photoHeight / 2 - radius * .035,
        photoWidth,
        photoHeight
      );
    } catch {
      drawBirthdayInitial(context, person, centerX, centerY, radius);
    }
  } else {
    drawBirthdayInitial(context, person, centerX, centerY, radius);
  }

  context.restore();

  // Recria o aro dourado sobre a fotografia para esconder qualquer diferença de recorte.
  const ring = context.createLinearGradient(
    centerX - radius,
    centerY - radius,
    centerX + radius,
    centerY + radius
  );
  ring.addColorStop(0, '#fff3a6');
  ring.addColorStop(.18, '#c98a13');
  ring.addColorStop(.46, '#fff7c8');
  ring.addColorStop(.72, '#a76500');
  ring.addColorStop(1, '#f6cc48');

  context.save();
  context.shadowColor = 'rgba(0,0,0,.38)';
  context.shadowBlur = 20 * scale;
  context.strokeStyle = ring;
  context.lineWidth = 15 * scale;
  context.beginPath();
  context.arc(centerX, centerY, radius + 2 * scale, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  // Faixa dinâmica com o nome, posicionada sobre a base da fotografia.
  const plaqueX = 92 * scaleX;
  const plaqueY = 958 * scaleY;
  const plaqueWidth = 645 * scaleX;
  const plaqueHeight = 112 * scaleY;

  context.save();
  context.shadowColor = 'rgba(0,0,0,.45)';
  context.shadowBlur = 22 * scale;

  const plaqueGradient = context.createLinearGradient(
    plaqueX,
    plaqueY,
    plaqueX + plaqueWidth,
    plaqueY + plaqueHeight
  );
  plaqueGradient.addColorStop(0, 'rgba(2,28,55,.96)');
  plaqueGradient.addColorStop(1, 'rgba(5,61,103,.96)');
  context.fillStyle = plaqueGradient;
  roundedRect(context, plaqueX, plaqueY, plaqueWidth, plaqueHeight, 28 * scale);
  context.fill();
  context.strokeStyle = '#e8b737';
  context.lineWidth = 3 * scale;
  context.stroke();
  context.restore();

  const displayName = (person.name || 'Aniversariante').trim();
  drawBirthdayName(
    context,
    displayName,
    plaqueX,
    plaqueY,
    plaqueWidth,
    plaqueHeight,
    scale
  );

  return canvasToPngBlob(canvas);
}

function shareFileName(person) {
  const slug = normalize(person.name).trim().replace(/\s+/g, '-') || 'aniversariante';
  return `feliz-aniversario-${slug}.png`;
}

export function createBirthdayArtworkController({
  getBirthdays,
  toast,
  createArtwork = createBirthdayArtwork
}) {
  if (typeof getBirthdays !== 'function') {
    throw new TypeError('createBirthdayArtworkController requer getBirthdays().');
  }

  if (typeof toast !== 'function') {
    throw new TypeError('createBirthdayArtworkController requer toast().');
  }

  const setButtonBusy = (button, busy) => {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy ? 'Criando arte…' : '🎉 Desejar parabéns';
  };

  const downloadArtwork = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const share = async personId => {
    const person = getBirthdays().find(item => item.id === personId);
    if (!person) return;

    const selectorId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(personId)
      : String(personId).replace(/["\\]/g, '\\$&');
    const button = document.querySelector(`[data-birthday-share="${selectorId}"]`);
    setButtonBusy(button, true);

    try {
      const blob = await createArtwork(person);
      const fileName = shareFileName(person);
      const file = new File([blob], fileName, { type: 'image/png' });
      const text = `Feliz aniversário, ${person.name}! 🎉 Uma homenagem do Lions Clube de Cândido Mota.`;
      const canShareFile = navigator.share
        && (!navigator.canShare || navigator.canShare({ files: [file] }));

      if (canShareFile) {
        await navigator.share({
          title: `Feliz aniversário, ${person.name}!`,
          text,
          files: [file]
        });
      } else {
        downloadArtwork(blob, fileName);
        toast('A arte foi baixada e está pronta para compartilhar.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        toast('Não foi possível criar a homenagem de aniversário.');
      }
    } finally {
      setButtonBusy(button, false);
    }
  };

  return {
    createArtwork,
    share
  };
}
