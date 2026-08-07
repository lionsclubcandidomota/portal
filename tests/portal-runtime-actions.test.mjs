import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortalRuntimeContext } from '../assets/js/modules/portal-runtime/context.js';
import { createPersistenceActions } from '../assets/js/modules/portal-runtime/persistence.js';
import { createAdminSessionActions } from '../assets/js/modules/portal-runtime/session.js';
import { createRemoteSyncActions } from '../assets/js/modules/portal-runtime/remote-sync.js';
import { createPublicationActions } from '../assets/js/modules/portal-runtime/publication.js';
import { createInterfaceRefreshActions } from '../assets/js/modules/portal-runtime/interface-refresh.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function setup(overrides = {}) {
  let state = overrides.state || {
    settings: { clubName: 'Local', primaryColor: '#00529B' },
    treasury: [],
    events: [],
    meetings: []
  };
  let persistedState = JSON.parse(JSON.stringify(state));
  const calls = [];
  const dependencies = {
    getState: () => state,
    setState: value => { state = value; },
    applySettings: () => calls.push('applySettings'),
    renderCurrentView: () => calls.push('render'),
    updateAccessUI: () => calls.push('access'),
    closePublishCenter: () => calls.push('closeCenter'),
    openPublishCenter: options => calls.push(['openCenter', options]),
    setPublishStatus: status => calls.push(['status', status]),
    toast: message => calls.push(['toast', message]),
    getCurrentView: () => 'dashboard',
    ...overrides.dependencies
  };
  const saved = [];
  const services = {
    loadState: () => JSON.parse(JSON.stringify(persistedState)),
    saveState: value => {
      persistedState = JSON.parse(JSON.stringify(value));
      saved.push(JSON.parse(JSON.stringify(value)));
    },
    connectGitHub: async () => ({
      sha: 'sha-1',
      state: { settings: { clubName: 'Remoto' }, notices: [{ id: 'n1' }] }
    }),
    loadPublicGitHubPayload: async () => ({ state: {}, deploymentId: '' }),
    ...overrides.services
  };
  const context = createPortalRuntimeContext(dependencies, services, {
    storage: createMemoryStorage(),
    window: {
      addEventListener() {},
      setTimeout() {},
      setInterval() {},
      ...(overrides.environment?.window || {})
    },
    document: {
      hidden: false,
      addEventListener() {},
      body: { classList: { remove() {} } },
      ...(overrides.environment?.document || {})
    },
    requestAnimationFrame: overrides.environment?.requestAnimationFrame || (callback => callback())
  });
  return { calls, context, dependencies, getState: () => state, saved, services };
}

function grantAdminAccess(fixture) {
  fixture.context.model.adminUnlocked = true;
  fixture.context.model.accessRole = 'admin';
  fixture.context.model.canWrite = true;
}

test('persistência registra pendência, salva estado sanitizado e abre a Central', () => {
  const fixture = setup({
    state: {
      settings: {},
      treasury: [],
      events: [{ id: 'e1', responsible: 'interno', name: 'Evento' }],
      meetings: []
    }
  });
  grantAdminAccess(fixture);
  const actions = createPersistenceActions(fixture.context);

  actions.persist();

  assert.equal(fixture.context.model.pendingChanges, 1);
  assert.equal(fixture.saved.length, 1);
  assert.equal('responsible' in fixture.saved[0].events[0], false);
  assert.ok(fixture.calls.some(call => Array.isArray(call) && call[0] === 'openCenter' && call[1]?.autoCloseAfter === 4800));
  assert.ok(fixture.calls.some(call => Array.isArray(call) && call[0] === 'status' && call[1] === 'pending'));
});

test('conexão administrativa combina o estado remoto e atualiza o acesso', async () => {
  const fixture = setup();
  const actions = createAdminSessionActions(fixture.context);

  await actions.connectAdminSession('token-seguro');

  assert.equal(fixture.context.model.adminUnlocked, true);
  assert.equal(fixture.context.model.githubToken, 'token-seguro');
  assert.equal(fixture.getState().settings.clubName, 'Remoto');
  assert.equal(fixture.getState().settings.primaryColor, '#00529B');
  assert.deepEqual(fixture.getState().notices, [{ id: 'n1' }]);
  assert.ok(fixture.calls.includes('access'));
});

test('homologação local permite entrar quando a escrita não pôde ser confirmada', async () => {
  const fixture = setup({
    environment: {
      window: { location: { hostname: '127.0.0.1', protocol: 'http:' } }
    },
    services: {
      connectGitHub: async () => ({
        sha: 'sha-local',
        state: { settings: { clubName: 'Homologação' } },
        authorization: {
          canPush: false,
          warning: 'Permissão de escrita não confirmada.'
        }
      })
    }
  });
  const actions = createAdminSessionActions(fixture.context);

  const session = await actions.connectAdminSession('token-seguro');

  assert.equal(fixture.context.model.adminUnlocked, true);
  assert.equal(session.localHomologation, true);
  assert.equal(session.authorization.canPush, false);
});

test('ambiente publicado continua exigindo permissão de escrita confirmada', async () => {
  const fixture = setup({
    environment: {
      window: { location: { hostname: 'lionsclubcandidomota.github.io', protocol: 'https:' } }
    },
    services: {
      connectGitHub: async () => ({
        sha: 'sha-remoto',
        state: { settings: { clubName: 'Produção' } },
        authorization: {
          canPush: false,
          warning: 'O token não possui permissão para publicar.'
        }
      })
    }
  });
  const actions = createAdminSessionActions(fixture.context);

  await assert.rejects(
    actions.connectAdminSession('token-seguro'),
    /não possui permissão para publicar/i
  );
  assert.equal(fixture.context.model.adminUnlocked, false);
});

test('payload remoto atualiza o portal quando não há alterações locais', () => {
  const fixture = setup();
  const remoteSync = createRemoteSyncActions(fixture.context);

  const applied = remoteSync.applyRemotePayload({
    state: { settings: { clubName: 'Publicado' }, notices: [{ id: 'n2' }] },
    deploymentId: 'deploy-1',
    updatedAt: '2026-07-30T20:00:00.000Z'
  });

  assert.equal(applied, true);
  assert.equal(fixture.getState().settings.clubName, 'Publicado');
  assert.deepEqual(fixture.getState().notices, [{ id: 'n2' }]);
  assert.equal(fixture.context.model.lastRemoteVersion, 'deploy-1');
  assert.ok(fixture.calls.includes('render'));
});

test('payload remoto preserva edição local e atualiza apenas a base sincronizada', () => {
  const fixture = setup();
  fixture.context.model.pendingChanges = 2;
  const remoteSync = createRemoteSyncActions(fixture.context);

  remoteSync.applyRemotePayload({
    state: { settings: { clubName: 'Publicado' }, notices: [{ id: 'n3' }] },
    deploymentId: 'deploy-2'
  });

  assert.equal(fixture.getState().settings.clubName, 'Local');
  assert.equal(fixture.context.model.lastSyncedState.settings.clubName, 'Publicado');
  assert.deepEqual(fixture.context.model.lastSyncedState.notices, [{ id: 'n3' }]);
});


test('publicação envia o estado, zera pendências e confirma a propagação', async () => {
  const fixture = setup({
    dependencies: {
      getCurrentView: () => 'admin',
      renderAdmin: () => fixture?.calls.push('renderAdmin')
    },
    services: {
      saveGitHubState: async (_token, state, sha, message) => ({
        sha: `${sha}-novo`,
        commitSha: 'commit-1',
        commitUrl: 'https://example.invalid/commit-1',
        committedAt: '2026-07-30T20:00:00.000Z',
        deploymentId: 'deploy-3',
        state,
        message
      }),
      waitForPagesDeployment: async () => ({
        publishedAt: '2026-07-30T20:01:00.000Z',
        updatedAt: '2026-07-30T20:00:30.000Z'
      })
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token';
  fixture.context.model.githubFileSha = 'sha';
  fixture.context.model.pendingChanges = 2;
  const actions = createPublicationActions(fixture.context);

  await actions.commitPendingChanges();
  await Promise.resolve();

  assert.equal(fixture.context.model.pendingChanges, 0);
  assert.equal(fixture.context.model.githubFileSha, 'sha-novo');
  assert.equal(fixture.context.model.lastRemoteVersion, 'deploy-3');
  assert.equal(fixture.context.model.awaitingPublicDeploymentId, '');
  assert.equal(fixture.context.model.latestCommitInfo.sha, 'commit-1');
  assert.ok(fixture.calls.some(call => Array.isArray(call) && call[0] === 'status' && call[1] === 'published'));
});

test('descarte restaura exatamente a última cópia sincronizada', async () => {
  const fixture = setup({
    dependencies: {
      confirmation: { askConfirmation: async () => true }
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token';
  fixture.context.model.pendingChanges = 3;
  fixture.context.model.lastSyncedState = {
    settings: { clubName: 'Última versão' },
    treasury: [],
    events: [],
    meetings: []
  };
  const actions = createPublicationActions(fixture.context);

  await actions.discardPendingChanges();

  assert.equal(fixture.context.model.pendingChanges, 0);
  assert.equal(fixture.getState().settings.clubName, 'Última versão');
  assert.ok(fixture.calls.includes('render'));
  assert.ok(fixture.calls.some(call => Array.isArray(call) && call[0] === 'status' && call[1] === 'synced'));
});

test('publicação converte foto incorporada e atualiza o estado somente após o envio', async () => {
  const embeddedPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
  let publishedState;
  let publishedAssets;
  const fixture = setup({
    state: {
      settings: { clubName: 'Local', logo: './public/logo.png' },
      birthdays: [{ id: 'b1', name: 'Associado Teste', photo: embeddedPhoto }],
      treasuryAccounts: [],
      treasuryCategories: [],
      familyGroups: [],
      treasury: [],
      events: [],
      meetings: [],
      notices: []
    },
    services: {
      saveGitHubState: async (_token, state, _sha, _message, assets) => {
        publishedState = state;
        publishedAssets = assets;
        return {
          sha: 'data-blob',
          commitSha: 'commit-media',
          deploymentId: 'deploy-media',
          mediaCount: assets.length
        };
      },
      waitForPagesDeployment: async () => ({ publishedAt: '2026-07-30T20:01:00.000Z' })
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token';
  fixture.context.model.githubFileSha = 'old-data-blob';
  fixture.context.model.pendingChanges = 1;
  const actions = createPublicationActions(fixture.context);

  await actions.commitPendingChanges();
  await Promise.resolve();

  assert.equal(publishedAssets.length, 1);
  assert.match(publishedAssets[0].path, /^public\/members\/b1-[a-z0-9]+\.jpg$/);
  assert.equal(publishedState.birthdays[0].photo, `./${publishedAssets[0].path}`);
  assert.equal(fixture.getState().birthdays[0].photo, `./${publishedAssets[0].path}`);
  assert.notEqual(fixture.getState().birthdays[0].photo, embeddedPhoto);
});

test('persistência associa operações ao mesmo lote de auditoria', () => {
  const auditCalls = [];
  const fixture = setup({
    dependencies: {
      auditLog: {
        recordChange(payload) {
          auditCalls.push(payload);
          return { batchId: 'batch-audit-1' };
        }
      }
    }
  });
  grantAdminAccess(fixture);
  const actions = createPersistenceActions(fixture.context);

  actions.persist('Configurações atualizadas.');
  actions.persist('Aviso adicionado.');

  assert.equal(auditCalls.length, 2);
  assert.equal(auditCalls[0].message, 'Configurações atualizadas.');
  assert.equal(auditCalls[1].batchId, 'batch-audit-1');
  assert.equal(fixture.context.model.pendingAuditBatchId, 'batch-audit-1');
});

test('publicação vincula e confirma o lote de auditoria', async () => {
  const auditCalls = [];
  const fixture = setup({
    dependencies: {
      auditLog: {
        activeBatchId: () => 'batch-1',
        ensurePendingBatch: () => 'batch-1',
        linkPublication: (batchId, publication) => auditCalls.push(['link', batchId, publication]),
        confirmPublication: (deploymentId, publishedAt) => auditCalls.push(['confirm', deploymentId, publishedAt])
      }
    },
    services: {
      saveGitHubState: async () => ({
        sha: 'new-data',
        commitSha: 'commit-audit',
        commitUrl: 'https://example.test/commit-audit',
        committedAt: '2026-07-30T21:00:00.000Z',
        deploymentId: 'deploy-audit',
        mediaCount: 0
      }),
      waitForPagesDeployment: async () => ({ publishedAt: '2026-07-30T21:01:00.000Z' })
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token';
  fixture.context.model.githubFileSha = 'data-old';
  fixture.context.model.pendingChanges = 1;
  fixture.context.model.pendingAuditBatchId = 'batch-1';

  const actions = createPublicationActions(fixture.context);
  await actions.commitPendingChanges();
  await Promise.resolve();

  assert.equal(auditCalls[0][0], 'link');
  assert.equal(auditCalls[0][1], 'batch-1');
  assert.equal(auditCalls[0][2].commitSha, 'commit-audit');
  assert.deepEqual(auditCalls[1], ['confirm', 'deploy-audit', '2026-07-30T21:01:00.000Z']);
});

test('importação cria ponto automático antes de substituir o estado', async () => {
  const recoveryCalls = [];
  const fixture = setup({
    dependencies: {
      recoveryCenter: {
        createAutomaticSnapshot: async payload => recoveryCalls.push(payload)
      }
    }
  });
  grantAdminAccess(fixture);
  const actions = createPersistenceActions(fixture.context);

  await actions.importState({
    settings: { clubName: 'Importado' },
    birthdays: [], treasuryAccounts: [], treasuryCategories: [], familyGroups: [],
    treasury: [], events: [], meetings: [], notices: []
  }, { name: 'backup-antigo.json' });

  assert.equal(recoveryCalls.length, 1);
  assert.equal(recoveryCalls[0].reason, 'before-import');
  assert.match(recoveryCalls[0].label, /backup-antigo\.json/);
  assert.equal(fixture.getState().settings.clubName, 'Importado');
});

test('publicação cria ponto de segurança antes do envio ao GitHub', async () => {
  const order = [];
  const fixture = setup({
    dependencies: {
      recoveryCenter: {
        createAutomaticSnapshot: async payload => order.push(['backup', payload.reason])
      }
    },
    services: {
      saveGitHubState: async () => {
        order.push(['publish']);
        return { sha: 'new', commitSha: 'commit', deploymentId: 'deploy', mediaCount: 0 };
      },
      waitForPagesDeployment: async () => ({ publishedAt: '2026-07-30T22:00:00.000Z' })
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token';
  fixture.context.model.pendingChanges = 1;

  await createPublicationActions(fixture.context).commitPendingChanges();
  await Promise.resolve();

  assert.deepEqual(order.slice(0, 2), [['backup', 'before-publication'], ['publish']]);
});

test('falha no ponto de segurança cancela a publicação', async () => {
  let published = false;
  const fixture = setup({
    dependencies: {
      recoveryCenter: {
        createAutomaticSnapshot: async () => { throw new Error('Sem espaço para recuperação.'); }
      }
    },
    services: {
      saveGitHubState: async () => { published = true; }
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token';
  fixture.context.model.pendingChanges = 1;

  await createPublicationActions(fixture.context).commitPendingChanges();

  assert.equal(published, false);
  assert.ok(fixture.calls.some(call => Array.isArray(call) && call[0] === 'toast' && /Sem espaço/.test(call[1])));
});


test('atualização da interface é bloqueada antes de consultar o GitHub quando há pendências', async () => {
  let connections = 0;
  const fixture = setup({
    services: {
      connectGitHub: async () => {
        connections += 1;
        return { sha: 'remote', state: { settings: { clubName: 'Remoto' } } };
      }
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token-mantido';
  fixture.context.model.pendingChanges = 2;

  const result = await createInterfaceRefreshActions(fixture.context).refreshPortalInterface();

  assert.deepEqual(result, { ok: false, reason: 'pending', pendingChanges: 2 });
  assert.equal(connections, 0);
  assert.equal(fixture.context.model.githubToken, 'token-mantido');
  assert.equal(fixture.getState().settings.clubName, 'Local');
});

test('atualização segura restaura a interface inicial e preserva o token administrativo', async () => {
  const fixture = setup({
    dependencies: {
      resetInterfaceState: () => fixture?.calls.push('resetInterface'),
      refreshPublishCenter: () => fixture?.calls.push('refreshCenter'),
      auditLog: { setActor: actor => fixture?.calls.push(['actor', actor?.login || '']) }
    },
    services: {
      connectGitHub: async token => ({
        sha: 'sha-atualizado',
        actor: { login: 'admin-lions' },
        authorization: { canPush: true },
        state: {
          settings: { clubName: 'Portal atualizado' },
          birthdays: [],
          treasuryAccounts: [],
          treasuryCategories: [],
          familyGroups: [],
          treasury: [],
          events: [],
          meetings: [],
          notices: []
        },
        receivedToken: token
      })
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token-em-memoria';
  fixture.context.model.pendingChanges = 0;

  const result = await createInterfaceRefreshActions(fixture.context).refreshPortalInterface();

  assert.deepEqual(result, { ok: true, reason: 'refreshed' });
  assert.equal(fixture.context.model.githubToken, 'token-em-memoria');
  assert.equal(fixture.context.model.githubFileSha, 'sha-atualizado');
  assert.equal(fixture.getState().settings.clubName, 'Portal atualizado');
  assert.ok(fixture.calls.includes('resetInterface'));
  assert.ok(fixture.calls.includes('refreshCenter'));
  assert.ok(fixture.calls.some(call => Array.isArray(call) && call[0] === 'status' && call[1] === 'synced'));
});

test('atualização não substitui o estado quando surge uma pendência durante a consulta remota', async () => {
  const fixture = setup({
    services: {
      connectGitHub: async () => {
        fixture.context.model.pendingChanges = 1;
        return {
          sha: 'sha-remoto',
          state: { settings: { clubName: 'Não deve substituir' } }
        };
      }
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token';

  const result = await createInterfaceRefreshActions(fixture.context).refreshPortalInterface();

  assert.deepEqual(result, { ok: false, reason: 'pending', pendingChanges: 1 });
  assert.equal(fixture.getState().settings.clubName, 'Local');
});

test('logout limpa a sessão e retorna ao Dashboard sem falhar ao remover o ator de auditoria', () => {
  const actorUpdates = [];
  const fixture = setup({
    dependencies: {
      getCurrentView: () => 'admin',
      setView: view => fixture.calls.push(['view', view]),
      auditLog: {
        setActor(value) {
          actorUpdates.push(value);
        }
      }
    }
  });
  grantAdminAccess(fixture);
  fixture.context.model.githubToken = 'token-temporario';
  fixture.context.model.auditActor = { login: 'admin' };
  const actions = createAdminSessionActions(fixture.context);

  assert.doesNotThrow(() => actions.logoutAdmin());
  assert.equal(fixture.context.model.adminUnlocked, false);
  assert.equal(fixture.context.model.githubToken, '');
  assert.equal(fixture.context.model.auditActor, null);
  assert.deepEqual(actorUpdates, [null]);
  assert.ok(fixture.calls.some(call => Array.isArray(call) && call[0] === 'view' && call[1] === 'dashboard'));
});
