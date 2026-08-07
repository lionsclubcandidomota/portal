import { cloneState, statesAreEquivalent } from '../../core/portal-state.js?v=6.36.2';
import { RESTRICTED_VIEWS } from './constants.js?v=6.36.2';
import { mergePortalStates, remotePayloadVersion } from './domain.js?v=6.36.2';
import { createAdminSessionGuard } from './session-guard.js?v=6.36.2';
import { passwordMatchesDirectorProfile } from './access-profile.js?v=6.36.2';
import {
  ACCESS_ROLES,
  accessSnapshot,
  applyAccessRole,
  clearAccessRole
} from './authorization.js?v=6.36.2';

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
    services.clearSecureStorageSession?.();
    context.metadataStore?.clearPrivateState?.();
    const publicState = services.createPublicPortalState?.(context.currentState());
    if (publicState) {
      context.replaceCurrentState(publicState);
      services.saveState(publicState);
    }
    sessionGuard.stop();
    context.publishStatus(model.pendingChanges > 0 ? 'pending' : 'offline');
    dependencies.updateAccessUI?.();

    if (wasUnlocked) {
      dependencies.toast?.(
        reason === 'timeout'
          ? 'A sessão do painel foi bloqueada após 30 minutos sem atividade.'
          : previousRole === ACCESS_ROLES.DIRECTOR
            ? 'Acesso Diretoria encerrado. A senha foi removida da memória.'
            : 'Acesso administrativo encerrado. O token foi removido da memória.'
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
    onTimeout: () => lockAdminSession('timeout')
  });

  const finalizeSession = ({ accessRole, actor, authorization, sha = '', token = '' }) => {
    model.githubToken = accessRole === ACCESS_ROLES.ADMIN ? String(token || '').trim() : '';
    model.githubFileSha = accessRole === ACCESS_ROLES.ADMIN ? String(sha || '') : '';
    model.githubAuthorization = authorization || null;
    model.auditActor = actor || null;
    applyAccessRole(model, accessRole);
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
          || 'Não foi possível confirmar que este token possui permissão para publicar no repositório do portal.'
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

    const secureSession = await services.connectSecureStorageSession?.({
      state: context.currentState(),
      role: ACCESS_ROLES.ADMIN,
      credential: token
    });

    if (secureSession?.enabled && services.loadPrivatePortalState) {
      const privatePayload = await services.loadPrivatePortalState(context.currentState());
      if (privatePayload?.found) {
        const hydrated = services.mergePrivatePortalState?.(context.currentState(), privatePayload);
        if (hydrated) {
          context.replaceCurrentState(hydrated);
          context.storeSyncedState(hydrated);
          if (model.pendingChanges === 0) services.saveState(hydrated);
        }
      } else if (services.hasPrivatePortalData?.(remote.state)) {
        model.pendingChanges = Math.max(1, Number(model.pendingChanges || 0));
        model.privateMigrationPending = true;
        context.storeSyncMeta();
        dependencies.toast?.({
          type: 'warning',
          title: 'Migração de segurança pendente',
          message: 'Publique a alteração pendente para mover a Tesouraria ao armazenamento privado e remover esses dados do JSON público.'
        });
      }
    }

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
    const secureProfile = services.secureStorageProfileFromState?.(payload.state);
    let authenticatedState = cloneState(payload.state);

    if (secureProfile?.enabled && services.connectSecureStorageSession) {
      await services.connectSecureStorageSession({
        state: payload.state,
        role: ACCESS_ROLES.DIRECTOR,
        credential: password
      });
      const privatePayload = await services.loadPrivatePortalState?.(payload.state);
      if (!privatePayload?.found) {
        throw new Error('Os dados privados da Diretoria ainda não foram migrados pelo Administrador.');
      }
      authenticatedState = services.mergePrivatePortalState?.(payload.state, privatePayload) || authenticatedState;
    } else {
      const allowed = await passwordMatchesDirectorProfile(password, payload.state);
      if (!allowed) {
        throw new Error('Senha da Diretoria inválida ou ainda não publicada pelo Administrador.');
      }
      await services.connectSecureStorageSession?.({
        state: authenticatedState,
        role: ACCESS_ROLES.DIRECTOR,
        credential: password
      });
    }

    context.replaceCurrentState(authenticatedState);
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

  const logoutAdmin = () => lockAdminSession('manual');

  return { connectAdminSession, connectDirectorSession, logoutAdmin };
}
