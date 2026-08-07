import { loadState, saveState } from '../../storage.js';
import {
  loadPublicGitHubPayload,
  waitForPagesDeployment
} from '../../public-data.js?v=6.47.0';
import { createPortalRuntimeContext } from './context.js?v=6.47.0';
import {
  bootstrapAdministrator,
  clearSecureStorageSession,
  collectSecureTreasuryObjectKeys,
  connectSecureStorageSession,
  createPrivateStateBackup,
  createGroupsPrivateMutation,
  createReferencePrivateMutation,
  createTreasuryPrivateMutation,
  diagnosePrivateStorageIntegrity,
  getAuthenticationStatus,
  deleteSecureTreasuryObjects,
  hasActiveSecureStorageSession,
  getPrivateStorageStatus,
  listPrivateStateBackups,
  loadD1GroupsModule,
  loadD1ModuleRevisions,
  loadD1ReferenceModule,
  logoutSecureStorageSession,
  loadPrivatePortalBootstrap,
  loadPrivatePortalState,
  mergePrivatePortalState,
  migratePrivateStorageToD1,
  prepareSecureTreasuryAttachmentsForPublication,
  publishPublicPortalState,
  restorePrivateStateBackup,
  rollbackPrivateStorageToR2,
  savePrivatePortalState,
  savePrivateGroupsMutation,
  savePrivateReferenceMutation,
  savePrivateTreasuryMutation,
  secureStorageProfileFromState
} from '../secure-storage/client.js?v=6.47.0';
import {
  createPrivatePortalState,
  createPublicPortalState,
  hasPrivatePortalData,
  mergePublicAndPrivatePortalState
} from '../../core/portal-data-boundary.js?v=6.47.0';
import { createPersistenceActions } from './persistence.js?v=6.47.0';
import { createPrivateSyncActions } from './private-sync.js?v=6.47.0';
import { createAdminSessionActions } from './session.js?v=6.47.0';
import { createPublicationActions } from './publication.js?v=6.47.0';
import { createRemoteSyncActions } from './remote-sync.js?v=6.47.0';
import { createBootstrapAction } from './bootstrap.js?v=6.47.0';
import { createInterfaceRefreshActions } from './interface-refresh.js?v=6.47.0';
import { createLiveSyncActions } from './live-sync.js?v=6.47.0';
import { createAccessProfileActions } from './access-profile.js?v=6.47.0';
import {
  ACCESS_CAPABILITIES,
  accessSnapshot,
  canAccessView,
  roleHasCapability
} from './authorization.js?v=6.47.0';

export function createPortalRuntimeController(dependencies) {
  const services = {
    bootstrapAdministrator,
    clearSecureStorageSession,
    collectSecureTreasuryObjectKeys,
    connectSecureStorageSession,
    createPrivateStateBackup,
    createGroupsPrivateMutation,
    createReferencePrivateMutation,
    createTreasuryPrivateMutation,
    diagnosePrivateStorageIntegrity,
    getAuthenticationStatus,
    deleteSecureTreasuryObjects,
    hasActiveSecureStorageSession,
    getPrivateStorageStatus,
    hasPrivatePortalData,
    listPrivateStateBackups,
    loadD1GroupsModule,
    loadD1ModuleRevisions,
    loadD1ReferenceModule,
    logoutSecureStorageSession,
    loadPrivatePortalBootstrap,
  loadPrivatePortalState,
    loadPublicGitHubPayload,
    mergePrivatePortalState,
    migratePrivateStorageToD1,
    loadState,
    prepareSecureTreasuryAttachmentsForPublication,
    publishPublicPortalState,
    restorePrivateStateBackup,
    rollbackPrivateStorageToR2,
    savePrivatePortalState,
    savePrivateGroupsMutation,
    savePrivateReferenceMutation,
    savePrivateTreasuryMutation,
    saveState,
    createPrivatePortalState,
    createPublicPortalState,
    mergePublicAndPrivatePortalState,
    secureStorageProfileFromState,
    waitForPagesDeployment
  };

  const context = createPortalRuntimeContext(dependencies, services);
  const privateSync = createPrivateSyncActions(context);
  const liveSync = createLiveSyncActions(context, privateSync);
  const persistence = createPersistenceActions(context, privateSync);
  const session = createAdminSessionActions(context, privateSync, liveSync);
  const accessProfiles = createAccessProfileActions(context, persistence);
  const publication = createPublicationActions(context, privateSync);
  const remoteSync = createRemoteSyncActions(context);
  const bootstrap = createBootstrapAction(context, remoteSync);
  privateSync.bindRetry();
  const interfaceRefresh = createInterfaceRefreshActions(context, privateSync);
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
    get privateSaveStatus() {
      return model.privateSaveStatus;
    },
    get privateSavePending() {
      return model.privateSavePending;
    },
    getPendingPublicationReview: context.pendingPublicationReview,
    applyRemotePayload: remoteSync.applyRemotePayload,
    bootstrap,
    commitPendingChanges: publication.commitPendingChanges,
    configureDirectorProfile: accessProfiles.configureDirectorProfile,
    bootstrapAdministrator: session.bootstrapAdmin,
    getAuthenticationStatus: async () => {
      const payload = await services.loadPublicGitHubPayload();
      return services.getAuthenticationStatus(payload.state);
    },
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
    flushPrivateStateSave: privateSync.flush,
    retryPrivateStateSave: privateSync.retry,
    refreshRemoteState: remoteSync.refreshRemoteState,
    refreshPortalInterface: interfaceRefresh.refreshPortalInterface,
    isRefreshingInterface: interfaceRefresh.isRefreshingInterface,
    checkForDatabaseUpdates: liveSync.check,
    isDatabaseUpdateCheckRunning: liveSync.isRunning,
    getLastAutomaticUpdateAt: liveSync.lastAppliedAt,
    restoreState: persistence.restoreState,
    applyRemotePrivateState: persistence.applyRemotePrivateState,
    getPrivateStorageStatus: services.getPrivateStorageStatus,
    listPrivateStateBackups: services.listPrivateStateBackups,
    createPrivateStateBackup: services.createPrivateStateBackup,
    restorePrivateStateBackup: services.restorePrivateStateBackup,
    migratePrivateStorageToD1: services.migratePrivateStorageToD1,
    rollbackPrivateStorageToR2: services.rollbackPrivateStorageToR2,
    diagnosePrivateStorageIntegrity: services.diagnosePrivateStorageIntegrity,
    hydrateOperationalTreasury: records => {
      const values = Array.isArray(records) ? records.filter(item => item && item.id) : [];
      if (!values.length) return { hydrated: 0 };
      const merge = source => {
        const next = structuredClone(source || {});
        const map = new Map((Array.isArray(next.treasury) ? next.treasury : []).map(item => [String(item?.id || ''), item]));
        values.forEach(item => map.set(String(item.id), structuredClone(item)));
        next.treasury = [...map.values()];
        return next;
      };
      const current = merge(context.currentState());
      context.replaceCurrentState(current);
      const baseline = merge(model.lastSyncedState || current);
      context.storeSyncedState(baseline);
      services.saveState(current);
      return { hydrated: values.length };
    },
    hasActiveSecureStorageSession: services.hasActiveSecureStorageSession
  };
}
