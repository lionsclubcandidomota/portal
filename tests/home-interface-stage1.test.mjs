import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_FONT_FAMILY,
  PORTAL_FONT_OPTIONS,
  applyPortalAppearance,
  normalizePortalFont,
  portalFontStack
} from '../assets/js/modules/settings-appearance.js';
import { normalizePortalStateShape } from '../assets/js/core/portal-schema.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(root, relativePath), 'utf8');

test('fontes do portal usam uma lista segura e possuem fallback previsível', () => {
  assert.equal(DEFAULT_FONT_FAMILY, 'modern');
  assert.deepEqual(PORTAL_FONT_OPTIONS.map(option => option.value), ['modern', 'humanist', 'accessible']);
  assert.equal(normalizePortalFont('HUMANIST'), 'humanist');
  assert.equal(normalizePortalFont('desconhecida'), 'modern');
  assert.match(portalFontStack('accessible'), /Verdana/);
});

test('aparência aplica fonte, cores e identificação visual sem depender de fonte externa', () => {
  const properties = new Map();
  const nodes = new Map([
    ['sidebarClubName', { textContent: '' }],
    ['sidebarLogo', { src: '', alt: '', style: {} }],
    ['fallbackLogo', { style: {} }]
  ]);
  const originalDocument = globalThis.document;
  globalThis.document = {
    title: '',
    documentElement: {
      dataset: {},
      style: { setProperty: (name, value) => properties.set(name, value) }
    },
    getElementById: id => nodes.get(id) || null
  };

  try {
    const result = applyPortalAppearance({
      state: {
        settings: {
          clubName: 'Lions Teste',
          primaryColor: '#123456',
          accentColor: '#fedcba',
          fontFamily: 'humanist',
          logo: './public/logo-ui.webp'
        }
      }
    });

    assert.equal(result.fontFamily, 'humanist');
    assert.equal(properties.get('--font-ui'), portalFontStack('humanist'));
    assert.equal(globalThis.document.documentElement.dataset.portalFont, 'humanist');
    assert.equal(nodes.get('sidebarClubName').textContent, 'Lions Teste');
  } finally {
    globalThis.document = originalDocument;
  }
});

test('estado antigo recebe fonte moderna sem alterar o esquema operacional', () => {
  const normalized = normalizePortalStateShape({ settings: { clubName: 'Clube' } });
  assert.equal(normalized.settings.fontFamily, 'modern');
  assert.equal(normalized.settings.clubName, 'Clube');
});

test('tela inicial possui logotipo de boas-vindas alinhado e cabeçalho com relógio semântico', async () => {
  const [dashboard, html, shell, icons] = await Promise.all([
    source('assets/js/modules/dashboard.js'),
    source('index.html'),
    source('assets/js/modules/ui-shell.js'),
    source('assets/icons/ui-icons.svg')
  ]);

  assert.match(dashboard, /dashboard-hero-visual/);
  assert.match(dashboard, /dashboard-hero-logo-wrap/);
  assert.match(dashboard, /resolveDisplayLogo/);
  assert.match(html, /class="clock-card"/);
  assert.match(html, /<time class="clock" id="clock" datetime="">/);
  assert.match(html, /class="topbar-session"/);
  assert.match(shell, /clock\.dateTime = now\.toISOString\(\)/);
  assert.match(icons, /<symbol id="clock"/);
});

test('tipografia e responsividade da etapa 1 permanecem cobertas por CSS e Ajustes', async () => {
  const [css, settings, review] = await Promise.all([
    source('assets/css/components/modern-interface.css'),
    source('assets/js/modules/settings.js'),
    source('assets/js/modules/publication-review.js')
  ]);

  assert.match(css, /Evolução funcional — etapa 1: início, cabeçalho e tipografia/);
  assert.match(css, /\.dashboard-hero-logo\s*\{/);
  assert.match(css, /\.clock-card\s*\{/);
  assert.match(css, /\.authenticated-mode \.topbar-session/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)/);
  assert.match(settings, /name="fontFamily"/);
  assert.match(settings, /PORTAL_FONT_OPTIONS/);
  assert.match(review, /fontFamily: 'Fonte do portal'/);
});
