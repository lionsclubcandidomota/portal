import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  MEMBER_PHOTO_THUMBNAIL_WIDTHS,
  memberPhotoSourceSet,
  memberPhotoThumbnailAssetPath,
  memberPhotoThumbnailPath
} from '../assets/js/core/member-photo-sources.js';
import { createMemberPhotoThumbnailAssets } from '../assets/js/core/portal-media-thumbnails.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(root, relativePath), 'utf8');

test('referências locais de associados geram srcset determinístico', () => {
  const photo = './public/members/associado-abc.jpg';
  assert.deepEqual(MEMBER_PHOTO_THUMBNAIL_WIDTHS, [96, 192]);
  assert.equal(memberPhotoThumbnailPath(photo, 96), './public/members/thumbs/associado-abc-96.webp');
  assert.equal(memberPhotoThumbnailAssetPath('public/members/associado-abc.jpg', 192), 'public/members/thumbs/associado-abc-192.webp');
  assert.equal(memberPhotoSourceSet(photo), './public/members/thumbs/associado-abc-96.webp 96w, ./public/members/thumbs/associado-abc-192.webp 192w');
  assert.equal(memberPhotoSourceSet('https://example.test/foto.jpg'), '');
  assert.equal(memberPhotoSourceSet('data:image/jpeg;base64,AA=='), '');
});

test('gerador de miniaturas permanece seguro em ambiente sem DOM', async () => {
  assert.deepEqual(await createMemberPhotoThumbnailAssets([{ kind: 'member-photo' }]), []);
});

test('avatares usam miniaturas responsivas com fallback para o original', async () => {
  const helpers = await source('assets/js/modules/visual-helpers.js');
  const app = await source('assets/js/app.js');
  assert.match(helpers, /memberPhotoSourceSet/);
  assert.match(helpers, /srcset=/);
  assert.match(helpers, /sizes="40px"/);
  assert.match(helpers, /data-photo-fallback/);
  assert.match(helpers, /fetchpriority="low"/);
  assert.match(app, /photoFallbackUsed/);
  assert.match(app, /removeAttribute\('srcset'\)/);
});

test('publicação cria miniaturas junto com novas fotos', async () => {
  const publication = await source('assets/js/modules/portal-runtime/publication.js');
  const packageJson = JSON.parse(await source('package.json'));
  const version = packageJson.version.replaceAll('.', '\\.');
  assert.match(publication, new RegExp(`portal-media-thumbnails\\.js\\?v=${version}`));
  assert.match(publication, /createMemberPhotoThumbnailAssets/);
  assert.match(publication, /publication\.assets\.push/);
});

test('template de aniversário otimizado substitui o PNG pesado', async () => {
  const artwork = await source('assets/js/modules/birthday-artwork.js');
  const optimized = await stat(path.join(root, 'assets/templates/birthday-template.webp'));
  assert.match(artwork, /birthday-template\.webp/);
  assert.ok(optimized.size < 350_000);
  await assert.rejects(stat(path.join(root, 'assets/templates/birthday-template.png')));
});
