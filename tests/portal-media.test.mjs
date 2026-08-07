import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countEmbeddedPortalMedia,
  normalizePublicMediaReference,
  parseEmbeddedFile,
  parseEmbeddedImage,
  preparePortalMediaForPublication,
  publicMediaPathFromReference,
  stableMediaHash
} from '../assets/js/core/portal-media.js';

const tinyJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const tinyPdf = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg==';

test('reconhece imagens incorporadas compatíveis e rejeita outros dados', () => {
  const image = parseEmbeddedImage(tinyJpeg);
  assert.equal(image.contentType, 'image/jpeg');
  assert.equal(image.extension, 'jpg');
  assert.ok(image.content.startsWith('/9j/'));
  assert.equal(parseEmbeddedImage('https://example.test/foto.jpg'), null);
  assert.equal(parseEmbeddedImage('data:text/plain;base64,dGVzdGU='), null);
});


test('reconhece documentos financeiros incorporados sem tratá-los como imagens', () => {
  const document = parseEmbeddedFile(tinyPdf);
  assert.equal(document.contentType, 'application/pdf');
  assert.equal(document.extension, 'pdf');
  assert.equal(parseEmbeddedImage(tinyPdf), null);
});

test('prepara fotos e logotipo como ativos externos sem alterar o estado original', () => {
  const original = {
    settings: { logo: tinyPng },
    birthdays: [{ id: 'b 1', name: 'João Teste', photo: tinyJpeg }]
  };
  const prepared = preparePortalMediaForPublication(original);

  assert.equal(prepared.assets.length, 2);
  assert.equal(prepared.convertedCount, 2);
  assert.match(prepared.state.birthdays[0].photo, /^\.\/public\/members\/b-1-[a-z0-9]+\.jpg$/);
  assert.match(prepared.state.settings.logo, /^\.\/public\/branding\/club-logo-[a-z0-9]+\.png$/);
  assert.equal(original.birthdays[0].photo, tinyJpeg);
  assert.equal(original.settings.logo, tinyPng);
});


test('publica anexos financeiros em diretório próprio e mantém o estado original intacto', () => {
  const original = {
    settings: {},
    birthdays: [],
    treasury: [{
      id: 'mov 1',
      description: 'Pagamento',
      attachments: [{
        id: 'doc 1',
        name: 'Comprovante.pdf',
        type: 'application/pdf',
        size: 18,
        dataUrl: tinyPdf
      }]
    }]
  };
  const prepared = preparePortalMediaForPublication(original);

  assert.equal(prepared.assets.length, 1);
  assert.equal(prepared.assets[0].kind, 'treasury-attachment');
  assert.match(prepared.assets[0].path, /^public\/treasury\/mov-1\/doc-1-[a-z0-9]+\.pdf$/);
  assert.match(prepared.state.treasury[0].attachments[0].url, /^\.\/public\/treasury\/mov-1\/doc-1-[a-z0-9]+\.pdf$/);
  assert.equal(prepared.state.treasury[0].attachments[0].dataUrl, undefined);
  assert.equal(original.treasury[0].attachments[0].dataUrl, tinyPdf);
  assert.equal(countEmbeddedPortalMedia(original), 1);
});

test('mantém referências externas e normaliza caminhos públicos sem duplicar prefixo', () => {
  const prepared = preparePortalMediaForPublication({
    settings: { logo: 'public/logo.png' },
    birthdays: [
      { id: 'b1', name: 'A', photo: 'public/members/a.jpg' },
      { id: 'b2', name: 'B', photo: 'https://cdn.example.test/b.jpg' }
    ]
  });

  assert.equal(prepared.assets.length, 0);
  assert.equal(prepared.state.settings.logo, './public/logo.png');
  assert.equal(prepared.state.birthdays[0].photo, './public/members/a.jpg');
  assert.equal(prepared.state.birthdays[1].photo, 'https://cdn.example.test/b.jpg');
});

test('conta mídia incorporada e converte referência local para caminho de repositório', () => {
  const state = {
    settings: { logo: tinyPng },
    birthdays: [{ photo: tinyJpeg }, { photo: './public/members/pronta.jpg' }]
  };
  assert.equal(countEmbeddedPortalMedia(state), 2);
  assert.equal(publicMediaPathFromReference('./public/members/pronta.jpg'), 'public/members/pronta.jpg');
  assert.equal(publicMediaPathFromReference('https://example.test/foto.jpg'), '');
  assert.equal(normalizePublicMediaReference('public/members/a.jpg'), './public/members/a.jpg');
});

test('hash de mídia é determinístico e muda com o conteúdo', () => {
  assert.equal(stableMediaHash('abc'), stableMediaHash('abc'));
  assert.notEqual(stableMediaHash('abc'), stableMediaHash('abd'));
});
