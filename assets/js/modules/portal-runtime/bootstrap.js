import { createSeedState, cloneState } from '../../core/portal-state.js?v=6.46.13';
import {
  mergePortalStates,
  remotePayloadVersion,
  selectCachedState,
  shouldAcceptStartupPayload
} from './domain.js?v=6.46.13';
import { INITIAL_REMOTE_TIMEOUT } from './constants.js?v=6.46.13';

export function createBootstrapAction(context, remoteSync) {
  const { dependencies, services, environment, model } = context;
  const browserWindow = environment.window;
  const browserDocument = environment.document;
  const requestFrame = environment.requestAnimationFrame
    || (callback => browserWindow.setTimeout(callback, 0));

  return async function bootstrap() {
    if (model.bootstrapped) return;
    model.bootstrapped = true;

    dependencies.bindControllers?.();
    dependencies.syncFinancePrivacy?.();

    const initialState = context.currentState();
    if (createSeedState(initialState)) services.saveState(initialState);

    const cachedState = selectCachedState({
      pendingChanges: model.pendingChanges,
      lastSyncedState: model.lastSyncedState,
      localState: services.loadState()
    });
    context.replaceCurrentState(cachedState);

    dependencies.applySettings();
    dependencies.updateClock?.();

    const knownVersion = model.lastRemoteVersion;
    let loadedRemote = false;

    const usePayload = payload => {
      const remoteVersion = remotePayloadVersion(payload);
      if (!shouldAcceptStartupPayload({
        knownVersion,
        remoteVersion,
        awaitingDeploymentId: model.awaitingPublicDeploymentId
      })) {
        return false;
      }

      context.replaceCurrentState(mergePortalStates(cachedState, payload.state));
      services.saveState(context.currentState());
      context.storeSyncedState(context.currentState());

      if (remoteVersion) context.setRemoteVersion(remoteVersion);
      loadedRemote = true;
      return true;
    };

    try {
      const pagesAttempt = services.loadPublicGitHubPayload();
      const timeout = new Promise((_, reject) => {
        browserWindow.setTimeout(
          () => reject(new Error('Tempo limite no carregamento inicial.')),
          INITIAL_REMOTE_TIMEOUT
        );
      });
      const payload = await Promise.race([pagesAttempt, timeout]);
      usePayload(payload);
    } catch {
      context.replaceCurrentState(cachedState);
    }

    dependencies.applySettings();
    dependencies.renderCurrentView();
    dependencies.refreshPublishCenter?.();
    browserDocument.body.classList.remove('app-loading');
    browserWindow.setInterval(dependencies.updateClock, 1000);
    remoteSync.scheduleRemoteRefresh();

    requestFrame(() => {
      browserWindow.setTimeout(
        () => remoteSync.refreshRemoteState({ force: !loadedRemote }),
        loadedRemote ? 1200 : 250
      );
    });
  };
}
