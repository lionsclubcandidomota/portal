import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  locationFieldsHtml,
  normalizeLocationData
} from '../assets/js/modules/entity-forms/templates.js';
import {
  locationInfo,
  renderLocation
} from '../assets/js/modules/appointments.js';
import {
  birthdayDesktopShareHtml,
  birthdaySharePayload
} from '../assets/js/modules/birthday-artwork.js';
import { birthdayShareButton } from '../assets/js/modules/birthdays.js';
import { adminLoginHtml } from '../assets/js/modules/admin-dashboard/view.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('compromisso online aceita link vazio e preserva o tipo virtual', () => {
  const normalized = normalizeLocationData({
    locationType: 'virtual',
    onlineUrl: '',
    location: 'valor antigo'
  });

  assert.equal(normalized.locationType, 'virtual');
  assert.equal(normalized.onlineUrl, '');
  assert.equal(normalized.location, '');
  assert.throws(
    () => normalizeLocationData({ locationType: 'virtual', onlineUrl: 'link inválido' }),
    /Confira o link informado/
  );
});

test('formulário informa que o link online é opcional', () => {
  const html = locationFieldsHtml({ locationType: 'virtual' }, '<span>*</span>');
  const onlineInput = html.match(/<input name="onlineUrl"[^>]*>/)?.[0] || '';

  assert.match(html, /Link de acesso/);
  assert.match(html, /opcional/);
  assert.match(html, /Pode ser adicionado depois/);
  assert.doesNotMatch(onlineInput, /\srequired(?:\s|>)/);
});

test('agenda identifica evento online sem link como acesso pendente', () => {
  const info = locationInfo({ locationType: 'virtual', onlineUrl: '' });
  const html = renderLocation({ locationType: 'virtual', onlineUrl: '' });

  assert.deepEqual(info, {
    type: 'virtual',
    url: '',
    pending: true,
    name: 'Evento online',
    icon: '🌐'
  });
  assert.match(html, /Link será disponibilizado/);
  assert.doesNotMatch(html, /href=/);
});

test('compartilhamento de aniversário não adiciona mensagem automática', async () => {
  const file = { name: 'parabens.png' };
  const payload = birthdaySharePayload({ name: 'Pessoa Teste' }, file);
  const source = await readFile(path.join(projectRoot, 'assets/js/modules/birthday-artwork.js'), 'utf8');

  assert.equal(payload.title, 'Feliz aniversário, Pessoa Teste!');
  assert.deepEqual(payload.files, [file]);
  assert.equal('text' in payload, false);
  assert.doesNotMatch(source, /A arte foi baixada e está pronta para compartilhar/);
});

test('visitante encontra ação de parabéns no computador e alternativas de envio', () => {
  const button = birthdayShareButton({ id: 'pessoa-1' }, 0);
  const desktop = birthdayDesktopShareHtml(
    { name: 'Pessoa Teste' },
    'blob:imagem',
    { canCopy: true }
  );

  assert.match(button, /data-birthday-share="pessoa-1"/);
  assert.match(button, /Enviar parabéns/);
  assert.match(desktop, /Copiar imagem/);
  assert.match(desktop, /Baixar imagem/);
  assert.match(desktop, /Abrir WhatsApp/);
});

test('entrada administrativa solicita credencial sem expor token ou GitHub', () => {
  const html = adminLoginHtml();

  assert.match(html, /Credencial de acesso/);
  assert.match(html, /Informe sua credencial de Administrador/);
  assert.match(html, /Entrar como Administrador/);
  assert.doesNotMatch(html, /Token de acesso/i);
  assert.doesNotMatch(html, /name="token"/i);
  assert.doesNotMatch(html, />[^<]*GitHub[^<]*</i);
});
