export const DEFAULT_LOGO = './public/logo-ui.webp';
export const DEFAULT_PRIMARY_COLOR = '#00529B';
export const DEFAULT_ACCENT_COLOR = '#F2C100';
export const DEFAULT_CLUB_NAME = 'Lions Clube de Cândido Mota';
export const DEFAULT_FONT_FAMILY = 'modern';

export const PORTAL_FONT_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'modern',
    label: 'Moderna',
    stack: 'system-ui, -apple-system, "Segoe UI", sans-serif'
  }),
  Object.freeze({
    value: 'humanist',
    label: 'Suave',
    stack: '"Trebuchet MS", "Segoe UI", sans-serif'
  }),
  Object.freeze({
    value: 'accessible',
    label: 'Alta legibilidade',
    stack: 'Verdana, Geneva, sans-serif'
  })
]);

const FONT_OPTION_MAP = new Map(PORTAL_FONT_OPTIONS.map(option => [option.value, option]));

export function normalizePortalFont(value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('pt-BR');
  return FONT_OPTION_MAP.has(normalized) ? normalized : DEFAULT_FONT_FAMILY;
}

export function portalFontStack(value) {
  return FONT_OPTION_MAP.get(normalizePortalFont(value)).stack;
}

export function settingsFrom(state) {
  return state?.settings || {};
}

export function resolveDisplayLogo(value, defaultLogo = DEFAULT_LOGO) {
  const logo = String(value || '').trim();
  if (!logo || ['./public/logo.png', 'public/logo.png', '/public/logo.png'].includes(logo)) return defaultLogo;
  return logo;
}

export function applyPortalAppearance({ state, updateAccessUI, defaultLogo = DEFAULT_LOGO } = {}) {
  const settings = settingsFrom(state);
  const clubName = String(settings.clubName || DEFAULT_CLUB_NAME).trim() || DEFAULT_CLUB_NAME;
  const primaryColor = settings.primaryColor || DEFAULT_PRIMARY_COLOR;
  const accentColor = settings.accentColor || DEFAULT_ACCENT_COLOR;
  const fontFamily = normalizePortalFont(settings.fontFamily);

  document.documentElement.style.setProperty('--primary-brand', primaryColor);
  document.documentElement.style.setProperty('--accent-brand', accentColor);
  document.documentElement.style.setProperty('--font-ui', portalFontStack(fontFamily));
  document.documentElement.dataset.portalFont = fontFamily;

  const clubNameNode = document.getElementById('sidebarClubName');
  if (clubNameNode) clubNameNode.textContent = clubName;

  const logo = document.getElementById('sidebarLogo');
  const fallbackLogo = document.getElementById('fallbackLogo');
  if (logo) {
    logo.src = resolveDisplayLogo(settings.logo, defaultLogo);
    logo.alt = `Logo do ${clubName}`;
    logo.style.display = '';
  }
  if (fallbackLogo) fallbackLogo.style.display = 'none';

  document.title = clubName;
  updateAccessUI?.();
  return Object.freeze({ clubName, primaryColor, accentColor, fontFamily });
}
