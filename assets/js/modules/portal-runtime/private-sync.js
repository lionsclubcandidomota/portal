import { cloneState, statesAreEquivalent } from '../../core/portal-state.js?v=6.47.2';
import { ACCESS_ROLES } from './authorization.js?v=6.47.2';

function attachmentIdentity(attachment = {}, index = 0) {
  return String(attachment.id || attachment.name || `index:${index}`);
}

function mergeSecureAttachmentReferences(currentState, preparedState) {
  const next = cloneState(currentState || {});
  const preparedMovements = new Map(
    (Array.isArray(preparedState?.treasury) ? preparedState.treasury : [])
      .map(movement => [String(movement?.id || ''), movement])
  );

  next.treasury = (Array.isArray(next.treasury) ? next.treasury : []).map(movement => {
    const preparedMovement = preparedMovements.get(String(movement?.id || ''));
    if (!preparedMovement) return movement;
    const preparedAttachments = new Map(
      (Array.isArray(preparedMovement.attachments) ? preparedMovement.attachments : [])
        .map((attachment, index) => [attachmentIdentity(attachment, index), attachment])
    );
    return {
      ...movement,
      attachments: (Array.isArray(movement.attachments) ? movement.attachments : []).map((attachment, index) => {
        const prepared = preparedAttachments.get(attachmentIdentity(attachment, index));
        return prepared?.storage === 'r2' && prepared?.objectKey ? prepared : attachment;
      })
    };
  });

  return next;
}

export function createPrivateSyncActions(context) {
  const { dependencies, services, model, environment } = context;
  let requestedGeneration = 0;
  let savedGeneration = 0;
  let running = null;
  const auditQueue = [];
  const mutationIds = new Map();

  const setStatus = (status, message = '') => {
    model.privateSaveStatus = status;
    model.privateSaveMessage = message;
    dependencies.setDatabaseSyncStatus?.(status, message);
  };

  const privateStateEquivalent = (first, second) => statesAreEquivalent(
    services.createPrivatePortalState?.(first) || {},
    services.createPrivatePortalState?.(second) || {}
  );

  const updatePrivateBaseline = savedState => {
    const publicBaseline = services.createPublicPortalState?.(
      model.lastSyncedState || context.currentState()
    ) || model.lastSyncedState || context.currentState();
    const privateState = services.createPrivatePortalState?.(savedState) || {};
    const merged = services.mergePublicAndPrivatePortalState?.(publicBaseline, privateState)
      || savedState;
    context.storeSyncedState(merged);
  };

  const ensureSecureSession = async state => {
    const profile = services.secureStorageProfileFromState?.(state);
    if (!profile?.enabled) {
      throw new Error('O armazenamento privado ainda não está configurado para salvar automaticamente.');
    }
    if (!services.hasActiveSecureStorageSession?.(state, ACCESS_ROLES.ADMIN)) {
      throw new Error('A sessão administrativa expirou. Entre novamente para salvar no banco.');
    }
    return profile;
  };

  const closeSavedAuditBatches = generation => {
    const closable = auditQueue.filter(item => item.generation <= generation && item.closeOnSave);
    const batchIds = [...new Set(closable.map(item => item.batchId).filter(Boolean))];
    batchIds.forEach(batchId => {
      dependencies.auditLog?.closeBatch?.(
        batchId,
        'saved',
        'Alterações privadas gravadas automaticamente no banco de dados.'
      );
      if (model.pendingAuditBatchId === batchId && model.pendingChanges === 0) {
        model.pendingAuditBatchId = '';
      }
    });
    for (let index = auditQueue.length - 1; index >= 0; index -= 1) {
      if (auditQueue[index].generation <= generation) auditQueue.splice(index, 1);
    }
  };

  const mutationIdFor = (generation, scope = 'private') => {
    if (!mutationIds.has(generation)) {
      const random = globalThis.crypto?.randomUUID?.()
        || `mut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      mutationIds.set(generation, `${scope}-${String(random).replace(/[^a-z0-9_-]/gi, '-')}`);
    }
    return mutationIds.get(generation);
  };

  const saveLatestSnapshot = async targetGeneration => {
    const snapshot = cloneState(context.currentState());
    await ensureSecureSession(snapshot);
    const baseline = model.lastSyncedState || snapshot;
    const previousKeys = services.collectSecureTreasuryObjectKeys?.(baseline) || new Set();
    const securePublication = await services.prepareSecureTreasuryAttachmentsForPublication(snapshot, {
      baseUrl: environment?.document?.baseURI || environment?.window?.location?.href || ''
    });
    const nextKeys = services.collectSecureTreasuryObjectKeys?.(securePublication.state) || new Set();
    const removedKeys = [...previousKeys].filter(key => !nextKeys.has(key));

    try {
      const treasuryMutation = services.createTreasuryPrivateMutation?.(baseline, securePublication.state);
      const groupsMutation = treasuryMutation
        ? null
        : services.createGroupsPrivateMutation?.(baseline, securePublication.state);
      const referenceMutation = treasuryMutation || groupsMutation
        ? null
        : services.createReferencePrivateMutation?.(baseline, securePublication.state);
      const granularMutation = treasuryMutation || groupsMutation || referenceMutation;
      const granularSave = granularMutation?.scope === 'treasury'
        ? services.savePrivateTreasuryMutation
        : granularMutation?.scope === 'groups'
          ? services.savePrivateGroupsMutation
          : granularMutation?.scope === 'reference'
            ? services.savePrivateReferenceMutation
            : null;
      if (!granularMutation && model.privateStateMode === 'bootstrap') {
        throw new Error('Esta alteração não pode usar a sincronização completa enquanto o Portal opera com carregamento reduzido. Recarregue a página e tente novamente.');
      }
      const result = granularMutation && granularSave
        ? await granularSave(
          securePublication.state,
          granularMutation,
          { mutationId: mutationIdFor(targetGeneration, granularMutation.scope) }
        )
        : await services.savePrivatePortalState?.(securePublication.state);
      const current = context.currentState();
      const mergedCurrent = mergeSecureAttachmentReferences(current, securePublication.state);
      if (!statesAreEquivalent(current, mergedCurrent)) context.replaceCurrentState(mergedCurrent);
      services.saveState(context.currentState());
      updatePrivateBaseline(securePublication.state);
      securePublication.deletedPublicPaths?.forEach(path => model.pendingDeletedPublicPaths.add(path));
      context.storeSyncMeta();
      savedGeneration = Math.max(savedGeneration, targetGeneration);
      mutationIds.delete(targetGeneration);
      closeSavedAuditBatches(targetGeneration);

      if (removedKeys.length) {
        services.deleteSecureTreasuryObjects?.(securePublication.state, removedKeys).catch(error => {
          console.warn('Não foi possível remover anexos privados antigos:', error);
        });
      }

      return {
        ok: true,
        result,
        convertedCount: Number(securePublication.convertedCount || 0),
        generation: targetGeneration,
        mode: String(result?.mode || 'full-snapshot')
      };
    } catch (error) {
      if (securePublication.uploadedObjectKeys?.length) {
        await services.deleteSecureTreasuryObjects?.(
          snapshot,
          securePublication.uploadedObjectKeys
        ).catch(() => {});
      }
      throw error;
    }
  };

  const drain = async () => {
    setStatus('saving', 'Salvando dados privados no banco…');
    let lastResult = { ok: true, reason: 'already-saved' };
    try {
      while (savedGeneration < requestedGeneration) {
        const targetGeneration = requestedGeneration;
        lastResult = await saveLatestSnapshot(targetGeneration);
      }
      setStatus('saved', 'Dados privados salvos no banco.');
      dependencies.toast?.({
        type: 'success',
        title: 'Salvo no banco',
        message: 'A alteração privada foi gravada automaticamente e não precisa ser publicada.'
      });
      return lastResult;
    } catch (error) {
      console.error('Falha no salvamento automático dos dados privados:', error);
      setStatus('error', error?.message || 'Falha ao salvar os dados privados.');
      dependencies.toast?.({
        type: 'error',
        title: 'Falha ao salvar no banco',
        message: error?.message || 'A alteração permanece neste navegador. Tente novamente antes de encerrar a sessão.'
      });
      return { ok: false, reason: 'error', error };
    } finally {
      running = null;
    }
  };

  const startDrain = () => {
    if (!running) running = drain();
    return running;
  };

  const schedule = ({ message = '', auditBatchId = '', closeAuditOnSave = false } = {}) => {
    requestedGeneration += 1;
    auditQueue.push({
      generation: requestedGeneration,
      batchId: auditBatchId,
      closeOnSave: Boolean(closeAuditOnSave),
      message
    });
    model.privateSavePending = requestedGeneration - savedGeneration;
    startDrain().finally(() => {
      model.privateSavePending = Math.max(0, requestedGeneration - savedGeneration);
      context.storeSyncMeta();
    });
    return { scheduled: true, generation: requestedGeneration };
  };

  const flush = async () => {
    if (savedGeneration >= requestedGeneration && model.privateSaveStatus !== 'error') {
      return { ok: true, reason: 'already-saved' };
    }
    const result = await startDrain();
    model.privateSavePending = Math.max(0, requestedGeneration - savedGeneration);
    return result;
  };

  const retry = async () => {
    if (savedGeneration >= requestedGeneration) {
      setStatus('saved', 'Dados privados salvos no banco.');
      return { ok: true, reason: 'already-saved' };
    }
    return flush();
  };

  const markLoaded = (message = 'Dados privados sincronizados com o banco.') => {
    requestedGeneration = 0;
    savedGeneration = 0;
    mutationIds.clear();
    model.privateSavePending = 0;
    setStatus('saved', message);
  };

  const bindRetry = () => {
    environment.window?.addEventListener?.('online', () => {
      if (savedGeneration < requestedGeneration && !running) void retry();
    });
  };

  return {
    bindRetry,
    flush,
    markLoaded,
    privateStateEquivalent,
    retry,
    schedule
  };
}
