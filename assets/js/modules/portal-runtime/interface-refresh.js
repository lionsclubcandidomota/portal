import { cloneState } from '../../core/portal-state.js?v=6.42.0';
import { remotePayloadVersion } from './domain.js?v=6.42.0';
import {
  ACCESS_CAPABILITIES,
  ACCESS_ROLES,
  roleHasCapability
} from './authorization.js?v=6.42.0';

export function createInterfaceRefreshActions(context, privateSync = null) {
  const { dependencies, services, model } = context;
  let running = false;

  const blockedResult = () => ({
    ok: false,
    reason: 'pending',
    pendingChanges: Number(model.pendingChanges || 0)
  });

  const refreshPortalInterface = async () => {
    if (running) return { ok: false, reason: 'busy' };
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.REFRESH_PANEL)) {
      return { ok: false, reason: 'unauthenticated' };
    }
    if (model.pendingChanges > 0) return blockedResult();
    if (model.privateSavePending > 0) {
      const saved = await privateSync?.flush?.();
      if (saved && !saved.ok) return { ok: false, reason: 'private-save-failed', error: saved.error };
    }

    running = true;
    const activeRole = model.accessRole;

    try {
      const remote = await services.loadPublicGitHubPayload();

      const secureProfile = services.secureStorageProfileFromState?.(remote.state);
      if (secureProfile?.enabled && services.loadPrivatePortalState) {
        if (!services.hasActiveSecureStorageSession?.(remote.state, activeRole)) {
          throw new Error('A sessão segura expirou. Entre novamente no painel.');
        }
        const privatePayload = await services.loadPrivatePortalState(remote.state);
        if (privatePayload?.found) {
          remote.state = services.mergePrivatePortalState?.(remote.state, privatePayload) || remote.state;
        }
      }

      // Uma edição pode ter sido concluída enquanto a consulta remota estava em andamento.
      // Nesse caso, a interface não deve substituir o estado local recém-alterado.
      if (model.pendingChanges > 0) return blockedResult();
      if (
        !model.adminUnlocked
        || model.accessRole !== activeRole
      ) {
        return { ok: false, reason: 'session-changed' };
      }

      const version = remotePayloadVersion(remote);
      if (version) context.setRemoteVersion(version);

      context.replaceCurrentState(cloneState(remote.state));
      services.saveState(context.currentState());
      context.storeSyncedState(context.currentState());
      context.storeSyncMeta();
      context.publishStatus('synced');

      dependencies.applySettings();
      dependencies.resetInterfaceState?.();
      dependencies.updateAccessUI?.();
      dependencies.refreshPublishCenter?.();

      return { ok: true, reason: 'refreshed' };
    } finally {
      running = false;
    }
  };

  return {
    isRefreshingInterface: () => running,
    refreshPortalInterface
  };
}
