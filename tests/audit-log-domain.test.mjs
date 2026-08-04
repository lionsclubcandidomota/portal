import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditLogSummary,
  closeAuditBatch,
  confirmAuditPublication,
  createAuditEntry,
  groupAuditBatches,
  linkAuditPublication,
  normalizeAuditActor,
  pendingAuditBatchId,
  sanitizeAuditReview
} from '../assets/js/modules/audit-log/domain.js';

const review = {
  total: 1,
  fieldsTotal: 2,
  groups: [{
    key: 'events',
    title: 'Agenda',
    icon: '🗓️',
    changes: [{
      type: 'updated',
      title: 'Reunião mensal',
      description: 'Agendamento atualizado',
      fields: [
        { label: 'Data', before: '01/08/2026', after: '02/08/2026' },
        { label: 'Senha', before: 'Senha anterior protegida', after: 'Nova senha protegida' }
      ]
    }]
  }]
};

test('normaliza o administrador sem armazenar token ou e-mail', () => {
  const actor = normalizeAuditActor({
    id: 12,
    login: 'joao-admin',
    name: 'João',
    avatar_url: 'https://example.test/avatar.png',
    token: 'segredo',
    email: 'privado@example.test'
  });

  assert.deepEqual(actor, {
    id: '12',
    login: 'joao-admin',
    name: 'João',
    avatarUrl: 'https://example.test/avatar.png'
  });
  assert.equal('token' in actor, false);
  assert.equal('email' in actor, false);
});


test('logout pode limpar o ator de auditoria sem gerar erro', () => {
  assert.deepEqual(normalizeAuditActor(null), {
    id: '',
    login: '',
    name: 'Administrador',
    avatarUrl: ''
  });
});

test('cria uma operação pendente com revisão sanitizada', () => {
  const entry = createAuditEntry({
    id: 'change-1',
    batchId: 'batch-1',
    now: '2026-07-30T20:00:00.000Z',
    message: 'Evento atualizado.',
    actor: { login: 'joao' },
    review
  });

  assert.equal(entry.status, 'pending');
  assert.equal(entry.batchId, 'batch-1');
  assert.equal(entry.review.total, 1);
  assert.equal(entry.review.fieldsTotal, 2);
  assert.equal(entry.actor.name, 'joao');
  assert.equal(pendingAuditBatchId([entry]), 'batch-1');
});

test('não cria registro quando não existe diferença real', () => {
  assert.equal(createAuditEntry({ review: { groups: [] } }), null);
  assert.deepEqual(sanitizeAuditReview({ groups: [{ changes: [] }] }), {
    total: 0,
    fieldsTotal: 0,
    groups: []
  });
});

test('associa o lote ao commit e confirma a publicação pública', () => {
  const entry = createAuditEntry({ id: 'c1', batchId: 'b1', review });
  const linked = linkAuditPublication([entry], 'b1', {
    commitSha: 'abcdef123456',
    commitUrl: 'https://example.test/commit',
    committedAt: '2026-07-30T20:01:00.000Z',
    deploymentId: 'deploy-1',
    message: 'Atualiza portal'
  });
  assert.equal(linked[0].status, 'published');
  assert.equal(linked[0].publication.commitSha, 'abcdef123456');

  const confirmed = confirmAuditPublication(linked, 'deploy-1', '2026-07-30T20:02:00.000Z');
  assert.equal(confirmed[0].status, 'confirmed');
  assert.equal(confirmed[0].publication.confirmedAt, '2026-07-30T20:02:00.000Z');
});

test('descarta lote e agrupa o histórico por publicação', () => {
  const first = createAuditEntry({ id: 'c1', batchId: 'b1', now: '2026-07-30T20:00:00.000Z', review });
  const second = createAuditEntry({ id: 'c2', batchId: 'b1', now: '2026-07-30T20:01:00.000Z', review, message: 'Outra alteração' });
  const discarded = closeAuditBatch([first, second], 'b1', 'discarded', 'Cancelado pelo administrador.');
  const batches = groupAuditBatches(discarded, { status: 'discarded', query: 'agenda' });
  const summary = auditLogSummary(discarded);

  assert.equal(batches.length, 1);
  assert.equal(batches[0].operations, 2);
  assert.equal(batches[0].status, 'discarded');
  assert.equal(summary.operations, 2);
  assert.equal(summary.discardedBatches, 1);
});
