import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migratePortalPayload } from '../assets/js/core/portal-schema.js';
import {
  MEMBER_PHOTO_THUMBNAIL_WIDTHS,
  memberPhotoThumbnailAssetPath
} from '../assets/js/core/member-photo-sources.js';
import { publicMediaPathFromReference } from '../assets/js/core/portal-media.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const payload = JSON.parse(await readFile(path.join(root, 'data', 'dados.json'), 'utf8'));
const state = migratePortalPayload(payload).state;
const failures = [];
const warnings = [];
const required = process.argv.includes('--required');
const originalPaths = new Set();
let thumbnailBytes = 0;
let thumbnailCount = 0;

for (const member of Array.isArray(state.birthdays) ? state.birthdays : []) {
  const originalPath = publicMediaPathFromReference(member?.photo);
  if (!/^public\/members\/[^/]+\.(?:jpe?g|png|webp)$/i.test(originalPath)) continue;
  originalPaths.add(originalPath);

  try {
    await stat(path.join(root, originalPath));
  } catch {
    failures.push(`foto original ausente: ${originalPath}`);
    continue;
  }

  for (const width of MEMBER_PHOTO_THUMBNAIL_WIDTHS) {
    const thumbnailPath = memberPhotoThumbnailAssetPath(originalPath, width);
    try {
      const info = await stat(path.join(root, thumbnailPath));
      thumbnailBytes += info.size;
      thumbnailCount += 1;
      if (info.size > 20_000) failures.push(`miniatura acima de 20 KB: ${thumbnailPath} (${info.size} bytes)`);
    } catch {
      (required ? failures : warnings).push(`miniatura ausente: ${thumbnailPath}`);
    }
  }
}

const templateWebpPath = path.join(root, 'assets', 'templates', 'birthday-template.webp');
const templatePngPath = path.join(root, 'assets', 'templates', 'birthday-template.png');
let templateBytes = 0;
try {
  templateBytes = (await stat(templateWebpPath)).size;
  if (templateBytes > 350_000) failures.push(`template de aniversário acima de 350 KB (${templateBytes} bytes)`);
} catch {
  failures.push('template otimizado de aniversário ausente');
}
try {
  await stat(templatePngPath);
  failures.push('template PNG antigo ainda está presente');
} catch {
  // Ausência esperada.
}

try {
  const thumbnailFiles = await readdir(path.join(root, 'public', 'members', 'thumbs'));
  const expected = originalPaths.size * MEMBER_PHOTO_THUMBNAIL_WIDTHS.length;
  if (thumbnailFiles.length < expected) {
    (required ? failures : warnings).push(`conjunto de miniaturas incompleto: ${thumbnailFiles.length}/${expected}`);
  }
} catch {
  (required ? failures : warnings).push('pasta public/members/thumbs ausente');
}

if (thumbnailBytes > 350_000) failures.push(`miniaturas somam ${thumbnailBytes} bytes; limite 350000`);

console.log(`Mídia: ${originalPaths.size} foto(s), ${thumbnailCount} miniatura(s) (${thumbnailBytes} bytes), template ${templateBytes} bytes.`);
if (warnings.length) console.warn(`Avisos de mídia:\n${warnings.map(item => `- ${item}`).join('\n')}`);
if (failures.length) {
  console.error(`Auditoria de mídia reprovada:\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exit(1);
}
