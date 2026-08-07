import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicationMessage,
  mergePortalStates,
  normalizePendingChanges,
  remotePayloadVersion,
  remoteRefreshInterval,
  selectCachedState,
  shouldAcceptStartupPayload,
  shouldApplyRemotePayload
} from '../assets/js/modules/portal-runtime/domain.js';

test('normaliza o contador de alterações pendentes', () => {
  assert.equal(normalizePendingChanges('3.9'), 3);
  assert.equal(normalizePendingChanges(-2), 0);
  assert.equal(normalizePendingChanges('inválido'), 0);
});

test('combina dados remotos preservando configurações locais não substituídas', () => {
  const merged = mergePortalStates(
    { settings: { clubName: 'Local', primaryColor: '#000' }, notices: ['local'] },
    { settings: { clubName: 'Remoto' }, notices: ['remoto'] }
  );

  assert.deepEqual(merged.settings, { clubName: 'Remoto', primaryColor: '#000' });
  assert.deepEqual(merged.notices, ['remoto']);
});

test('gera mensagem padrão de publicação e respeita mensagem personalizada', () => {
  assert.equal(buildPublicationMessage(1), 'Atualiza painel Lions (1 alteração)');
  assert.equal(buildPublicationMessage(4), 'Atualiza painel Lions (4 alterações)');
  assert.equal(buildPublicationMessage(4, '  Revisão mensal  '), 'Revisão mensal');
});

test('seleciona cópia sincronizada somente quando não existem pendências', () => {
  const synced = { settings: { clubName: 'Sincronizado' } };
  const local = { settings: { clubName: 'Local' } };
  const selected = selectCachedState({
    pendingChanges: 0,
    lastSyncedState: synced,
    localState: local
  });

  assert.deepEqual(selected, synced);
  assert.notEqual(selected, synced);
  assert.equal(selectCachedState({ pendingChanges: 2, lastSyncedState: synced, localState: local }), local);
});

test('interpreta a versão de um payload remoto', () => {
  assert.equal(remotePayloadVersion({ deploymentId: 'deploy-1', updatedAt: 'date' }), 'deploy-1');
  assert.equal(remotePayloadVersion({ updatedAt: 'date' }), 'date');
  assert.equal(remotePayloadVersion({}), '');
});

test('protege a inicialização enquanto uma publicação conhecida ainda propaga', () => {
  assert.equal(shouldAcceptStartupPayload({
    knownVersion: 'old',
    remoteVersion: 'other',
    awaitingDeploymentId: 'new'
  }), false);
  assert.equal(shouldAcceptStartupPayload({
    knownVersion: 'old',
    remoteVersion: 'new',
    awaitingDeploymentId: ''
  }), true);
});

test('aceita somente payload remoto novo ou sem versão', () => {
  assert.equal(shouldApplyRemotePayload({
    awaitingDeploymentId: 'deploy-new',
    remoteVersion: 'deploy-old',
    lastRemoteVersion: 'deploy-old'
  }), false);
  assert.equal(shouldApplyRemotePayload({
    awaitingDeploymentId: 'deploy-new',
    remoteVersion: 'deploy-new',
    lastRemoteVersion: 'deploy-old'
  }), true);
  assert.equal(shouldApplyRemotePayload({ remoteVersion: 'same', lastRemoteVersion: 'same' }), false);
  assert.equal(shouldApplyRemotePayload({ remoteVersion: '', lastRemoteVersion: 'same' }), true);
});

test('usa intervalo de atualização mais conservador na sessão administrativa', () => {
  assert.equal(remoteRefreshInterval(false), 60000);
  assert.equal(remoteRefreshInterval(true), 60000);
});
