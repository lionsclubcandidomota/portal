import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relative => readFile(path.join(root, relative), 'utf8');

test('atualização remota renderiza a tela atual sem redefinir controladores e navegação', async () => {
  const [refresh, app, navigation] = await Promise.all([
    source('assets/js/modules/portal-runtime/interface-refresh.js'),
    source('assets/js/modules/portal-app.js'),
    source('assets/js/modules/navigation.js')
  ]);

  assert.match(refresh, /dependencies\.renderCurrentView\?\.\(\)/);
  assert.doesNotMatch(refresh, /dependencies\.resetInterfaceState\?\.\(\)/);
  assert.match(app, /renderPreservingContext/);
  assert.match(navigation, /preserveContext = previousView === view/);
  assert.match(navigation, /restoreInterfaceContext/);
});

test('tela de Ajustes está dividida por identidade, visual, mensalidades e acesso', async () => {
  const [settings, css] = await Promise.all([
    source('assets/js/modules/settings.js'),
    source('assets/css/pages/settings.css')
  ]);

  assert.match(settings, /Personalize sem complicação/);
  assert.match(settings, /id="settingsIdentity"/);
  assert.match(settings, /id="settingsAppearance"/);
  assert.match(settings, /id="settingsFees"/);
  assert.match(settings, /settings-live-preview/);
  assert.match(settings, /settings-savebar/);
  assert.match(css, /\.settings-appearance-grid/);
  assert.match(css, /\.settings-savebar/);
});

test('central de publicação usa linguagem direta e mantém o trabalho em contexto', async () => {
  const [html, controller, css] = await Promise.all([
    source('index.html'),
    source('assets/js/modules/publish-center.js'),
    source('assets/css/components/publication-center.css')
  ]);

  assert.match(html, /Manter o portal atualizado/);
  assert.match(html, /Conferir mudanças/);
  assert.match(html, /Publicar agora/);
  assert.match(controller, /Tudo em dia/);
  assert.match(controller, /mudança\$\{displayCount === 1/);
  assert.match(css, /central de publicação mais clara e compacta/);
  assert.match(css, /#publishCenterDiscard\{grid-column:2;width:100%\!important\}/);
});
