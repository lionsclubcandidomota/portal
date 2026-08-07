export const RUNTIME_STORAGE_KEYS = Object.freeze({
  pendingChanges: 'lionsCandidoMota.github.pendingChanges',
  lastSync: 'lionsCandidoMota.github.lastSync',
  syncedState: 'lionsCandidoMota.github.syncedState',
  remoteVersion: 'lions_remote_version',
  awaitingDeployment: 'lions_awaiting_public_deployment',
  pendingDeletedPublicPaths: 'lionsCandidoMota.github.pendingDeletedPublicPaths'
});

export const RESTRICTED_VIEWS = new Set(['admin', 'settings', 'treasury']);

export const REMOTE_REFRESH_INTERVALS = Object.freeze({
  public: 60000,
  admin: 60000
});

export const INITIAL_REMOTE_TIMEOUT = 2200;
