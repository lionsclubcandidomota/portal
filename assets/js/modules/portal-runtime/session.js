import { cloneState, statesAreEquivalent } from '../../core/portal-state.js?v=6.44.1';
import { RESTRICTED_VIEWS } from './constants.js?v=6.44.1';
import { mergePortalStates, remotePayloadVersion } from './domain.js?v=6.44.1';
import { createAdminSessionGuard } from './session-guard.js?v=6.44.1';
import { passwordMatchesDirectorProfile } from './access-profile.js?v=6.44.1';
import {
  ACCESS_ROLES,
  accessSnapshot,
  applyAccessRole,
  clearAccessRole
} from './authorization.js?v=6.44.1';

function isLocalHomologation(environment) {
  const location = environment?.window?.location;
  if (!location) return true;
  const hostname = String(location.hostname || '').toLocaleLowerCase('en-US');
  return location.protocol === 'file:'
    || hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]';
}

export function createAdminSessionActions(context) {
  const { dependencies, services, model, environment } = context;

  const lockAdminSession = reason => {
    const wasUnlocked = model.adminUnlocked;
    const previousRole = model.accessRole;
    clearAccessRole(model);
    model.githubToken = '';
    model.githubFileSha = '';
    model.githubAuthorization = null;
    model.auditActor = null;
    dependencies.auditLog?.setActor?.(null);
    sessionGuard.stop();
    context.publishStatus(model.pendingChanges > 0 ? 'pending' : 'offline');
    dependencies.updateAccessUI?.();

    if (wasUnlocked) {
      dependencies.toast?.(
        reason === 'timeout'
          ? 'A sessão do painel foi bloqueada após 30 minutos sem atividade.'
          : reason === 'role-expired'
            ? 'O cargo deste usuário não está mais vigente no Ano Leonístico atual.'
          : previousRole === ACCESS_ROLES.DIRECTOR
            ? 'Acesso Diretoria encerrado. A senha foi removida da memória.'
            : previousRole === ACCESS_ROLES.USER
              ? 'Sessão do usuário encerrada. A senha foi removida da memória.'
              : 'Acesso administrativo encerrado. A credencial foi removida da memória.'
      );
    }

    if (RESTRICTED_VIEWS.has(dependencies.getCurrentView?.())) {
      dependencies.setView?.('dashboard');
    } else {
      dependencies.renderCurrentView();
    }
  };

  const sessionGuard = createAdminSessionGuard({
    window: environment.window,
    document: environment.document,
    onTimeout: () => lockAdminSession('timeout'),
    onActivity: () => {
      if (model.accessRole === ACCESS_ROLES.USER && !accessSnapshot(model).authenticated) {
        lockAdminSession('role-expired');
      }
    }
  });

  const finalizeSession = ({ accessRole, actor, authorization, sha = '', token = '', capabilities = [], user = null, label = '' }) => {
    model.githubToken = accessRole === ACCESS_ROLES.ADMIN ? String(token || '').trim() : '';
    model.githubFileSha = accessRole === ACCESS_ROLES.ADMIN ? String(sha || '') : '';
    model.githubAuthorization = authorization || null;
    model.auditActor = actor || null;
    applyAccessRole(model, accessRole, { capabilities, user, label });
    dependencies.auditLog?.setActor?.(model.auditActor);
    sessionGuard.start();
    context.publishStatus(model.canWrite && model.pendingChanges > 0 ? 'pending' : 'synced');
    dependencies.closePublishCenter?.({ focus: false });
    dependencies.applySettings();
    dependencies.updateAccessUI?.();

    return {
      actor: model.auditActor,
      authorization: model.githubAuthorization,
      accessRole: model.accessRole,
      canWrite: accessSnapshot(model).canWrite
    };
  };

  const connectAdminSession = async token => {
    const remote = await services.connectGitHub(token);
    const localHomologation = isLocalHomologation(environment);

    if (!localHomologation && remote.authorization?.canPush !== true) {
      throw new Error(
        remote.authorization?.warning
          || 'Não foi possível confirmar que esta credencial possui permissão para publicar as alterações do Portal.'
      );
    }

    const localBeforeLogin = services.loadState();
    const remoteMerged = mergePortalStates(localBeforeLogin, remote.state);
    context.storeSyncedState(remoteMerged);

    if (model.pendingChanges > 0 && statesAreEquivalent(localBeforeLogin, remoteMerged)) {
      model.pendingChanges = 0;
      context.storeSyncMeta();
    }

    context.replaceCurrentState(
      model.pendingChanges === 0
        ? cloneState(model.lastSyncedState)
        : localBeforeLogin
    );
    if (model.pendingChanges === 0) services.saveState(context.currentState());

    return {
      ...finalizeSession({
        accessRole: ACCESS_ROLES.ADMIN,
        actor: remote.actor,
        authorization: remote.authorization,
        sha: remote.sha,
        token
      }),
      localHomologation
    };
  };

  const connectDirectorSession = async password => {
    if (model.pendingChanges > 0) {
      throw new Error('Existem alterações locais pendentes neste navegador. Entre como Administrador para publicar ou descartar antes de acessar como Diretoria.');
    }

    const payload = await services.loadPublicGitHubPayload();
    const allowed = await passwordMatchesDirectorProfile(password, payload.state);
    if (!allowed) {
      throw new Error('Senha da Diretoria inválida ou ainda não publicada pelo Administrador.');
    }

    context.replaceCurrentState(cloneState(payload.state));
    services.saveState(context.currentState());
    context.storeSyncedState(context.currentState());
    model.pendingChanges = 0;
    model.pendingAuditBatchId = '';
    const version = remotePayloadVersion(payload);
    if (version) context.setRemoteVersion(version);
    context.storeSyncMeta();

    return {
      ...finalizeSession({
        accessRole: ACCESS_ROLES.DIRECTOR,
        actor: { login: 'diretoria', name: 'Diretoria' },
        authorization: { verified: true, canPush: false, credentialType: 'password' }
      }),
      localHomologation: isLocalHomologation(environment)
    };
  };


  const connectUserSession = async (username, password) => {
    if (model.pendingChanges > 0) {
      throw new Error('Existem alterações locais pendentes neste navegador. Entre como Administrador para publicar ou descartar antes de trocar de usuário.');
    }

    const payload = await services.loadPublicGitHubPayload();
    const { authenticatePortalUser } = await import('./user-access.js?v=6.44.1');
    const authenticated = await authenticatePortalUser(username, password, payload.state);
    if (!authenticated) {
      throw new Error('Usuário ou senha inválidos. Confira os dados e tente novamente.');
    }

    context.replaceCurrentState(cloneState(payload.state));
    services.saveState(context.currentState());
    context.storeSyncedState(context.currentState());
    model.pendingChanges = 0;
    model.pendingAuditBatchId = '';
    const version = remotePayloadVersion(payload);
    if (version) context.setRemoteVersion(version);
    context.storeSyncMeta();

    return {
      ...finalizeSession({
        accessRole: ACCESS_ROLES.USER,
        actor: authenticated.actor,
        authorization: { verified: true, canPush: false, credentialType: 'password' },
        capabilities: authenticated.role.permissions,
        user: {
          id: authenticated.user.id,
          memberId: authenticated.member.id,
          username: authenticated.user.username,
          name: authenticated.member.name,
          roleId: authenticated.role.id,
          roleName: authenticated.role.name,
          leadershipAssignmentId: authenticated.assignment?.id || '',
          lionYear: authenticated.assignment?.lionYear || '',
          roleStartsOn: authenticated.assignment?.startsOn || '',
          roleEndsOn: authenticated.assignment?.endsOn || ''
        },
        label: authenticated.assignment?.lionYear
          ? `${authenticated.role.name} · AL ${authenticated.assignment.lionYear}`
          : authenticated.role.name
      }),
      localHomologation: isLocalHomologation(environment)
    };
  };

  const logoutAdmin = () => lockAdminSession('manual');

  return { connectAdminSession, connectDirectorSession, connectUserSession, logoutAdmin };
}
