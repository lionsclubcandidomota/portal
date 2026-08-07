import { cloneState, statesAreEquivalent } from '../../core/portal-state.js?v=6.42.0';
import { RESTRICTED_VIEWS } from './constants.js?v=6.42.0';
import { mergePortalStates, remotePayloadVersion } from './domain.js?v=6.42.0';
import { createAdminSessionGuard } from './session-guard.js?v=6.42.0';
import { passwordMatchesDirectorProfile } from './access-profile.js?v=6.42.0';
import {
  ACCESS_ROLES,
  accessSnapshot,
  applyAccessRole,
  clearAccessRole
} from './authorization.js?v=6.42.0';

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

export function createAdminSessionActions(context, privateSync = null) {
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
    dependencies.setDatabaseSyncStatus?.('idle', 'Entre novamente para acessar os dados privados.');
    dependencies.updateAccessUI?.();

    if (wasUnlocked) {
      dependencies.toast?.(
        reason === 'timeout'
          ? 'A sessão do painel foi bloqueada após 30 minutos sem atividade.'
          : previousRole === ACCESS_ROLES.DIRECTOR
            ? 'Acesso Diretoria encerrado. A senha foi removida da memória.'
            : 'Acesso administrativo encerrado. A sessão segura foi removida da memória.'
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

  const finalizeSession = ({ accessRole, actor, authorization, sha = '' }) => {
    model.githubToken = accessRole === ACCESS_ROLES.ADMIN ? 'worker-session' : '';
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

  const connectAdminSession = async credentials => {
    const username = String(credentials?.username || '').trim();
    const password = String(credentials?.password || '');
    if (!username || !password) throw new Error('Informe o usuário e a senha do Administrador.');

    const payload = await services.loadPublicGitHubPayload();
    const localBeforeLogin = services.loadState();
    const remoteMerged = mergePortalStates(localBeforeLogin, payload.state);
    context.storeSyncedState(remoteMerged);

    if (model.pendingChanges > 0 && statesAreEquivalent(
      services.createPublicPortalState?.(localBeforeLogin) || localBeforeLogin,
      services.createPublicPortalState?.(remoteMerged) || remoteMerged
    )) {
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
      state: payload.state,
      role: ACCESS_ROLES.ADMIN,
      username,
      password
    });
    if (!secureSession?.enabled) throw new Error('A autenticação por banco de dados ainda não está disponível.');

    if (services.loadPrivatePortalState) {
      const privatePayload = await services.loadPrivatePortalState(context.currentState());
      if (privatePayload?.found) {
        const hydrated = services.mergePrivatePortalState?.(context.currentState(), privatePayload);
        if (hydrated) {
          context.replaceCurrentState(hydrated);
          context.storeSyncedState(hydrated);
          if (model.pendingChanges === 0) services.saveState(hydrated);
          privateSync?.markLoaded?.('Dados privados carregados e sincronizados com o banco.');
        }
      } else if (services.hasPrivatePortalData?.(payload.state)) {
        model.pendingChanges = Math.max(1, Number(model.pendingChanges || 0));
        model.privateMigrationPending = true;
        context.storeSyncMeta();
        dependencies.setDatabaseSyncStatus?.('warning', 'Migração dos dados privados pendente.');
        dependencies.toast?.({
          type: 'warning',
          title: 'Migração de segurança pendente',
          message: 'Conclua a migração pela Central de Recuperação antes de usar o salvamento automático.'
        });
      } else {
        privateSync?.markLoaded?.('Banco conectado e pronto para receber dados privados.');
      }
    }

    const user = secureSession.user || {};
    return finalizeSession({
      accessRole: ACCESS_ROLES.ADMIN,
      actor: {
        id: String(user.id || ''),
        login: String(user.username || username),
        name: String(user.displayName || user.username || username),
        role: 'admin'
      },
      authorization: {
        verified: true,
        canPush: secureSession.publication?.available === true,
        credentialType: 'password',
        publicationVia: 'worker-secret',
        warning: secureSession.publication?.available === false
          ? 'A publicação pública está indisponível porque GITHUB_TOKEN ainda não foi configurado no Worker.'
          : ''
      }
    });
  };

  const bootstrapAdmin = async credentials => {
    const payload = await services.loadPublicGitHubPayload();
    return services.bootstrapAdministrator?.(payload.state, credentials);
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
      privateSync?.markLoaded?.('Dados privados carregados em modo somente leitura.');
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

  const logoutAdmin = async () => {
    if (model.accessRole === ACCESS_ROLES.ADMIN && model.privateSavePending > 0) {
      const result = await privateSync?.flush?.();
      if (result && !result.ok) {
        dependencies.toast?.('O encerramento foi cancelado porque ainda existem dados privados não salvos.');
        return { ok: false, reason: 'private-save-failed' };
      }
    }
    await services.logoutSecureStorageSession?.(context.currentState()).catch(() => {});
    lockAdminSession('manual');
    return { ok: true };
  };

  return { bootstrapAdmin, connectAdminSession, connectDirectorSession, logoutAdmin };
}
