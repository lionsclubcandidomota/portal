import { cloneState } from '../../core/portal-state.js?v=6.47.2';
import { accessSnapshot } from './authorization.js?v=6.47.2';

const DEFAULT_INTERVAL_MS = 60_000;
const BACKOFF_INTERVALS_MS = Object.freeze([60_000, 120_000, 300_000, 600_000]);
const MODULE_NAMES = Object.freeze([
  'reference',
  'groups',
  'treasury',
  'memberships',
  'mutuals',
  'member-directory',
  'public'
]);

function moduleRevision(payload, module) {
  return Math.max(0, Number(payload?.modules?.[module]?.revision || 0));
}

function changedModules(previous, next) {
  return MODULE_NAMES.filter(module => moduleRevision(previous, module) !== moduleRevision(next, module));
}

function mergePrivateFields(source, patch = {}) {
  const next = cloneState(source || {});
  Object.entries(patch).forEach(([key, value]) => {
    if (value !== undefined) next[key] = cloneState(value);
  });
  return next;
}

function fieldsFromModule(payload, fields) {
  const state = payload?.state && typeof payload.state === 'object' ? payload.state : {};
  return Object.fromEntries(fields.filter(field => Object.hasOwn(state, field)).map(field => [field, state[field]]));
}

export function createLiveSyncActions(context, privateSync = null) {
  const { dependencies, services, model, environment } = context;
  let timer = null;
  let running = false;
  let baseline = null;
  let started = false;
  let lastAppliedAt = '';
  let failureCount = 0;

  const windowRef = environment.window;
  const documentRef = environment.document;

  const canCheck = () => {
    const access = accessSnapshot(model);
    if (!access.authenticated) return false;
    if (model.pendingChanges > 0 || model.privateSavePending > 0) return false;
    if (dependencies.isModalOpen?.()) return false;
    if (documentRef?.hidden) return false;
    return Boolean(services.hasActiveSecureStorageSession?.(context.currentState(), model.accessRole));
  };

  const applyModules = async (modules, revisions) => {
    if (modules.includes('public')) {
      const payload = await services.loadPublicGitHubPayload?.();
      if (payload?.state && !payload.migrationPending) {
        const privateState = services.createPrivatePortalState?.(context.currentState()) || {};
        const merged = services.mergePublicAndPrivatePortalState?.(payload.state, privateState) || payload.state;
        context.replaceCurrentState(merged);
        services.saveState(merged);
        context.storeSyncedState(merged);
        if (payload.revision || payload.deploymentId) {
          context.setRemoteVersion(payload.revision || payload.deploymentId);
        }
      }
    }

    let patch = {};
    if (modules.includes('reference')) {
      const reference = await services.loadD1ReferenceModule?.(context.currentState());
      patch = { ...patch, ...fieldsFromModule(reference, ['settings', 'treasuryAccounts', 'treasuryCategories']) };
    }
    if (modules.includes('groups')) {
      const groups = await services.loadD1GroupsModule?.(context.currentState());
      patch = { ...patch, ...fieldsFromModule(groups, ['familyGroups', 'mutualGroups']) };
    }

    if (Object.keys(patch).length) {
      const current = mergePrivateFields(context.currentState(), patch);
      context.replaceCurrentState(current);
      services.saveState(current);
      context.storeSyncedState(mergePrivateFields(model.lastSyncedState || current, patch));
      context.storeSyncMeta();
    }

    dependencies.invalidateOperationalReads?.(modules);
    if (modules.includes('reference') || modules.includes('public')) dependencies.applySettings?.();

    const currentView = dependencies.getCurrentView?.();
    const shouldRender = ['admin', 'settings', 'treasury'].includes(String(currentView || ''))
      || modules.some(module => ['treasury', 'memberships', 'mutuals', 'public'].includes(module));
    if (shouldRender) dependencies.renderCurrentView?.();

    lastAppliedAt = String(revisions?.updatedAt || new Date().toISOString());
    dependencies.setDatabaseSyncStatus?.('saved', 'Novas informações carregadas automaticamente.');
    return { applied: true, modules, updatedAt: lastAppliedAt };
  };

  const check = async ({ initialize = false, reason = 'timer' } = {}) => {
    if (running) return { ok: false, reason: 'busy' };
    if (!canCheck()) return { ok: false, reason: 'deferred' };
    running = true;
    try {
      if (model.privateSavePending > 0) {
        const result = await privateSync?.flush?.();
        if (result && !result.ok) return { ok: false, reason: 'private-save-failed' };
      }
      const revisions = await services.loadD1ModuleRevisions?.(context.currentState());
      if (!revisions?.modules) return { ok: false, reason: 'unsupported' };
      if (!baseline || initialize) {
        baseline = revisions;
        failureCount = 0;
        return { ok: true, reason: 'initialized', revision: revisions.revision };
      }
      const modules = changedModules(baseline, revisions);
      if (!modules.length) {
        baseline = revisions;
        failureCount = 0;
        return { ok: true, reason: 'unchanged', revision: revisions.revision };
      }
      const applied = await applyModules(modules, revisions);
      baseline = revisions;
      failureCount = 0;
      return { ok: true, reason, ...applied, revision: revisions.revision };
    } catch (error) {
      failureCount += 1;
      console.warn('A sincronização automática do D1 foi adiada.', error);
      return { ok: false, reason: 'error', error };
    } finally {
      running = false;
    }
  };

  const nextDelay = () => failureCount > 0
    ? BACKOFF_INTERVALS_MS[Math.min(failureCount - 1, BACKOFF_INTERVALS_MS.length - 1)]
    : DEFAULT_INTERVAL_MS;

  const clearTimer = () => {
    if (!timer) return;
    windowRef?.clearTimeout?.(timer);
    windowRef?.clearInterval?.(timer);
    timer = null;
  };

  const schedule = (delay = nextDelay()) => {
    if (!started) return;
    clearTimer();
    timer = windowRef?.setTimeout?.(async () => {
      timer = null;
      await check({ reason: 'timer' });
      schedule();
    }, delay) || null;
  };

  const refreshNow = async reason => {
    if (!started || documentRef?.hidden) return;
    await check({ reason });
    schedule();
  };

  const onFocus = () => { void refreshNow('focus'); };
  const onVisibility = () => {
    if (documentRef?.hidden) {
      clearTimer();
      return;
    }
    void refreshNow('visibility');
  };

  const start = () => {
    if (started) return;
    started = true;
    baseline = null;
    failureCount = 0;
    windowRef?.addEventListener?.('focus', onFocus);
    documentRef?.addEventListener?.('visibilitychange', onVisibility);
    windowRef?.setTimeout?.(async () => {
      await check({ initialize: true, reason: 'session' });
      schedule();
    }, 800);
  };

  const stop = () => {
    if (!started) return;
    started = false;
    baseline = null;
    failureCount = 0;
    clearTimer();
    windowRef?.removeEventListener?.('focus', onFocus);
    documentRef?.removeEventListener?.('visibilitychange', onVisibility);
  };

  const noteLocalSave = () => {
    // A próxima verificação utiliza as revisões do banco como confirmação e
    // revalida apenas os módulos afetados, sem recarregar a página inteira.
    windowRef?.setTimeout?.(() => { void check({ reason: 'local-save' }); }, 1200);
  };

  return {
    check,
    currentDelay: nextDelay,
    failureCount: () => failureCount,
    isRunning: () => running,
    lastAppliedAt: () => lastAppliedAt,
    noteLocalSave,
    start,
    stop
  };
}
