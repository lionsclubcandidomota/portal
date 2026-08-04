import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TREASURY_ATTACHMENT_LIMITS,
  approximateDataUrlBytes,
  attachmentReference,
  formatAttachmentSize,
  isSupportedTreasuryAttachment,
  validateTreasuryAttachmentCollection
} from '../assets/js/modules/treasury-admin/attachments.js';
import { buildPublicationReview } from '../assets/js/modules/publication-review.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = relativePath => readFile(path.join(root, relativePath), 'utf8');

const baseState = () => ({
  settings: { clubName: 'Lions' },
  birthdays: [], treasuryAccounts: [], treasuryCategories: [], familyGroups: [], mutualGroups: [],
  treasury: [], events: [], meetings: [], notices: []
});

test('valida formatos, limites e referências seguras de anexos financeiros', () => {
  assert.equal(isSupportedTreasuryAttachment({ name: 'nota.pdf', type: 'application/pdf' }), true);
  assert.equal(isSupportedTreasuryAttachment({ name: 'planilha.xlsx', type: '' }), true);
  assert.equal(isSupportedTreasuryAttachment({ name: 'programa.exe', type: 'application/octet-stream' }), false);
  assert.equal(approximateDataUrlBytes('data:text/plain;base64,dGVzdGU='), 6);
  assert.equal(formatAttachmentSize(1024), '1.0 KB');
  assert.match(attachmentReference({ url: './public/treasury/mov-1/doc-1.pdf' }), /public\/treasury/);
  assert.equal(attachmentReference({ url: 'javascript:alert(1)' }), '');

  const tooMany = Array.from({ length: TREASURY_ATTACHMENT_LIMITS.maxFiles + 1 }, (_, index) => ({ size: 10, id: String(index) }));
  assert.throws(() => validateTreasuryAttachmentCollection(tooMany), /no máximo/);
  assert.throws(() => validateTreasuryAttachmentCollection([{ size: TREASURY_ATTACHMENT_LIMITS.maxTotalStoredBytes + 1 }]), /total dos anexos/);
});

test('revisão de publicação resume anexos sem expor o conteúdo Base64', () => {
  const before = baseState();
  const after = baseState();
  after.treasury = [{
    id: 'mov-1', description: 'Pagamento', date: '2026-08-04', entry: 15, exit: 0,
    attachments: [{ id: 'att-1', name: 'Comprovante.pdf', dataUrl: 'data:application/pdf;base64,SEGREDOBASE64' }]
  }];

  const review = buildPublicationReview(before, after);
  const treasury = review.groups.find(group => group.key === 'treasury');
  const attachmentField = treasury.changes[0].fields.find(field => field.field === 'attachments');
  assert.match(attachmentField.after, /1 anexo\(s\): Comprovante\.pdf/);
  assert.doesNotMatch(JSON.stringify(review), /SEGREDOBASE64/);
});

test('interface oferece múltiplos anexos e consulta posterior na movimentação', async () => {
  const [entries, movements, css] = await Promise.all([
    source('assets/js/modules/treasury-admin/entries.js'),
    source('assets/js/modules/treasury/movements.js'),
    source('assets/css/pages/treasury-records.css')
  ]);

  assert.match(entries, /type="file"|renderTreasuryAttachmentPicker/);
  assert.match(entries, /data\.attachments = attachmentPicker\.getAttachments\(\)/);
  assert.match(movements, /treasury-attachment-gallery/g);
  assert.match(movements, /Visualizar/);
  assert.match(movements, /download/);
  assert.match(css, /\.treasury-attachment-dropzone/);
  assert.match(css, /\.treasury-attachment-gallery/);
});

test('publicação pode ser minimizada sem interromper o processo', async () => {
  const [publishCenter, html, css] = await Promise.all([
    source('assets/js/modules/publish-center.js'),
    source('index.html'),
    source('assets/css/components/publication-center.css')
  ]);

  assert.match(publishCenter, /busyDismissed/);
  assert.match(publishCenter, /Minimizar sem interromper/);
  assert.match(publishCenter, /const isBusy = \['syncing', 'publishing'\]\.includes\(status\)/);
  assert.doesNotMatch(publishCenter, /if \(isBusy \|\| isError/);
  assert.match(html, /O processo continua mesmo com esta janela minimizada/);
  assert.match(css, /\.sync-header\.is-busy\.is-minimized/);
});

test('notificações usam componente único com variações semânticas', async () => {
  const [shell, css] = await Promise.all([
    source('assets/js/modules/ui-shell.js'),
    source('assets/css/components/interaction-foundation.css')
  ]);

  assert.match(shell, /portal-toast/);
  assert.match(shell, /type === 'error' \|\| type === 'warning' \? 'alert' : 'status'/);
  assert.match(shell, /success|warning|error|info/);
  assert.match(css, /\.portal-toast\.is-success/);
  assert.match(css, /\.portal-toast\.is-warning/);
  assert.match(css, /\.portal-toast\.is-error/);
  assert.match(css, /\.portal-toast\{--toast-tone:var\(--primary\)/);
});
