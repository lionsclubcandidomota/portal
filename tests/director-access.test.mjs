import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_ROLES,
  buildDirectorProfile,
  createAccessProfileActions,
  directorProfileFromState,
  hasLegacyDirectorTokenProfile,
  passwordMatchesDirectorProfile
} from '../assets/js/modules/portal-runtime/access-profile.js';
import { createPortalRuntimeContext } from '../assets/js/modules/portal-runtime/context.js';
import { createPersistenceActions } from '../assets/js/modules/portal-runtime/persistence.js';
import { createAdminSessionActions } from '../assets/js/modules/portal-runtime/session.js';
import { createPublicationActions } from '../assets/js/modules/portal-runtime/publication.js';
import { createInterfaceRefreshActions } from '../assets/js/modules/portal-runtime/interface-refresh.js';
import { adminDashboardHtml, adminLoginHtml } from '../assets/js/modules/admin-dashboard/view.js';
import { createAdminDashboardModel } from '../assets/js/modules/admin-dashboard/domain.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function baseState(overrides = {}) {
  return {
    settings: { clubName: 'Lions', accessProfiles: {} },
    birthdays: [],
    treasuryAccounts: [],
    treasuryCategories: [],
    familyGroups: [],
    mutualGroups: [],
    treasury: [],
    events: [],
    meetings: [],
    notices: [],
    ...overrides
  };
}

function setup({ state = baseState(), services = {}, dependencies = {}, location } = {}) {
  let currentState = state;
  const calls = [];
  const saved = [];
  const context = createPortalRuntimeContext({
    getState: () => currentState,
    setState: nextState => { currentState = nextState; },
    applySettings: () => calls.push('settings'),
    renderCurrentView: () => calls.push('render'),
    updateAccessUI: () => calls.push('access'),
    closePublishCenter: () => calls.push('close'),
    refreshPublishCenter: () => calls.push('refresh-center'),
    resetInterfaceState: () => calls.push('reset-interface'),
    setPublishStatus: status => calls.push(['status', status]),
    toast: message => calls.push(['toast', message]),
    getCurrentView: () => 'dashboard',
    ...dependencies
  }, {
    loadState: () => currentState,
    saveState: value => saved.push(structuredClone(value)),
    connectGitHub: async () => ({
      sha: 'remote-sha',
      actor: { login: 'admin-lions', name: 'Administrador Lions' },
      authorization: { verified: true, canPush: true },
      state: baseState()
    }),
    loadPublicGitHubPayload: async () => ({
      state: baseState(),
      deploymentId: 'deploy-publico',
      updatedAt: '2026-07-31T20:00:00.000Z'
    }),
    ...services
  }, {
    storage: createMemoryStorage(),
    window: {
      location: location || { hostname: 'lionsclubcandidomota.github.io', protocol: 'https:' },
      addEventListener() {},
      setTimeout() {},
      setInterval() {}
    },
    document: {
      hidden: false,
      addEventListener() {},
      body: { classList: { remove() {} } }
    },
    requestAnimationFrame: callback => callback()
  });
  return { context, calls, saved, getState: () => currentState };
}

const DIRECTOR_PASSWORD = 'Diretoria2026!';

test('perfil Diretoria reconhece a senha sem armazenar a credencial original', async () => {
  const profile = await buildDirectorProfile(DIRECTOR_PASSWORD, 'admin-lions');
  const state = baseState({ settings: { accessProfiles: { director: profile } } });
  const serialized = JSON.stringify(profile);

  assert.equal(await passwordMatchesDirectorProfile(DIRECTOR_PASSWORD, state), true);
  assert.equal(await passwordMatchesDirectorProfile('Diretoria2027!', state), false);
  assert.doesNotMatch(serialized, new RegExp(DIRECTOR_PASSWORD));
  assert.match(profile.passwordHash, /^[a-f0-9]{64}$/);
  assert.equal(profile.salt.length, 32);
  assert.equal(profile.credentialType, 'password');
  assert.equal(directorProfileFromState(state)?.configuredBy, 'admin-lions');
});

test('perfil antigo por token é identificado como pendente de substituição', () => {
  const state = baseState({
    settings: {
      accessProfiles: {
        director: {
          version: 1,
          salt: 'a'.repeat(32),
          fingerprint: 'b'.repeat(64),
          enabled: true
        }
      }
    }
  });

  assert.equal(directorProfileFromState(state), null);
  assert.equal(hasLegacyDirectorTokenProfile(state), true);
});

test('Administrador configura a senha da Diretoria sem consultar ou salvar um token', async () => {
  let githubCalls = 0;
  const fixture = setup({
    services: {
      connectGitHub: async () => {
        githubCalls += 1;
        throw new Error('não deveria consultar o GitHub');
      }
    }
  });
  fixture.context.model.adminUnlocked = true;
  fixture.context.model.accessRole = ACCESS_ROLES.ADMIN;
  fixture.context.model.canWrite = true;
  fixture.context.model.githubToken = 'github_pat_admin';
  fixture.context.model.auditActor = { login: 'admin-lions' };
  const persistence = createPersistenceActions(fixture.context);
  const actions = createAccessProfileActions(fixture.context, persistence);

  const result = await actions.configureDirectorProfile(DIRECTOR_PASSWORD);
  const profile = fixture.getState().settings.accessProfiles.director;

  assert.equal(result.profile.credentialType, 'password');
  assert.equal(fixture.context.model.pendingChanges, 1);
  assert.equal(fixture.saved.length, 1);
  assert.equal(githubCalls, 0);
  assert.equal(await passwordMatchesDirectorProfile(DIRECTOR_PASSWORD, fixture.getState()), true);
  assert.doesNotMatch(JSON.stringify(profile), new RegExp(DIRECTOR_PASSWORD));
});

test('configuração rejeita senha fraca', async () => {
  const fixture = setup();
  fixture.context.model.adminUnlocked = true;
  fixture.context.model.accessRole = ACCESS_ROLES.ADMIN;
  fixture.context.model.canWrite = true;
  const actions = createAccessProfileActions(fixture.context, createPersistenceActions(fixture.context));

  await assert.rejects(actions.configureDirectorProfile('curta1'), /pelo menos 10 caracteres/i);
  await assert.rejects(actions.configureDirectorProfile('apenasletras'), /letra e um número/i);
  assert.equal(fixture.context.model.pendingChanges, 0);
});

test('login da Diretoria usa a senha e os dados públicos sem exigir token GitHub', async () => {
  const profile = await buildDirectorProfile(DIRECTOR_PASSWORD, 'admin-lions');
  const remoteState = baseState({
    settings: { clubName: 'Portal remoto', accessProfiles: { director: profile } },
    notices: [{ id: 'n1', title: 'Aviso visível' }]
  });
  let githubCalls = 0;
  const fixture = setup({
    services: {
      connectGitHub: async () => {
        githubCalls += 1;
        throw new Error('Diretoria não deve usar token');
      },
      loadPublicGitHubPayload: async () => ({
        state: remoteState,
        deploymentId: 'deploy-diretoria',
        updatedAt: '2026-07-31T20:00:00.000Z'
      })
    }
  });

  const result = await createAdminSessionActions(fixture.context).connectDirectorSession(DIRECTOR_PASSWORD);

  assert.equal(result.accessRole, ACCESS_ROLES.DIRECTOR);
  assert.equal(result.canWrite, false);
  assert.equal(fixture.context.model.adminUnlocked, true);
  assert.equal(fixture.context.model.canWrite, false);
  assert.equal(fixture.context.model.githubToken, '');
  assert.equal(fixture.getState().settings.clubName, 'Portal remoto');
  assert.equal(fixture.getState().notices[0].title, 'Aviso visível');
  assert.equal(githubCalls, 0);
});

test('login da Diretoria é bloqueado quando existem alterações locais pendentes', async () => {
  const fixture = setup();
  fixture.context.model.pendingChanges = 2;

  await assert.rejects(
    createAdminSessionActions(fixture.context).connectDirectorSession(DIRECTOR_PASSWORD),
    /alterações locais pendentes/i
  );
  assert.equal(fixture.context.model.adminUnlocked, false);
});

test('atualização do painel da Diretoria permanece autenticada sem token', async () => {
  const profile = await buildDirectorProfile(DIRECTOR_PASSWORD, 'admin-lions');
  const firstState = baseState({ settings: { clubName: 'Primeiro', accessProfiles: { director: profile } } });
  const secondState = baseState({ settings: { clubName: 'Atualizado', accessProfiles: { director: profile } } });
  const fixture = setup({
    state: firstState,
    services: {
      loadPublicGitHubPayload: async () => ({ state: secondState, deploymentId: 'deploy-2' })
    }
  });
  fixture.context.model.adminUnlocked = true;
  fixture.context.model.accessRole = ACCESS_ROLES.DIRECTOR;
  fixture.context.model.canWrite = false;

  const result = await createInterfaceRefreshActions(fixture.context).refreshPortalInterface();

  assert.deepEqual(result, { ok: true, reason: 'refreshed' });
  assert.equal(fixture.getState().settings.clubName, 'Atualizado');
  assert.equal(fixture.context.model.accessRole, ACCESS_ROLES.DIRECTOR);
  assert.equal(fixture.context.model.githubToken, '');
  assert.ok(fixture.calls.includes('reset-interface'));
});

test('camadas de persistência e publicação bloqueiam escrita da Diretoria', async () => {
  const fixture = setup({
    state: baseState({ settings: { clubName: 'Alteração indevida' } })
  });
  fixture.context.model.adminUnlocked = true;
  fixture.context.model.accessRole = ACCESS_ROLES.DIRECTOR;
  fixture.context.model.canWrite = false;
  fixture.context.model.pendingChanges = 1;
  fixture.context.model.lastSyncedState = baseState({ settings: { clubName: 'Versão sincronizada' } });

  const persistResult = createPersistenceActions(fixture.context).persist('Tentativa de alteração.');
  const publishResult = await createPublicationActions(fixture.context).commitPendingChanges();

  assert.deepEqual(persistResult, { ok: false, reason: 'read-only' });
  assert.deepEqual(publishResult, { ok: false, reason: 'read-only' });
  assert.equal(fixture.getState().settings.clubName, 'Versão sincronizada');
  assert.ok(fixture.calls.some(call => Array.isArray(call) && /somente leitura/i.test(call[1])));
});

test('tela de entrada mantém apenas a escolha do perfil e os campos necessários', () => {
  const html = adminLoginHtml();
  assert.match(html, /<p>Escolha o perfil de acesso\.<\/p>/);
  assert.match(html, /Token de acesso do GitHub/);
  assert.match(html, /Senha da Diretoria/);
  assert.match(html, /placeholder="Informe a senha da Diretoria"/);
  assert.match(html, /name="directorAccessPassword"/);
  assert.match(html, /autocomplete="new-password"/);
  assert.match(html, /id="directorPassword"[^>]*disabled/);
  assert.doesNotMatch(html, /autocomplete="current-password"/);
  assert.match(html, /id="adminLoginForm"/);
  assert.match(html, /id="directorLoginForm"/);
  assert.doesNotMatch(html, /token Diretoria/i);
  assert.doesNotMatch(html, /Gestão completa/i);
  assert.doesNotMatch(html, /Somente leitura/i);
  assert.doesNotMatch(html, /Credencial administrativa/i);
  assert.doesNotMatch(html, /permissão de leitura e gravação/i);
  assert.doesNotMatch(html, /sessão é bloqueada/i);
  assert.doesNotMatch(html, /todas as consultas e relatórios/i);
});

test('Dashboard Diretoria mantém relatórios e consultas, mas remove ações de alteração', () => {
  const model = createAdminDashboardModel(baseState(), {
    periodPreset: 'current-month',
    now: new Date(2026, 6, 31)
  });
  const html = adminDashboardHtml(model, { canWrite: false, accessRole: ACCESS_ROLES.DIRECTOR });

  assert.match(html, /Área da Diretoria/);
  assert.match(html, /Gerar relatório/);
  assert.match(html, /Histórico de alterações/);
  assert.match(html, /Baixar backup/);
  assert.doesNotMatch(html, /data-add=/);
  assert.doesNotMatch(html, /id="importBtn"/);
  assert.doesNotMatch(html, /id="openRecoveryCenterBtn"/);
});
