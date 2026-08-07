import { createPrivatePortalState } from '../../core/portal-data-boundary.js?v=6.40.0';
import { statesAreEquivalent } from '../../core/portal-state.js?v=6.40.0';
import {
  getSecureStoragePrivateRevision,
  readSecureStorageJson as readJson,
  requireSecureStorageSession as requireSession,
  secureStorageApiUrl as apiUrl,
  secureStorageJsonHeaders as jsonHeaders,
  setSecureStoragePrivateRevision
} from './session-store.js?v=6.40.0';

const MAX_GRANULAR_TREASURY_CHANGES = 60;

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function privateWithoutTreasury(state) {
  const privateState = createPrivatePortalState(state || {});
  const { treasury: ignored, ...rest } = privateState;
  return rest;
}

function movementMap(movements) {
  const map = new Map();
  for (const [index, movement] of (Array.isArray(movements) ? movements : []).entries()) {
    const id = String(movement?.id || '').trim();
    if (!id || map.has(id)) return null;
    map.set(id, { movement, sortOrder: index });
  }
  return map;
}

export function createTreasuryPrivateMutation(previousState, nextState) {
  if (!statesAreEquivalent(privateWithoutTreasury(previousState), privateWithoutTreasury(nextState))) {
    return null;
  }

  const previousPrivate = createPrivatePortalState(previousState || {});
  const nextPrivate = createPrivatePortalState(nextState || {});
  const previous = movementMap(previousPrivate.treasury);
  const next = movementMap(nextPrivate.treasury);
  if (!previous || !next) return null;

  const deletes = [...previous.keys()].filter(id => !next.has(id));
  const upserts = [];
  for (const [id, entry] of next.entries()) {
    const before = previous.get(id);
    if (!before || !statesAreEquivalent(before.movement, entry.movement)) {
      upserts.push({ movement: clone(entry.movement), sortOrder: entry.sortOrder });
    }
  }

  if (!upserts.length && !deletes.length) return null;
  if (upserts.length + deletes.length > MAX_GRANULAR_TREASURY_CHANGES) return null;
  return {
    scope: 'treasury',
    upserts,
    deletes,
    changes: upserts.length + deletes.length
  };
}

export async function savePrivateTreasuryMutation(state, mutation, { mutationId = '' } = {}) {
  const { profile, token } = requireSession(state, ['admin']);
  const expectedRevision = getSecureStoragePrivateRevision();
  if (!expectedRevision) throw new Error('A revisão privada ainda não foi carregada para a gravação granular.');
  const response = await fetch(apiUrl(profile.workerUrl, '/api/private-state/treasury'), {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({
      mutationId,
      expectedRevision,
      upserts: Array.isArray(mutation?.upserts) ? mutation.upserts : [],
      deletes: Array.isArray(mutation?.deletes) ? mutation.deletes : []
    }),
    cache: 'no-store'
  });
  const payload = await readJson(response, 'Não foi possível salvar as movimentações no D1');
  setSecureStoragePrivateRevision(payload.revision || '');
  return {
    saved: true,
    mode: String(payload.mode || 'granular-treasury'),
    revision: getSecureStoragePrivateRevision(),
    updatedAt: String(payload.updatedAt || ''),
    backend: String(payload.backend || ''),
    mutationId: String(payload.mutationId || mutationId),
    changes: payload.changes && typeof payload.changes === 'object' ? payload.changes : {}
  };
}
