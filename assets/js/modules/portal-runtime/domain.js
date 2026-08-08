import { cloneState } from '../../core/portal-state.js?v=6.46.4';
import { REMOTE_REFRESH_INTERVALS } from './constants.js?v=6.46.4';

export function normalizePendingChanges(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function mergePortalStates(localState = {}, remoteState = {}) {
  return {
    ...localState,
    ...remoteState,
    settings: {
      ...(localState?.settings || {}),
      ...(remoteState?.settings || {})
    }
  };
}

export function buildPublicationMessage(count, customMessage = '') {
  const trimmed = String(customMessage || '').trim();
  if (trimmed) return trimmed;

  const total = normalizePendingChanges(count);
  return `Atualiza painel Lions (${total} ${total === 1 ? 'alteração' : 'alterações'})`;
}

export function selectCachedState({ pendingChanges, lastSyncedState, localState }) {
  if (normalizePendingChanges(pendingChanges) === 0 && lastSyncedState) {
    return cloneState(lastSyncedState);
  }
  return localState;
}

export function remoteRefreshInterval(adminUnlocked) {
  return adminUnlocked
    ? REMOTE_REFRESH_INTERVALS.admin
    : REMOTE_REFRESH_INTERVALS.public;
}

export function remotePayloadVersion(payload = {}) {
  return payload.deploymentId || payload.updatedAt || '';
}

export function shouldAcceptStartupPayload({
  knownVersion = '',
  remoteVersion = '',
  awaitingDeploymentId = ''
} = {}) {
  return !(
    knownVersion
    && remoteVersion
    && remoteVersion !== knownVersion
    && awaitingDeploymentId
  );
}

export function shouldApplyRemotePayload({
  awaitingDeploymentId = '',
  remoteVersion = '',
  lastRemoteVersion = ''
} = {}) {
  if (
    awaitingDeploymentId
    && remoteVersion
    && remoteVersion !== awaitingDeploymentId
  ) {
    return false;
  }

  return !remoteVersion || remoteVersion !== lastRemoteVersion;
}
