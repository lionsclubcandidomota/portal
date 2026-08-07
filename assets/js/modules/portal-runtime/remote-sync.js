import { mergePortalStates, remotePayloadVersion, remoteRefreshInterval, shouldApplyRemotePayload } from './domain.js?v=6.37.0';

export function createRemoteSyncActions(context) {
  const { dependencies, services, environment, model } = context;
  const browserWindow = environment.window;
  const browserDocument = environment.document;

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
    const merged = mergePortalStates(local, remote);

    if (model.pendingChanges === 0) {
      context.replaceCurrentState(merged);
      services.saveState(context.currentState());
      context.storeSyncedState(context.currentState());
      dependencies.applySettings();
      dependencies.renderCurrentView();
    } else {
      context.storeSyncedState(merged);
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
