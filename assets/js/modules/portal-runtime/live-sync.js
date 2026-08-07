import { cloneState } from '../../core/portal-state.js?v=6.47.0';
import { accessSnapshot } from './authorization.js?v=6.47.0';

const DEFAULT_INTERVAL_MS = 60_000;
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
      if (payload?.state) {
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
        return { ok: true, reason: 'initialized', revision: revisions.revision };
      }
      const modules = changedModules(baseline, revisions);
      if (!modules.length) {
        baseline = revisions;
        return { ok: true, reason: 'unchanged', revision: revisions.revision };
      }
      const applied = await applyModules(modules, revisions);
      baseline = revisions;
      return { ok: true, reason, ...applied, revision: revisions.revision };
    } catch (error) {
      console.warn('A sincronização automática do D1 foi adiada.', error);
      return { ok: false, reason: 'error', error };
    } finally {
      running = false;
    }
  };

  const onFocus = () => { void check({ reason: 'focus' }); };
  const onVisibility = () => {
    if (!documentRef?.hidden) void check({ reason: 'visibility' });
  };

  const start = () => {
    if (started) return;
    started = true;
    baseline = null;
    windowRef?.addEventListener?.('focus', onFocus);
    documentRef?.addEventListener?.('visibilitychange', onVisibility);
    timer = windowRef?.setInterval?.(() => { void check({ reason: 'timer' }); }, DEFAULT_INTERVAL_MS) || null;
    windowRef?.setTimeout?.(() => { void check({ initialize: true, reason: 'session' }); }, 800);
  };

  const stop = () => {
    if (!started) return;
    started = false;
    baseline = null;
    if (timer) windowRef?.clearInterval?.(timer);
    timer = null;
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
    isRunning: () => running,
    lastAppliedAt: () => lastAppliedAt,
    noteLocalSave,
    start,
    stop
  };
}
