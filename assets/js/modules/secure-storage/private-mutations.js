import { createPrivatePortalState } from '../../core/portal-data-boundary.js?v=6.46.0';
import { statesAreEquivalent } from '../../core/portal-state.js?v=6.46.0';
import {
  getSecureStoragePrivateRevision,
  readSecureStorageJson as readJson,
  requireSecureStorageSession as requireSession,
  secureStorageApiUrl as apiUrl,
  secureStorageJsonHeaders as jsonHeaders,
  setSecureStoragePrivateRevision
} from './session-store.js?v=6.46.0';

const MAX_GRANULAR_TREASURY_CHANGES = 60;
const MAX_GRANULAR_GROUP_CHANGES = 40;

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function privateWithoutCollections(state, omittedKeys = []) {
  const privateState = createPrivatePortalState(state || {});
  const omitted = new Set(omittedKeys);
  return Object.fromEntries(Object.entries(privateState).filter(([key]) => !omitted.has(key)));
}

function collectionMap(values, valueKey) {
  const map = new Map();
  for (const [index, value] of (Array.isArray(values) ? values : []).entries()) {
    const id = String(value?.id || '').trim();
    if (!id || map.has(id)) return null;
    map.set(id, { [valueKey]: value, sortOrder: index });
  }
  return map;
}

function collectionDelta(previousValues, nextValues, valueKey) {
  const previous = collectionMap(previousValues, valueKey);
  const next = collectionMap(nextValues, valueKey);
  if (!previous || !next) return null;

  const deletes = [...previous.keys()].filter(id => !next.has(id));
  const upserts = [];
  for (const [id, entry] of next.entries()) {
    const before = previous.get(id);
    if (!before || !statesAreEquivalent(before[valueKey], entry[valueKey])) {
      upserts.push({ [valueKey]: clone(entry[valueKey]), sortOrder: entry.sortOrder });
    }
  }
  return { upserts, deletes, changes: upserts.length + deletes.length };
}

export function createTreasuryPrivateMutation(previousState, nextState) {
  if (!statesAreEquivalent(
    privateWithoutCollections(previousState, ['treasury']),
    privateWithoutCollections(nextState, ['treasury'])
  )) return null;

  const previousPrivate = createPrivatePortalState(previousState || {});
  const nextPrivate = createPrivatePortalState(nextState || {});
  const delta = collectionDelta(previousPrivate.treasury, nextPrivate.treasury, 'movement');
  if (!delta || !delta.changes || delta.changes > MAX_GRANULAR_TREASURY_CHANGES) return null;
  return { scope: 'treasury', ...delta };
}

export function createGroupsPrivateMutation(previousState, nextState) {
  if (!statesAreEquivalent(
    privateWithoutCollections(previousState, ['familyGroups', 'mutualGroups']),
    privateWithoutCollections(nextState, ['familyGroups', 'mutualGroups'])
  )) return null;

  const previousPrivate = createPrivatePortalState(previousState || {});
  const nextPrivate = createPrivatePortalState(nextState || {});
  const familyGroups = collectionDelta(previousPrivate.familyGroups, nextPrivate.familyGroups, 'group');
  const mutualGroups = collectionDelta(previousPrivate.mutualGroups, nextPrivate.mutualGroups, 'group');
  if (!familyGroups || !mutualGroups) return null;
  const changes = familyGroups.changes + mutualGroups.changes;
  if (!changes || changes > MAX_GRANULAR_GROUP_CHANGES) return null;
  return {
    scope: 'groups',
    familyGroups,
    mutualGroups,
    changes
  };
}


export function createReferencePrivateMutation(previousState, nextState) {
  const previousPrivate = createPrivatePortalState(previousState || {});
  const nextPrivate = createPrivatePortalState(nextState || {});
  if (!statesAreEquivalent(previousPrivate.treasury, nextPrivate.treasury)) return null;
  if (!statesAreEquivalent(previousPrivate.familyGroups, nextPrivate.familyGroups)) return null;
  if (!statesAreEquivalent(previousPrivate.mutualGroups, nextPrivate.mutualGroups)) return null;
  const changed = !statesAreEquivalent(previousPrivate.settings, nextPrivate.settings)
    || !statesAreEquivalent(previousPrivate.treasuryAccounts, nextPrivate.treasuryAccounts)
    || !statesAreEquivalent(previousPrivate.treasuryCategories, nextPrivate.treasuryCategories);
  if (!changed) return null;
  return {
    scope: 'reference',
    reference: {
      settings: clone(nextPrivate.settings || {}),
      treasuryAccounts: clone(nextPrivate.treasuryAccounts || []),
      treasuryCategories: clone(nextPrivate.treasuryCategories || [])
    }
  };
}

async function savePrivateMutation(state, mutation, {
  mutationId = '',
  endpoint,
  fallbackMode,
  errorMessage,
  body
} = {}) {
  const { profile, token } = requireSession(state, ['admin']);
  const expectedRevision = getSecureStoragePrivateRevision();
  if (!expectedRevision) throw new Error('A revisão privada ainda não foi carregada para a gravação granular.');
  const response = await fetch(apiUrl(profile.workerUrl, endpoint), {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ mutationId, expectedRevision, ...body(mutation) }),
    cache: 'no-store'
  });
  const payload = await readJson(response, errorMessage);
  setSecureStoragePrivateRevision(payload.revision || '');
  return {
    saved: true,
    mode: String(payload.mode || fallbackMode),
    revision: getSecureStoragePrivateRevision(),
    updatedAt: String(payload.updatedAt || ''),
    backend: String(payload.backend || ''),
    mutationId: String(payload.mutationId || mutationId),
    changes: payload.changes && typeof payload.changes === 'object' ? payload.changes : {}
  };
}

export function savePrivateTreasuryMutation(state, mutation, options = {}) {
  return savePrivateMutation(state, mutation, {
    ...options,
    endpoint: '/api/private-state/treasury',
    fallbackMode: 'granular-treasury',
    errorMessage: 'Não foi possível salvar as movimentações no D1',
    body: value => ({
      upserts: Array.isArray(value?.upserts) ? value.upserts : [],
      deletes: Array.isArray(value?.deletes) ? value.deletes : []
    })
  });
}

export function savePrivateGroupsMutation(state, mutation, options = {}) {
  return savePrivateMutation(state, mutation, {
    ...options,
    endpoint: '/api/private-state/groups',
    fallbackMode: 'granular-groups',
    errorMessage: 'Não foi possível salvar os grupos no D1',
    body: value => ({
      familyGroups: {
        upserts: Array.isArray(value?.familyGroups?.upserts) ? value.familyGroups.upserts : [],
        deletes: Array.isArray(value?.familyGroups?.deletes) ? value.familyGroups.deletes : []
      },
      mutualGroups: {
        upserts: Array.isArray(value?.mutualGroups?.upserts) ? value.mutualGroups.upserts : [],
        deletes: Array.isArray(value?.mutualGroups?.deletes) ? value.mutualGroups.deletes : []
      }
    })
  });
}


export function savePrivateReferenceMutation(state, mutation, options = {}) {
  return savePrivateMutation(state, mutation, {
    ...options,
    endpoint: '/api/private-state/reference',
    fallbackMode: 'granular-reference',
    errorMessage: 'Não foi possível salvar as configurações privadas no D1',
    body: value => ({
      reference: value?.reference && typeof value.reference === 'object'
        ? value.reference
        : { settings: {}, treasuryAccounts: [], treasuryCategories: [] }
    })
  });
}
