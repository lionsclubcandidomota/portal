import { cloneState } from '../../core/portal-state.js?v=6.46.7';
import { memberForPortalUser } from '../../core/portal-access.js?v=6.46.7';
import { effectivePortalUserRole } from '../../core/portal-leadership.js?v=6.46.7';
import { remotePayloadVersion } from './domain.js?v=6.46.7';
import {
  ACCESS_CAPABILITIES,
  ACCESS_ROLES,
  applyAccessRole,
  clearAccessRole,
  roleHasCapability
} from './authorization.js?v=6.46.7';

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
    if (!roleHasCapability(model, ACCESS_CAPABILITIES.REFRESH_PANEL)) {
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
      const remote = activeRole === ACCESS_ROLES.ADMIN
        ? await services.connectGitHub(activeToken)
        : await services.loadPublicGitHubPayload();

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

      if (activeRole === ACCESS_ROLES.USER) {
        const currentUserId = model.currentPortalUser?.id;
        const user = (Array.isArray(remote.state?.portalUsers) ? remote.state.portalUsers : [])
          .find(item => item.id === currentUserId && item.active !== false);
        const access = effectivePortalUserRole(remote.state, user, new Date());
        const role = access.role;
        const member = memberForPortalUser(remote.state, user);
        if (!user || !role || !member) {
          clearAccessRole(model);
          dependencies.toast?.('Seu acesso foi desativado ou não está mais disponível. Entre novamente para continuar.');
          dependencies.setView?.('dashboard');
          dependencies.updateAccessUI?.();
          return { ok: false, reason: 'access-revoked' };
        }
        applyAccessRole(model, ACCESS_ROLES.USER, {
          capabilities: role.permissions,
          user: {
            id: user.id,
            memberId: member.id,
            username: user.username,
            name: member.name,
            roleId: role.id,
            roleName: role.name,
            leadershipAssignmentId: access.assignment?.id || '',
            lionYear: access.assignment?.lionYear || '',
            roleStartsOn: access.assignment?.startsOn || '',
            roleEndsOn: access.assignment?.endsOn || ''
          },
          label: access.assignment?.lionYear ? `${role.name} · AL ${access.assignment.lionYear}` : role.name
        });
      }

      context.replaceCurrentState(cloneState(remote.state));
      services.saveState(context.currentState());
      context.storeSyncedState(context.currentState());
      context.storeSyncMeta();
      context.publishStatus('synced');

      dependencies.applySettings();
      dependencies.renderCurrentView?.();
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
