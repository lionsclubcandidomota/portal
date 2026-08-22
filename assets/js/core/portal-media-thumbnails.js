import {
  MEMBER_PHOTO_THUMBNAIL_WIDTHS,
  memberPhotoThumbnailAssetPath
} from './member-photo-sources.js?v=6.52.0';

function assetDataUrl(asset) {
  return `data:${asset.contentType || 'image/jpeg'};base64,${String(asset.content || '').replace(/\s+/g, '')}`;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível preparar a miniatura da foto.'));
    image.src = source;
  });
}

function canvasToWebpBase64(canvas, quality = 0.84) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob || blob.type !== 'image/webp') {
        reject(new Error('Este navegador não conseguiu gerar miniaturas WebP.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível codificar a miniatura da foto.'));
      reader.onload = () => {
        const content = String(reader.result || '').split(',')[1] || '';
        if (!content) reject(new Error('A miniatura gerada ficou vazia.'));
        else resolve(content);
      };
      reader.readAsDataURL(blob);
    }, 'image/webp', quality);
  });
}

function drawSquareThumbnail(image, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { alpha: false });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);

  const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceX = Math.max(0, ((image.naturalWidth || image.width) - sourceSize) / 2);
  const sourceY = Math.max(0, ((image.naturalHeight || image.height) - sourceSize) / 2);
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  return canvas;
}

/**
 * Gera miniaturas responsivas somente quando o navegador possui Canvas/WebP.
 * Em ambientes de teste sem DOM, retorna uma lista vazia sem afetar a publicação.
 */
export async function createMemberPhotoThumbnailAssets(assets, options = {}) {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof FileReader === 'undefined') {
    return [];
  }

  const widths = Array.isArray(options.widths) && options.widths.length
    ? options.widths.filter(width => MEMBER_PHOTO_THUMBNAIL_WIDTHS.includes(Number(width))).map(Number)
    : [...MEMBER_PHOTO_THUMBNAIL_WIDTHS];
  const thumbnails = [];

  for (const asset of Array.isArray(assets) ? assets : []) {
    if (asset?.kind !== 'member-photo' || !asset.path || !asset.content) continue;
    const image = await loadImage(assetDataUrl(asset));

    for (const width of widths) {
      const path = memberPhotoThumbnailAssetPath(asset.path, width);
      if (!path) continue;
      const content = await canvasToWebpBase64(drawSquareThumbnail(image, width));
      thumbnails.push({
        path,
        reference: `./${path}`,
        content,
        contentType: 'image/webp',
        encoding: 'base64',
        kind: 'member-photo-thumbnail',
        ownerId: String(asset.ownerId || ''),
        label: `${String(asset.label || 'Associado')} (${width}px)`,
        sourcePath: asset.path,
        width,
        height: width
      });
    }
  }

  return thumbnails;
}
