export const MEMBER_PHOTO_THUMBNAIL_WIDTHS = Object.freeze([96, 192]);

function normalizeReference(value) {
  const reference = String(value || '').trim();
  if (!reference) return '';
  return reference.startsWith('public/') ? `./${reference}` : reference;
}

function localMemberPhotoParts(reference) {
  const normalized = normalizeReference(reference).split(/[?#]/, 1)[0];
  const match = normalized.match(/^\.\/public\/members\/(?!thumbs\/)([^/]+)\.(?:jpe?g|png|webp)$/i);
  return match ? { stem: match[1] } : null;
}

export function memberPhotoThumbnailPath(reference, width = MEMBER_PHOTO_THUMBNAIL_WIDTHS[0]) {
  const parts = localMemberPhotoParts(reference);
  const normalizedWidth = Number(width);
  if (!parts || !MEMBER_PHOTO_THUMBNAIL_WIDTHS.includes(normalizedWidth)) return '';
  return `./public/members/thumbs/${parts.stem}-${normalizedWidth}.webp`;
}

export function memberPhotoThumbnailAssetPath(assetPath, width = MEMBER_PHOTO_THUMBNAIL_WIDTHS[0]) {
  const thumbnail = memberPhotoThumbnailPath(assetPath, width);
  return thumbnail.startsWith('./') ? thumbnail.slice(2) : thumbnail;
}

export function memberPhotoSourceSet(reference) {
  return MEMBER_PHOTO_THUMBNAIL_WIDTHS
    .map(width => {
      const thumbnail = memberPhotoThumbnailPath(reference, width);
      return thumbnail ? `${thumbnail} ${width}w` : '';
    })
    .filter(Boolean)
    .join(', ');
}
