import { createPortalEnvelope, migratePortalPayload } from '../../core/portal-schema.js?v=6.34.0';
import { RUNTIME_STORAGE_KEYS } from './constants.js?v=6.34.0';
import { normalizePendingChanges } from './domain.js?v=6.34.0';
import { createPublicPortalState } from '../../core/portal-data-boundary.js?v=6.34.0';

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

export function createRuntimeMetadataStore(storage, privateStorage = globalThis.sessionStorage) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new TypeError('createRuntimeMetadataStore requer uma implementação de Storage.');
  }

  const hasSeparatePrivateStorage = privateStorage
    && privateStorage !== storage
    && typeof privateStorage.getItem === 'function';

  return {
    read() {
      return {
        pendingChanges: normalizePendingChanges(storage.getItem(RUNTIME_STORAGE_KEYS.pendingChanges)),
        lastSyncInfo: readJson(storage, RUNTIME_STORAGE_KEYS.lastSync),
        lastSyncedState: readPortalState(hasSeparatePrivateStorage ? privateStorage : storage, RUNTIME_STORAGE_KEYS.syncedState)
          || readPortalState(storage, RUNTIME_STORAGE_KEYS.syncedState),
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
      if (hasSeparatePrivateStorage) {
        writeJson(privateStorage, RUNTIME_STORAGE_KEYS.syncedState, createPortalEnvelope(state));
        writeJson(storage, RUNTIME_STORAGE_KEYS.syncedState, createPortalEnvelope(createPublicPortalState(state)));
      } else {
        writeJson(storage, RUNTIME_STORAGE_KEYS.syncedState, createPortalEnvelope(state));
      }
    },

    clearPrivateState() {
      if (hasSeparatePrivateStorage) privateStorage.removeItem(RUNTIME_STORAGE_KEYS.syncedState);
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
