import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SCHEMA_VERSION } from '../assets/js/core/portal-schema.js';
import {
  GITHUB_CONFIG,
  loadPublicGitHubPayload,
  saveGitHubState
} from '../assets/js/github.js';

test('configuração do GitHub aponta para o repositório público correto', () => {
  assert.deepEqual(GITHUB_CONFIG, {
    owner: 'lionsclubcandidomota',
    repo: 'portal',
    branch: 'main',
    path: 'data/dados.json',
    publicBaseUrl: 'https://lionsclubcandidomota.github.io/portal/'
  });
});

test('carregamento público migra payload v2 antes de entregá-lo ao portal', async t => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      app: 'Lions',
      version: 2,
      updatedAt: '2026-01-01T00:00:00.000Z',
      deploymentId: 'legacy-deploy',
      data: { settings: { clubName: 'Remoto antigo' }, treasury: [] }
    })
  });
  t.after(() => { globalThis.fetch = previousFetch; });

  const payload = await loadPublicGitHubPayload('https://example.test/dados.json');
  assert.equal(payload.state.settings.clubName, 'Remoto antigo');
  assert.deepEqual(payload.state.events, []);
  assert.equal(payload.deploymentId, 'legacy-deploy');
});

test('publicação cria um único commit com JSON versionado e ativos de mídia', async t => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  let blobIndex = 0;

  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: String(url), method, body });

    if (String(url).includes('/contents/data/dados.json')) {
      return { ok: true, status: 200, json: async () => ({ sha: 'old-sha' }) };
    }
    if (String(url).includes('/git/ref/heads/')) {
      return { ok: true, status: 200, json: async () => ({ object: { sha: 'head-sha' } }) };
    }
    if (String(url).includes('/git/commits/head-sha')) {
      return { ok: true, status: 200, json: async () => ({ tree: { sha: 'base-tree-sha' } }) };
    }
    if (String(url).endsWith('/git/blobs')) {
      blobIndex += 1;
      return { ok: true, status: 201, json: async () => ({ sha: `blob-${blobIndex}` }) };
    }
    if (String(url).endsWith('/git/trees')) {
      return { ok: true, status: 201, json: async () => ({ sha: 'new-tree-sha' }) };
    }
    if (String(url).endsWith('/git/commits')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ sha: 'commit-sha', html_url: 'https://example.test/commit' })
      };
    }
    if (String(url).includes('/git/refs/heads/')) {
      return { ok: true, status: 200, json: async () => ({}) };
    }
    throw new Error(`Requisição inesperada: ${method} ${url}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const result = await saveGitHubState('token-seguro', {
    settings: { clubName: 'Publicação', initialized: true },
    birthdays: [],
    treasuryAccounts: [],
    treasuryCategories: [],
    familyGroups: [],
    treasury: [],
    events: [],
    meetings: [],
    notices: []
  }, 'old-sha', 'Publica portal', [{
    path: 'public/members/b1-foto.jpg',
    content: '/9j/AA==',
    encoding: 'base64'
  }]);

  const blobRequests = requests.filter(item => item.url.endsWith('/git/blobs'));
  assert.equal(blobRequests.length, 2);
  const json = Buffer.from(blobRequests[1].body.content, 'base64').toString('utf8');
  const payload = JSON.parse(json);
  assert.equal(payload.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(payload.version, CURRENT_SCHEMA_VERSION);
  assert.equal(payload.data.settings.clubName, 'Publicação');
  assert.ok(payload.deploymentId);

  const treeRequest = requests.find(item => item.url.endsWith('/git/trees'));
  assert.deepEqual(treeRequest.body.tree.map(item => item.path), [
    'public/members/b1-foto.jpg',
    'data/dados.json'
  ]);
  assert.equal(result.sha, 'blob-2');
  assert.equal(result.commitSha, 'commit-sha');
  assert.equal(result.mediaCount, 1);
});

test('publicação bloqueia quando o JSON remoto mudou desde a conexão', async t => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ sha: 'sha-remoto-novo' })
  });
  t.after(() => { globalThis.fetch = previousFetch; });

  await assert.rejects(
    saveGitHubState('token-seguro', {}, 'sha-antigo'),
    /Conflito de edição/
  );
});

test('identificação do usuário autenticado preserva apenas dados públicos necessários', async t => {
  const { loadAuthenticatedGitHubUser } = await import('../assets/js/github.js');
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 42,
      login: 'joao-lions',
      name: 'João',
      avatar_url: 'https://example.test/avatar.png',
      email: 'privado@example.test'
    })
  });
  t.after(() => { globalThis.fetch = previousFetch; });

  const actor = await loadAuthenticatedGitHubUser('token-seguro');
  assert.deepEqual(actor, {
    id: '42',
    login: 'joao-lions',
    name: 'João',
    avatarUrl: 'https://example.test/avatar.png'
  });
  assert.equal('email' in actor, false);
});

test('autorização do repositório confirma permissão de publicação', async t => {
  const { loadRepositoryAuthorization } = await import('../assets/js/github.js');
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      full_name: 'lionsclubcandidomota/portal',
      default_branch: 'main',
      private: false,
      archived: false,
      disabled: false,
      permissions: { pull: true, push: true }
    })
  });
  t.after(() => { globalThis.fetch = previousFetch; });

  const authorization = await loadRepositoryAuthorization('token-seguro');
  assert.deepEqual(authorization, {
    repository: 'lionsclubcandidomota/portal',
    branch: 'main',
    canPush: true,
    verified: true,
    warning: '',
    private: false
  });
});

test('autorização informa token sem permissão de gravação sem bloquear a homologação', async t => {
  const { loadRepositoryAuthorization } = await import('../assets/js/github.js');
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      full_name: 'lionsclubcandidomota/portal',
      permissions: { pull: true, push: false }
    })
  });
  t.after(() => { globalThis.fetch = previousFetch; });

  const authorization = await loadRepositoryAuthorization('token-seguro');
  assert.equal(authorization.canPush, false);
  assert.equal(authorization.verified, true);
  assert.match(authorization.warning, /não confirmou permissão de escrita/i);
});

test('conexão administrativa exige a leitura do repositório, mas não falha por verificações auxiliares', async t => {
  const { connectGitHub } = await import('../assets/js/github.js');
  const previousFetch = globalThis.fetch;
  const encoded = Buffer.from(JSON.stringify({
    app: 'Lions',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: CURRENT_SCHEMA_VERSION,
    data: { settings: { clubName: 'Homologação', initialized: true } }
  }), 'utf8').toString('base64');

  globalThis.fetch = async url => {
    const target = String(url);
    if (target.includes('/contents/data/dados.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ sha: 'data-sha', content: encoded, encoding: 'base64' })
      };
    }
    if (target.endsWith('/user')) {
      return {
        ok: false,
        status: 403,
        headers: { get: () => null },
        json: async () => ({ message: 'Forbidden' })
      };
    }
    if (target.endsWith('/repos/lionsclubcandidomota/portal')) {
      return {
        ok: false,
        status: 403,
        headers: { get: () => null },
        json: async () => ({ message: 'Forbidden' })
      };
    }
    throw new Error(`Requisição inesperada: ${target}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const connection = await connectGitHub('token-seguro');
  assert.equal(connection.sha, 'data-sha');
  assert.equal(connection.state.settings.clubName, 'Homologação');
  assert.equal(connection.actor, null);
  assert.equal(connection.authorization.verified, false);
  assert.equal(connection.authorization.canPush, null);
  assert.match(connection.authorization.warning, /não foi possível confirmar antecipadamente/i);
});
