import { mergePortalStates, remotePayloadVersion, remoteRefreshInterval, shouldApplyRemotePayload } from './domain.js?v=6.39.0';

export function createRemoteSyncActions(context) {
  const { dependencies, services, environment, model } = context;
  const browserWindow = environment.window;
  const browserDocument = environment.document;

  const mergeRemotePublicWithLocalPrivate = (local, remote) => {
    const localPrivate = services.createPrivatePortalState?.(local) || {};
    const localPublic = services.createPublicPortalState?.(local) || local;
    const remotePublic = services.createPublicPortalState?.(remote) || remote;
    const mergedPublic = mergePortalStates(localPublic, remotePublic);
    return services.mergePublicAndPrivatePortalState?.(mergedPublic, localPrivate) || mergedPublic;
  };

  const applyRemotePayload = (payload, { force = false } = {}) => {
    const remote = payload.state;
    const remoteVersion = remotePayloadVersion(payload);

    void force;

    if (!shouldApplyRemotePayload({
      awaitingDeploymentId: model.awaitingPublicDeploymentId,
      remoteVersion,
      lastRemoteVersion: model.lastRemoteVersion
    })) {
      return false;
    }

    const local = services.loadState();
    const merged = mergeRemotePublicWithLocalPrivate(local, remote);

    if (model.pendingChanges === 0) {
      context.replaceCurrentState(merged);
      services.saveState(context.currentState());
      context.storeSyncedState(context.currentState());
      dependencies.applySettings();
      dependencies.renderCurrentView();
    } else {
      const currentPrivate = services.createPrivatePortalState?.(context.currentState()) || {};
      const remotePublic = services.createPublicPortalState?.(merged) || merged;
      const syncedBaseline = services.mergePublicAndPrivatePortalState?.(remotePublic, currentPrivate) || merged;
      context.storeSyncedState(syncedBaseline);
    }

    if (remoteVersion) {
      context.setRemoteVersion(remoteVersion);

      if (model.awaitingPublicDeploymentId === remoteVersion) {
        context.setAwaitingDeployment('');
        model.lastSyncInfo = {
          ...(model.lastSyncInfo || {}),
          publishedAt: new Date().toISOString(),
          updatedAt: payload.updatedAt || ''
        };
        context.storeSyncMeta();
        dependencies.openPublishCenter?.();
        context.publishStatus('published');
      }
    }
    return true;
  };

  const refreshRemoteState = async ({ force = false } = {}) => {
    if (model.remoteRefreshRunning || browserDocument.hidden) return false;
    model.remoteRefreshRunning = true;
    try {
      const pagesPayload = await services.loadPublicGitHubPayload();
      return applyRemotePayload(pagesPayload, { force });
    } catch {
      return false;
    } finally {
      model.remoteRefreshRunning = false;
    }
  };

  const scheduleRemoteRefresh = () => {
    if (model.refreshScheduled) return;
    model.refreshScheduled = true;

    const refreshNow = () => refreshRemoteState({ force: true });
    browserWindow.addEventListener('focus', refreshNow);
    browserWindow.addEventListener('online', refreshNow);
    browserWindow.addEventListener('pageshow', event => {
      if (event.persisted) refreshNow();
    });
    browserDocument.addEventListener('visibilitychange', () => {
      if (!browserDocument.hidden) refreshNow();
    });

    const scheduleNext = () => {
      browserWindow.setTimeout(async () => {
        await refreshRemoteState();
        scheduleNext();
      }, remoteRefreshInterval(model.adminUnlocked));
    };
    scheduleNext();
  };

  return { applyRemotePayload, refreshRemoteState, scheduleRemoteRefresh };
}
