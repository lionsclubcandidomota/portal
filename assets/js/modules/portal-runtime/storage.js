import { createPortalEnvelope, migratePortalPayload } from '../../core/portal-schema.js?v=6.28.0';
import { RUNTIME_STORAGE_KEYS } from './constants.js?v=6.28.0';
import { normalizePendingChanges } from './domain.js?v=6.28.0';

function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function readPortalState(storage, key) {
  const parsed = readJson(storage, key);
  if (!parsed) return null;
  try {
    return migratePortalPayload(parsed).state;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  if (value === null || value === undefined) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, JSON.stringify(value));
}

export function createRuntimeMetadataStore(storage) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new TypeError('createRuntimeMetadataStore requer uma implementação de Storage.');
  }

  return {
    read() {
      return {
        pendingChanges: normalizePendingChanges(storage.getItem(RUNTIME_STORAGE_KEYS.pendingChanges)),
        lastSyncInfo: readJson(storage, RUNTIME_STORAGE_KEYS.lastSync),
        lastSyncedState: readPortalState(storage, RUNTIME_STORAGE_KEYS.syncedState),
        lastRemoteVersion: storage.getItem(RUNTIME_STORAGE_KEYS.remoteVersion) || '',
        awaitingPublicDeploymentId: storage.getItem(RUNTIME_STORAGE_KEYS.awaitingDeployment) || ''
      };
    },

    writeSyncMeta({ pendingChanges, lastSyncInfo }) {
      storage.setItem(
        RUNTIME_STORAGE_KEYS.pendingChanges,
        String(normalizePendingChanges(pendingChanges))
      );
      writeJson(storage, RUNTIME_STORAGE_KEYS.lastSync, lastSyncInfo);
    },

    writeSyncedState(state) {
      writeJson(storage, RUNTIME_STORAGE_KEYS.syncedState, createPortalEnvelope(state));
    },

    writeRemoteVersion(version) {
      if (version) storage.setItem(RUNTIME_STORAGE_KEYS.remoteVersion, version);
      else storage.removeItem(RUNTIME_STORAGE_KEYS.remoteVersion);
    },

    writeAwaitingDeployment(deploymentId) {
      if (deploymentId) {
        storage.setItem(RUNTIME_STORAGE_KEYS.awaitingDeployment, deploymentId);
      } else {
        storage.removeItem(RUNTIME_STORAGE_KEYS.awaitingDeployment);
      }
    }
  };
}
