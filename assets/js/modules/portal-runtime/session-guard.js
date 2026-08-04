export const ADMIN_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = Object.freeze(['pointerdown', 'keydown', 'touchstart', 'focus']);

export function createAdminSessionGuard({
  window: browserWindow = globalThis.window,
  document: browserDocument = globalThis.document,
  timeoutMs = ADMIN_SESSION_IDLE_TIMEOUT_MS,
  onTimeout = () => {}
} = {}) {
  let active = false;
  let timerId = null;
  let lastActivityAt = 0;

  const clearTimer = () => {
    if (timerId == null) return;
    browserWindow?.clearTimeout?.(timerId);
    timerId = null;
  };

  const schedule = () => {
    clearTimer();
    if (!active) return;
    timerId = browserWindow?.setTimeout?.(() => {
      timerId = null;
      if (!active) return;
      active = false;
      detach();
      onTimeout();
    }, timeoutMs) ?? null;
  };

  const recordActivity = () => {
    if (!active || browserDocument?.hidden) return;
    lastActivityAt = Date.now();
    schedule();
  };

  const handleVisibility = () => {
    if (!browserDocument?.hidden) recordActivity();
  };

  const attach = () => {
    ACTIVITY_EVENTS.forEach(eventName => {
      browserWindow?.addEventListener?.(eventName, recordActivity, { passive: true });
    });
    browserDocument?.addEventListener?.('visibilitychange', handleVisibility);
  };

  function detach() {
    ACTIVITY_EVENTS.forEach(eventName => {
      browserWindow?.removeEventListener?.(eventName, recordActivity);
    });
    browserDocument?.removeEventListener?.('visibilitychange', handleVisibility);
    clearTimer();
  }

  return {
    start() {
      if (active) return;
      active = true;
      lastActivityAt = Date.now();
      attach();
      schedule();
    },
    stop() {
      active = false;
      detach();
    },
    touch: recordActivity,
    status() {
      return { active, lastActivityAt, timeoutMs };
    }
  };
}
