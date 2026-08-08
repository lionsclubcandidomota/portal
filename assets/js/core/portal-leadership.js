import { roleById } from './portal-access.js?v=6.46.4';

const LION_YEAR_PATTERN = /^(\d{4})\/(\d{4})$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function dateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const normalized = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function addDays(value, days) {
  const normalized = dateOnly(value);
  if (!normalized) return '';
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + Number(days || 0));
  return dateOnly(date);
}

export function normalizeLionYear(value) {
  const match = String(value || '').trim().match(LION_YEAR_PATTERN);
  if (!match) return '';
  const first = Number(match[1]);
  const second = Number(match[2]);
  return second === first + 1 ? `${first}/${second}` : '';
}

export function lionYearForDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const startsThisYear = safeDate.getMonth() >= 6;
  const first = startsThisYear ? year : year - 1;
  return `${first}/${first + 1}`;
}

export function lionYearBounds(value) {
  const lionYear = normalizeLionYear(value);
  if (!lionYear) return { lionYear: '', startsOn: '', endsOn: '' };
  const first = Number(lionYear.slice(0, 4));
  return {
    lionYear,
    startsOn: `${first}-07-01`,
    endsOn: `${first + 1}-06-30`
  };
}

export function normalizeLeadershipAssignmentRecord(value, index = 0) {
  const source = isPlainObject(value) ? value : {};
  const inferredYear = normalizeLionYear(source.lionYear)
    || lionYearForDate(source.startsOn || source.startDate || source.createdAt || new Date());
  const bounds = lionYearBounds(inferredYear);
  const startsOn = dateOnly(source.startsOn || source.startDate) || bounds.startsOn;
  const endsOn = dateOnly(source.endsOn || source.endDate) || bounds.endsOn;
  return {
    id: String(source.id || `leadership-${index + 1}`).trim(),
    memberId: String(source.memberId || '').trim(),
    roleId: String(source.roleId || '').trim(),
    lionYear: bounds.lionYear,
    startsOn,
    endsOn,
    active: source.active !== false,
    notes: String(source.notes || '').trim().slice(0, 240),
    createdAt: String(source.createdAt || ''),
    updatedAt: String(source.updatedAt || '')
  };
}

export function assignmentDateRangeIsValid(assignment) {
  const bounds = lionYearBounds(assignment?.lionYear);
  const startsOn = dateOnly(assignment?.startsOn);
  const endsOn = dateOnly(assignment?.endsOn);
  return Boolean(
    bounds.lionYear
    && startsOn
    && endsOn
    && startsOn <= endsOn
    && startsOn >= bounds.startsOn
    && endsOn <= bounds.endsOn
  );
}

export function leadershipAssignmentsForMember(state, memberId) {
  const target = String(memberId || '').trim();
  return (Array.isArray(state?.leadershipAssignments) ? state.leadershipAssignments : [])
    .filter(assignment => assignment.memberId === target)
    .sort((first, second) => {
      const dateComparison = String(second.startsOn || '').localeCompare(String(first.startsOn || ''));
      if (dateComparison) return dateComparison;
      return String(second.updatedAt || second.createdAt || '').localeCompare(String(first.updatedAt || first.createdAt || ''));
    });
}

export function activeLeadershipAssignment(state, memberId, at = new Date()) {
  const today = dateOnly(at) || dateOnly(new Date());
  return leadershipAssignmentsForMember(state, memberId)
    .filter(assignment => assignment.active !== false)
    .filter(assignment => assignment.startsOn <= today && assignment.endsOn >= today)
    .find(assignment => roleById(state, assignment.roleId)) || null;
}

export function currentLeadershipRole(state, memberId, at = new Date()) {
  const assignment = activeLeadershipAssignment(state, memberId, at);
  if (!assignment) return { assignment: null, role: null };
  return { assignment, role: roleById(state, assignment.roleId) };
}

export function effectivePortalUserRole(state, user, at = new Date()) {
  if (!user?.memberId) return { assignment: null, role: null, expired: false, legacy: false };
  const assignments = leadershipAssignmentsForMember(state, user.memberId);
  const current = currentLeadershipRole(state, user.memberId, at);
  if (current.role) return { ...current, expired: false, legacy: false };
  if (assignments.length) return { assignment: null, role: null, expired: true, legacy: false };
  const fallback = roleById(state, user.roleId);
  return { assignment: null, role: fallback, expired: false, legacy: Boolean(fallback) };
}

function rangesOverlap(first, second) {
  return first.startsOn <= second.endsOn && second.startsOn <= first.endsOn;
}

export function overlappingLeadershipAssignments(state, candidate, { ignoreId = '' } = {}) {
  return leadershipAssignmentsForMember(state, candidate?.memberId)
    .filter(assignment => assignment.id !== ignoreId)
    .filter(assignment => assignment.active !== false)
    .filter(assignment => rangesOverlap(assignment, candidate));
}

export function createLeadershipAssignment({
  id,
  memberId,
  roleId,
  lionYear,
  startsOn,
  endsOn,
  notes = '',
  active = true,
  now = new Date()
}) {
  const bounds = lionYearBounds(lionYear || lionYearForDate(startsOn || now));
  const timestamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  return normalizeLeadershipAssignmentRecord({
    id,
    memberId,
    roleId,
    lionYear: bounds.lionYear,
    startsOn: startsOn || bounds.startsOn,
    endsOn: endsOn || bounds.endsOn,
    notes,
    active,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function transitionLeadershipRole(state, {
  id,
  memberId,
  roleId,
  effectiveOn = new Date(),
  lionYear = lionYearForDate(effectiveOn),
  notes = '',
  now = new Date()
}) {
  if (!state || !Array.isArray(state.leadershipAssignments)) {
    throw new Error('O histórico de cargos não está disponível.');
  }
  const bounds = lionYearBounds(lionYear);
  const start = dateOnly(effectiveOn);
  if (!bounds.lionYear || !start || start < bounds.startsOn || start > bounds.endsOn) {
    throw new Error('A data de início deve pertencer ao Ano Leonístico selecionado.');
  }
  const current = activeLeadershipAssignment(state, memberId, start);
  if (current?.roleId === roleId) return current;

  const next = createLeadershipAssignment({
    id,
    memberId,
    roleId,
    lionYear: bounds.lionYear,
    startsOn: start,
    endsOn: bounds.endsOn,
    notes,
    now
  });
  const overlaps = overlappingLeadershipAssignments(state, next, { ignoreId: current?.id || '' });
  if (overlaps.length) {
    throw new Error('Já existe outro cargo ativo para este associado no período informado.');
  }

  if (current) {
    const previousDay = addDays(start, -1);
    if (previousDay >= current.startsOn) {
      current.endsOn = previousDay;
    } else {
      current.active = false;
      current.endsOn = current.startsOn;
    }
    current.updatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  }

  state.leadershipAssignments.push(next);
  return next;
}

export function leadershipAssignmentStatus(assignment, at = new Date()) {
  if (assignment?.active === false) return 'inactive';
  const today = dateOnly(at) || dateOnly(new Date());
  if (String(assignment?.startsOn || '') > today) return 'future';
  if (String(assignment?.endsOn || '') < today) return 'past';
  return 'current';
}

export function currentLionYear(value = new Date()) {
  return lionYearForDate(value);
}
