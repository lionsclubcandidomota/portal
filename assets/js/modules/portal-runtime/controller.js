import { loadState, saveState } from '../../storage.js';
import {
  loadPublicGitHubPayload,
  waitForPagesDeployment
} from '../../github-public.js?v=6.52.3';

let githubAdminPromise = null;

function loadGitHubAdmin() {
  if (!githubAdminPromise) {
    githubAdminPromise = import('../../github-admin.js?v=6.52.3').catch(error => {
      githubAdminPromise = null;
      throw error;
    });
  }
  return githubAdminPromise;
}
import { createPortalRuntimeContext } from './context.js?v=6.52.3';
import { createPersistenceActions } from './persistence.js?v=6.52.3';
import { createAdminSessionActions } from './session.js?v=6.52.3';
import { createPublicationActions } from './publication.js?v=6.52.3';
import { createRemoteSyncActions } from './remote-sync.js?v=6.52.3';
import { createBootstrapAction } from './bootstrap.js?v=6.52.3';
import { createInterfaceRefreshActions } from './interface-refresh.js?v=6.52.3';
import { createAccessProfileActions } from './access-profile.js?v=6.52.3';
import {
  ACCESS_CAPABILITIES,
  accessSnapshot,
  canAccessView,
  roleHasCapability
} from './authorization.js?v=6.52.3';

export function createPortalRuntimeController(dependencies) {
  const services = {
    connectGitHub: async (...args) => (await loadGitHubAdmin()).connectGitHub(...args),
    loadPublicGitHubPayload,
    loadState,
    saveGitHubState: async (...args) => (await loadGitHubAdmin()).saveGitHubState(...args),
    saveState,
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
    connectUserSession: session.connectUserSession,
    discardPendingChanges: publication.discardPendingChanges,
    importState: persistence.importState,
    can: capability => roleHasCapability(model, capability),
    canAccessView: view => canAccessView(model, view),
    getAccessPolicy: () => accessSnapshot(model),
    isAdminUnlocked: () => accessSnapshot(model).authenticated,
    isWriteAllowed: () => roleHasCapability(model, ACCESS_CAPABILITIES.WRITE_DATA),
    isDirector: () => accessSnapshot(model).role === 'director',
    logoutAdmin: session.logoutAdmin,
    removeDirectorProfile: accessProfiles.removeDirectorProfile,
    persist: persistence.persist,
    refreshRemoteState: remoteSync.refreshRemoteState,
    refreshPortalInterface: interfaceRefresh.refreshPortalInterface,
    isRefreshingInterface: interfaceRefresh.isRefreshingInterface,
    restoreState: persistence.restoreState
  };
}
