export const MEMBER_STATUS = Object.freeze({
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  MUTUAL: 'Mútua'
});

function normalizedStatus(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function memberStatusKey(member = {}) {
  const status = normalizedStatus(member.status);

  if (['mutua', 'mutuario', 'mutuaria'].includes(status)) return 'mutual';
  if (status === 'inativo' || member.active === false) return 'inactive';
  return 'active';
}

export function memberStatusLabel(member = {}) {
  const key = memberStatusKey(member);
  if (key === 'mutual') return MEMBER_STATUS.MUTUAL;
  if (key === 'inactive') return MEMBER_STATUS.INACTIVE;
  return MEMBER_STATUS.ACTIVE;
}

export function memberIsActive(member = {}) {
  return memberStatusKey(member) === 'active';
}

export function memberIsMutual(member = {}) {
  return memberStatusKey(member) === 'mutual';
}

export function memberIsInactive(member = {}) {
  return memberStatusKey(member) === 'inactive';
}

export function memberCanJoinMutual(member = {}) {
  return memberStatusKey(member) !== 'inactive';
}

export function normalizeMemberRecord(member = {}) {
  const status = memberStatusLabel(member);
  return {
    ...member,
    status,
    active: status !== MEMBER_STATUS.INACTIVE
  };
}
