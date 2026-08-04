const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const STATUS_PATH = '/__portal_homologation/status';
const EVENTS_PATH = '/__portal_homologation/events';

export async function enableHomologationReload() {
  if (!LOCAL_HOSTS.has(location.hostname) || typeof EventSource === 'undefined') return;

  try {
    const response = await fetch(STATUS_PATH, { cache: 'no-store' });
    if (!response.ok) return;
    const status = await response.json();
    if (status?.name !== 'portal-lions-homologation' || !status.liveReload) return;

    const events = new EventSource(EVENTS_PATH);
    events.addEventListener('reload', () => location.reload());
    window.addEventListener('pagehide', () => events.close(), { once: true });
  } catch {
    // Outro servidor local pode ser usado; nesse caso o portal apenas não ativa o live reload nativo.
  }
}
