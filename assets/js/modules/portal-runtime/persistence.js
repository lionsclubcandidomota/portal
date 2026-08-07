import { migratePortalPayload } from '../../core/portal-schema.js?v=6.41.0';
import { cloneState, statesAreEquivalent } from '../../core/portal-state.js?v=6.41.0';
import { ACCESS_CAPABILITIES, roleHasCapability } from './authorization.js?v=6.41.0';

export function createPersistenceActions(context, privateSync = null) {
  const { dependencies, services, model } = context;

  const persist = (message = 'Alteração registrada') => {
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.WRITE_DATA)) {
      const safeState = model.lastSyncedState || services.loadState();
      context.replaceCurrentState(cloneState(safeState));
      dependencies.renderCurrentView?.();
      dependencies.toast?.('O perfil Diretoria possui acesso somente leitura. Nenhuma alteração foi salva.');
      return { ok: false, reason: 'read-only' };
    }

    const previousState = services.loadState();
    const state = context.sanitizeCurrentState();
    const previousPublic = services.createPublicPortalState?.(previousState) || previousState;
    const currentPublic = services.createPublicPortalState?.(state) || state;
    const previousPrivate = services.createPrivatePortalState?.(previousState) || {};
    const currentPrivate = services.createPrivatePortalState?.(state) || {};
    const publicChanged = !statesAreEquivalent(previousPublic, currentPublic);
    const privateChanged = !statesAreEquivalent(previousPrivate, currentPrivate);

    services.saveState(state);
    dependencies.applySettings();

    const audit = dependencies.auditLog?.recordChange?.({
      message,
      previousState,
      currentState: state,
      batchId: model.pendingAuditBatchId
    });
    if (audit?.batchId) model.pendingAuditBatchId = audit.batchId;

    const secureProfile = services.secureStorageProfileFromState?.(state);
    const privateCanAutosave = Boolean(
      privateChanged
      && secureProfile?.enabled
      && privateSync?.schedule
    );

    if (publicChanged || (privateChanged && !privateCanAutosave)) {
      model.pendingChanges += 1;
      dependencies.openPublishCenter?.({ autoCloseAfter: 4800 });
      context.publishStatus('pending');
    } else if (model.pendingChanges > 0) {
      context.publishStatus('pending');
    } else {
      context.publishStatus(model.adminUnlocked ? 'synced' : 'offline');
    }

    let privateSave = null;
    if (privateCanAutosave) {
      privateSave = privateSync.schedule({
        message,
        auditBatchId: audit?.batchId || '',
        closeAuditOnSave: !publicChanged && model.pendingChanges === 0
      });
    } else if (privateChanged) {
      model.privateMigrationPending = true;
      dependencies.toast?.({
        type: 'warning',
        title: 'Salvamento privado pendente',
        message: 'Configure e ative o armazenamento privado para gravar os dados sem publicar no GitHub.'
      });
    }

    context.storeSyncMeta();
    return {
      ok: true,
      publicChanged,
      privateChanged,
      privateSave
    };
  };

  const replaceStateAndPersist = (nextState, message, successMessage = '') => {
    context.replaceCurrentState(migratePortalPayload(nextState).state);
    const result = persist(message);
    dependencies.renderCurrentView();
    if (successMessage) dependencies.toast?.(successMessage);
    return result;
  };

  const importState = async (importedState, file = null) => {
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.WRITE_DATA)) {
      dependencies.toast?.('O perfil Diretoria não pode importar dados.');
      return { ok: false, reason: 'read-only' };
    }
    await dependencies.recoveryCenter?.createAutomaticSnapshot?.({
      state: context.currentState(),
      reason: 'before-import',
      label: file?.name ? `Antes de importar ${file.name}` : 'Antes de importar um backup',
      metadata: {
        sourceFileName: file?.name || '',
        pendingChanges: model.pendingChanges
      }
    });
    return replaceStateAndPersist(importedState, 'Backup importado.', 'Backup importado com sucesso.');
  };

  const restoreState = async (nextState, details = {}) => {
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.WRITE_DATA)) {
      dependencies.toast?.('O perfil Diretoria não pode restaurar dados.');
      return { ok: false, reason: 'read-only' };
    }
    return replaceStateAndPersist(
      nextState,
      details.message || 'Dados restaurados a partir de um ponto de recuperação.'
    );
  };

  const applyRemotePrivateState = async (privatePayload, details = {}) => {
    if (!roleHasCapability(model.accessRole, ACCESS_CAPABILITIES.WRITE_DATA)) {
      dependencies.toast?.('O perfil Diretoria não pode restaurar backups privados.');
      return { ok: false, reason: 'read-only' };
    }
    if (!privatePayload?.found || !privatePayload.state) {
      throw new Error('O Worker não retornou um estado privado válido após a restauração.');
    }
    const merged = services.mergePrivatePortalState(context.currentState(), privatePayload);
    context.replaceCurrentState(merged);
    context.storeSyncedState(merged);
    services.saveState(merged);
    model.pendingChanges = 0;
    model.pendingAuditBatchId = '';
    context.storeSyncMeta();
    privateSync?.markLoaded?.('Backup privado restaurado e sincronizado com o banco.');
    dependencies.applySettings?.();
    dependencies.renderCurrentView?.();
    dependencies.toast?.(details.successMessage || 'Backup privado restaurado com sucesso.');
    return { ok: true };
  };

  return { importState, persist, restoreState, applyRemotePrivateState };
}
