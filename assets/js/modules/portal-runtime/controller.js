import { loadState, saveState } from '../../storage.js';
import {
  connectGitHub,
  loadPublicGitHubPayload,
  saveGitHubState,
  waitForPagesDeployment
} from '../../github.js?v=6.35.1';
import { createPortalRuntimeContext } from './context.js?v=6.35.1';
import {
  clearSecureStorageSession,
  collectSecureTreasuryObjectKeys,
  connectSecureStorageSession,
  createPrivateStateBackup,
  diagnosePrivateStorageIntegrity,
  deleteSecureTreasuryObjects,
  hasActiveSecureStorageSession,
  listPrivateStateBackups,
  loadPrivatePortalState,
  mergePrivatePortalState,
  prepareSecureTreasuryAttachmentsForPublication,
  restorePrivateStateBackup,
  savePrivatePortalState,
  secureStorageProfileFromState
} from '../secure-storage/client.js?v=6.35.1';
import { createPublicPortalState, hasPrivatePortalData } from '../../core/portal-data-boundary.js?v=6.35.1';
import { createPersistenceActions } from './persistence.js?v=6.35.1';
import { createAdminSessionActions } from './session.js?v=6.35.1';
import { createPublicationActions } from './publication.js?v=6.35.1';
import { createRemoteSyncActions } from './remote-sync.js?v=6.35.1';
import { createBootstrapAction } from './bootstrap.js?v=6.35.1';
import { createInterfaceRefreshActions } from './interface-refresh.js?v=6.35.1';
import { createAccessProfileActions } from './access-profile.js?v=6.35.1';
import {
  ACCESS_CAPABILITIES,
  accessSnapshot,
  canAccessView,
  roleHasCapability
} from './authorization.js?v=6.35.1';

export function createPortalRuntimeController(dependencies) {
  const services = {
    clearSecureStorageSession,
    collectSecureTreasuryObjectKeys,
    connectGitHub,
    connectSecureStorageSession,
    createPrivateStateBackup,
    diagnosePrivateStorageIntegrity,
    deleteSecureTreasuryObjects,
    hasActiveSecureStorageSession,
    hasPrivatePortalData,
    listPrivateStateBackups,
    loadPrivatePortalState,
    loadPublicGitHubPayload,
    mergePrivatePortalState,
    loadState,
    prepareSecureTreasuryAttachmentsForPublication,
    restorePrivateStateBackup,
    saveGitHubState,
    savePrivatePortalState,
    saveState,
    createPublicPortalState,
    secureStorageProfileFromState,
    waitForPagesDeployment
  };
  const context = createPortalRuntimeContext(dependencies, services);
  const persistence = createPersistenceActions(context);
  const session = createAdminSessionActions(context);
  const accessProfiles = createAccessProfileActions(context, persistence);
  const publication = createPublicationActions(context);
  const remoteSync = createRemoteSyncActions(context);
  const bootstrap = createBootstrapAction(context, remoteSync);
  const interfaceRefresh = createInterfaceRefreshActions(context);
  const { model } = context;

  return {
    get adminUnlocked() {
      return model.adminUnlocked;
    },
    get accessRole() {
      return model.accessRole;
    },
    get canWrite() {
      return accessSnapshot(model).canWrite;
    },
    get accessPolicy() {
      return accessSnapshot(model);
    },
    get githubToken() {
      return model.githubToken;
    },
    get lastSyncInfo() {
      return model.lastSyncInfo;
    },
    get latestCommitInfo() {
      return model.latestCommitInfo;
    },
    get pendingChanges() {
      return model.pendingChanges;
    },
    getPendingPublicationReview: context.pendingPublicationReview,
    applyRemotePayload: remoteSync.applyRemotePayload,
    bootstrap,
    commitPendingChanges: publication.commitPendingChanges,
    configureDirectorProfile: accessProfiles.configureDirectorProfile,
    connectAdminSession: session.connectAdminSession,
    connectDirectorSession: session.connectDirectorSession,
    discardPendingChanges: publication.discardPendingChanges,
    importState: persistence.importState,
    can: capability => roleHasCapability(model.accessRole, capability),
    canAccessView: view => canAccessView(model.accessRole, view),
    getAccessPolicy: () => accessSnapshot(model),
    isAdminUnlocked: () => accessSnapshot(model).authenticated,
    isWriteAllowed: () => roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.WRITE_DATA),
    isDirector: () => accessSnapshot(model).role === 'director',
    logoutAdmin: session.logoutAdmin,
    removeDirectorProfile: accessProfiles.removeDirectorProfile,
    persist: persistence.persist,
    refreshRemoteState: remoteSync.refreshRemoteState,
    refreshPortalInterface: interfaceRefresh.refreshPortalInterface,
    isRefreshingInterface: interfaceRefresh.isRefreshingInterface,
    restoreState: persistence.restoreState,
    applyRemotePrivateState: persistence.applyRemotePrivateState,
    listPrivateStateBackups: services.listPrivateStateBackups,
    createPrivateStateBackup: services.createPrivateStateBackup,
    restorePrivateStateBackup: services.restorePrivateStateBackup,
    diagnosePrivateStorageIntegrity: services.diagnosePrivateStorageIntegrity,
    hasActiveSecureStorageSession: services.hasActiveSecureStorageSession
  };
}
