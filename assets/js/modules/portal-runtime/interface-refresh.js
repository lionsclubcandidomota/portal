import { cloneState } from '../../core/portal-state.js?v=6.34.2';
import { remotePayloadVersion } from './domain.js?v=6.34.2';
import {
  ACCESS_CAPABILITIES,
  ACCESS_ROLES,
  roleHasCapability
} from './authorization.js?v=6.34.2';

export function createInterfaceRefreshActions(context) {
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
    if (model.accessRole === ACCESS_ROLES.ADMIN && !model.githubToken) {
      return { ok: false, reason: 'unauthenticated' };
    }
    if (model.pendingChanges > 0) return blockedResult();

    running = true;
    const activeRole = model.accessRole;
    const activeToken = model.githubToken;

    try {
      const remote = activeRole === ACCESS_ROLES.DIRECTOR
        ? await services.loadPublicGitHubPayload()
        : await services.connectGitHub(activeToken);

      const secureProfile = services.secureStorageProfileFromState?.(remote.state);
      if (secureProfile?.enabled && services.loadPrivatePortalState) {
        if (!services.hasActiveSecureStorageSession?.(remote.state, activeRole)) {
          if (activeRole === ACCESS_ROLES.ADMIN) {
            await services.connectSecureStorageSession?.({
              state: remote.state,
              role: activeRole,
              credential: activeToken
            });
          } else {
            throw new Error('A sessão privada da Diretoria expirou. Entre novamente.');
          }
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
        || (activeRole === ACCESS_ROLES.ADMIN && model.githubToken !== activeToken)
      ) {
        return { ok: false, reason: 'session-changed' };
      }

      if (activeRole === ACCESS_ROLES.ADMIN) {
        model.githubFileSha = remote.sha || model.githubFileSha;
        model.githubAuthorization = remote.authorization || model.githubAuthorization;
        model.auditActor = remote.actor || model.auditActor;
        dependencies.auditLog?.setActor?.(model.auditActor);
      } else {
        const version = remotePayloadVersion(remote);
        if (version) context.setRemoteVersion(version);
      }

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
