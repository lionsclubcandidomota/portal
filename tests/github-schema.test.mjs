import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_SCHEMA_VERSION } from '../assets/js/core/portal-schema.js';
import { GITHUB_CONFIG, loadPublicGitHubPayload } from '../assets/js/github.js';
import {
  publicationStatus,
  publishPortalPublicState
} from '../cloudflare/attachment-worker/src/github-publication.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerEnv = {
  GITHUB_OWNER: 'lionsclubcandidomota',
  GITHUB_REPO: 'portal',
  GITHUB_BRANCH: 'main',
  GITHUB_DATA_PATH: 'data/dados.json',
  GITHUB_TOKEN: 'github-secret-only-in-worker'
};

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

test('configuração pública aponta para o repositório correto sem credencial no navegador', async () => {
  assert.deepEqual(GITHUB_CONFIG, {
    owner: 'lionsclubcandidomota',
    repo: 'portal',
    branch: 'main',
    path: 'data/dados.json',
    publicBaseUrl: 'https://lionsclubcandidomota.github.io/portal/'
  });
  const browserModule = await readFile(path.join(projectRoot, 'assets/js/github.js'), 'utf8');
  assert.doesNotMatch(browserModule, /saveGitHubState|connectGitHub|Authorization:\s*`Bearer|normalizeGitHubToken/);
  assert.match(browserModule, /loadPublicGitHubPayload/);
});

test('carregamento público migra payload legado e remove coleções privadas', async t => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    app: 'Lions',
    version: 2,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deploymentId: 'legacy-deploy',
    data: {
      settings: { clubName: 'Remoto antigo', membershipMonthlyFee: 99 },
      treasury: [{ id: 'private' }]
    }
  });
  t.after(() => { globalThis.fetch = previousFetch; });

  const payload = await loadPublicGitHubPayload('https://example.test/dados.json');
  assert.equal(payload.state.settings.clubName, 'Remoto antigo');
  assert.deepEqual(payload.state.events, []);
  assert.deepEqual(payload.state.treasury, []);
  assert.equal('membershipMonthlyFee' in payload.state.settings, false);
  assert.equal(payload.deploymentId, 'legacy-deploy');
});

test('Worker publica JSON, mídia e manifesto em um único commit usando o segredo', async t => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  let blobIndex = 0;
  const currentManifest = {
    application: 'portal-lions-candido-mota',
    artifactType: 'source',
    version: '6.39.0',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    generatedAt: '2026-08-07T01:00:00.000Z',
    summary: { files: 2, javascript: 0, css: 0, tests: 0, memberImages: 0, totalBytes: 12 },
    files: [
      { path: 'data/dados.json', bytes: 2, sha256: 'old-data' },
      { path: 'index.html', bytes: 10, sha256: 'static-index' }
    ]
  };

  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url: target, method, body, authorization: options.headers?.Authorization || '' });

    if (target.includes('/git/ref/heads/')) return jsonResponse({ object: { sha: 'head-sha' } });
    if (target.includes('/contents/data/dados.json')) return jsonResponse({ sha: 'old-sha' });
    if (target.includes('/contents/release-manifest.json')) {
      return jsonResponse({
        sha: 'manifest-old-sha',
        content: Buffer.from(JSON.stringify(currentManifest)).toString('base64')
      });
    }
    if (target.includes('/git/commits/head-sha')) return jsonResponse({ tree: { sha: 'base-tree-sha' } });
    if (target.endsWith('/git/blobs')) {
      blobIndex += 1;
      return jsonResponse({ sha: `blob-${blobIndex}` }, 201);
    }
    if (target.endsWith('/git/trees')) return jsonResponse({ sha: 'new-tree-sha' }, 201);
    if (target.endsWith('/git/commits')) {
      return jsonResponse({ sha: 'commit-sha', html_url: 'https://example.test/commit' }, 201);
    }
    if (target.includes('/git/refs/heads/')) return jsonResponse({});
    throw new Error(`Requisição inesperada: ${method} ${target}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const result = await publishPortalPublicState(workerEnv, {
    expectedDataSha: 'old-sha',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    commitMessage: 'Publica pelo Worker',
    state: {
      settings: { clubName: 'Publicação', initialized: true, accessProfiles: { director: { enabled: true, label: 'Diretoria' } } },
      birthdays: [],
      treasuryAccounts: [],
      treasuryCategories: [],
      familyGroups: [],
      mutualGroups: [],
      treasury: [],
      events: [],
      meetings: [],
      notices: []
    },
    mediaAssets: [{ path: 'public/members/b1-foto.jpg', content: '/9j/AA==', encoding: 'base64' }]
  }, { sub: 'administrador' });

  const blobRequests = requests.filter(item => item.url.endsWith('/git/blobs'));
  assert.equal(blobRequests.length, 3);
  assert.ok(requests.every(item => !item.url.includes('github.com') || item.authorization === `Bearer ${workerEnv.GITHUB_TOKEN}`));

  const publicPayload = JSON.parse(Buffer.from(blobRequests[1].body.content, 'base64').toString('utf8'));
  assert.equal(publicPayload.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(publicPayload.data.settings.clubName, 'Publicação');
  assert.deepEqual(publicPayload.data.treasury, []);
  assert.ok(publicPayload.deploymentId);

  const nextManifest = JSON.parse(Buffer.from(blobRequests[2].body.content, 'base64').toString('utf8'));
  assert.deepEqual(nextManifest.files.map(file => file.path), [
    'data/dados.json',
    'index.html',
    'public/members/b1-foto.jpg'
  ]);
  const treeRequest = requests.find(item => item.url.endsWith('/git/trees'));
  assert.deepEqual(treeRequest.body.tree.map(item => item.path), [
    'public/members/b1-foto.jpg',
    'data/dados.json',
    'release-manifest.json'
  ]);
  assert.equal(result.sha, 'blob-2');
  assert.equal(result.manifestSha, 'blob-3');
  assert.equal(result.commitSha, 'commit-sha');
  assert.equal(result.mediaCount, 1);
  assert.equal(result.publishedBy, 'administrador');
});

test('Worker bloqueia publicação com dados privados antes de acessar o GitHub', async t => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return jsonResponse({}); };
  t.after(() => { globalThis.fetch = previousFetch; });

  await assert.rejects(
    publishPortalPublicState(workerEnv, {
      state: { settings: {}, treasury: [{ id: 'private' }] }
    }, { sub: 'administrador' }),
    /dados privados/i
  );
  assert.equal(requests, 0);
});

test('status da publicação valida o segredo e a permissão do repositório', async t => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options = {}) => {
    assert.equal(options.headers.Authorization, `Bearer ${workerEnv.GITHUB_TOKEN}`);
    return jsonResponse({ archived: false, disabled: false, permissions: { push: true } });
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const status = await publicationStatus(workerEnv);
  assert.deepEqual(status, {
    available: true,
    repositoryReady: true,
    repository: 'lionsclubcandidomota/portal',
    branch: 'main',
    warning: ''
  });
});
