import { buildPublicationReview } from '../publication-review.js?v=6.44.1';
import {
  cloneState,
  normalizeTreasuryStatuses,
  sanitizePortalState
} from '../../core/portal-state.js?v=6.44.1';
import { createRuntimeMetadataStore } from './storage.js?v=6.44.1';
import { ACCESS_ROLES } from './authorization.js?v=6.44.1';

const REQUIRED_DEPENDENCIES = [
  'getState',
  'setState',
  'applySettings',
  'renderCurrentView'
];

function validateDependencies(dependencies) {
  REQUIRED_DEPENDENCIES.forEach(name => {
    if (typeof dependencies?.[name] !== 'function') {
      throw new TypeError(`createPortalRuntimeController requer ${name}().`);
    }
  });
}

export function createPortalRuntimeContext(dependencies, services, environment = {}) {
  validateDependencies(dependencies);

  const storage = environment.storage || globalThis.localStorage;
  const metadataStore = createRuntimeMetadataStore(storage);
  const metadata = metadataStore.read();

  const context = {
    dependencies,
    services,
    environment: {
      window: environment.window || globalThis.window,
      document: environment.document || globalThis.document,
      requestAnimationFrame: environment.requestAnimationFrame || globalThis.requestAnimationFrame
    },
    metadataStore,
    model: {
      adminUnlocked: false,
      accessRole: ACCESS_ROLES.VISITOR,
      accessCapabilities: [],
      currentPortalUser: null,
      accessLabel: '',
      canWrite: false,
      githubToken: '',
      githubAuthorization: null,
      auditActor: null,
      pendingAuditBatchId: dependencies.auditLog?.activeBatchId?.() || '',
      githubFileSha: '',
      pendingChanges: metadata.pendingChanges,
      lastSyncInfo: metadata.lastSyncInfo,
      latestCommitInfo: null,
      lastSyncedState: metadata.lastSyncedState,
      lastRemoteVersion: metadata.lastRemoteVersion,
      awaitingPublicDeploymentId: metadata.awaitingPublicDeploymentId,
      remoteRefreshRunning: false,
      refreshScheduled: false,
      bootstrapped: false
    }
  };

  context.currentState = () => dependencies.getState();

  context.replaceCurrentState = nextState => {
    const normalizedState = normalizeTreasuryStatuses(nextState);
    dependencies.setState(normalizedState);
    return normalizedState;
  };

  context.pendingPublicationReview = () => buildPublicationReview(
    context.model.lastSyncedState,
    context.currentState()
  );

  context.publishStatus = (status, message = '') => {
    dependencies.setPublishStatus?.(status, message);
  };

  context.storeSyncedState = (value = context.currentState()) => {
    context.model.lastSyncedState = cloneState(value);
    metadataStore.writeSyncedState(context.model.lastSyncedState);
  };

  context.storeSyncMeta = () => {
    metadataStore.writeSyncMeta(context.model);
  };

  context.setRemoteVersion = version => {
    context.model.lastRemoteVersion = version || '';
    metadataStore.writeRemoteVersion(context.model.lastRemoteVersion);
  };

  context.setAwaitingDeployment = deploymentId => {
    context.model.awaitingPublicDeploymentId = deploymentId || '';
    metadataStore.writeAwaitingDeployment(context.model.awaitingPublicDeploymentId);
  };

  context.sanitizeCurrentState = () => sanitizePortalState(context.currentState());

  return context;
}
