import { migratePortalPayload } from '../../core/portal-schema.js?v=6.44.1';
import { cloneState } from '../../core/portal-state.js?v=6.44.1';
import { ACCESS_CAPABILITIES, roleHasCapability } from './authorization.js?v=6.44.1';

export function createPersistenceActions(context) {
  const { dependencies, services, model } = context;

  const persist = (message = 'Alteração registrada') => {
    if (!roleHasCapability(model, ACCESS_CAPABILITIES.WRITE_DATA)) {
      const safeState = model.lastSyncedState || services.loadState();
      context.replaceCurrentState(cloneState(safeState));
      dependencies.renderCurrentView?.();
      dependencies.toast?.('O perfil Diretoria possui acesso somente leitura. Nenhuma alteração foi salva.');
      return { ok: false, reason: 'read-only' };
    }
    dependencies.openPublishCenter?.({ autoCloseAfter: 4800 });
    const previousState = services.loadState();
    const state = context.sanitizeCurrentState();
    services.saveState(state);
    dependencies.applySettings();
    model.pendingChanges += 1;

    const audit = dependencies.auditLog?.recordChange?.({
      message,
      previousState,
      currentState: state,
      batchId: model.pendingAuditBatchId
    });
    if (audit?.batchId) model.pendingAuditBatchId = audit.batchId;

    context.storeSyncMeta();
    context.publishStatus('pending');
    return { ok: true };
  };

  const replaceStateAndPersist = (nextState, message, successMessage = '') => {
    context.replaceCurrentState(migratePortalPayload(nextState).state);
    persist(message);
    dependencies.renderCurrentView();
    if (successMessage) dependencies.toast?.(successMessage);
  };

  const importState = async (importedState, file = null) => {
    if (!roleHasCapability(model, ACCESS_CAPABILITIES.WRITE_DATA)) {
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
    replaceStateAndPersist(importedState, 'Backup importado.', 'Backup importado com sucesso.');
  };

  const restoreState = async (nextState, details = {}) => {
    if (!roleHasCapability(model, ACCESS_CAPABILITIES.WRITE_DATA)) {
      dependencies.toast?.('O perfil Diretoria não pode restaurar dados.');
      return { ok: false, reason: 'read-only' };
    }
    replaceStateAndPersist(
      nextState,
      details.message || 'Dados restaurados a partir de um ponto de recuperação.'
    );
  };

  return { importState, persist, restoreState };
}
