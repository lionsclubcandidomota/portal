export const ALLOWED_SECTIONS = new Set(['overview', 'memberships', 'mutuals', 'movements']);

export function normalizeTreasurySection(value) {
  if (value === 'launches') return 'movements';
  return ALLOWED_SECTIONS.has(value) ? value : 'movements';
}
