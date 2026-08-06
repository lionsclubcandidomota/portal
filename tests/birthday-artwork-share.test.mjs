import assert from 'node:assert/strict';
import test from 'node:test';

import { createBirthdayArtworkController } from '../assets/js/modules/birthday-artwork.js';

test('compartilhamento de aniversário envia somente o arquivo da imagem', async () => {
  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;
  const originalCss = globalThis.CSS;
  const originalFile = globalThis.File;

  const sharedPayloads = [];
  const button = { disabled: false, textContent: '' };

  class TestFile extends Blob {
    constructor(parts, name, options = {}) {
      super(parts, options);
      this.name = name;
    }
  }

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      canShare: payload => Array.isArray(payload?.files) && payload.files.length === 1,
      share: async payload => sharedPayloads.push(payload)
    }
  });
  globalThis.document = { querySelector: () => button };
  globalThis.CSS = { escape: value => value };
  globalThis.File = TestFile;

  try {
    const controller = createBirthdayArtworkController({
      getBirthdays: () => [{ id: 'p1', name: 'Pessoa Teste' }],
      toast: () => {},
      createArtwork: async () => new Blob(['imagem'], { type: 'image/png' })
    });

    await controller.share('p1');

    assert.equal(sharedPayloads.length, 1);
    assert.deepEqual(Object.keys(sharedPayloads[0]), ['files']);
    assert.equal(sharedPayloads[0].files.length, 1);
    assert.equal(sharedPayloads[0].files[0].name, 'feliz-aniversario-pessoa-teste.png');
    assert.equal('title' in sharedPayloads[0], false);
    assert.equal('text' in sharedPayloads[0], false);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator
    });
    globalThis.document = originalDocument;
    globalThis.CSS = originalCss;
    globalThis.File = originalFile;
  }
});
