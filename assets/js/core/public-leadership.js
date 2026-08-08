import { memberIsActive, memberIsMutual } from './portal-members.js?v=6.46.5';
import { roleById } from './portal-access.js?v=6.46.5';
import {
  currentLionYear,
  leadershipAssignmentStatus,
  normalizeLionYear
} from './portal-leadership.js?v=6.46.5';
import { normalize } from '../utils.js';

const ROLE_PRIORITY = Object.freeze([
  'presidente',
  'vice presidente',
  'secretario',
  'tesoureiro',
  'diretor'
]);

function rolePriority(roleName) {
  const normalized = normalize(roleName).replace(/[^a-z0-9]+/g, ' ').trim();
  const exact = ROLE_PRIORITY.indexOf(normalized);
  if (exact >= 0) return exact;
  const partial = ROLE_PRIORITY.findIndex(role => normalized.includes(role));
  return partial >= 0 ? partial : ROLE_PRIORITY.length;
}

function sortLeaders(items) {
  return items.sort((first, second) => {
    const priority = rolePriority(first.role.name) - rolePriority(second.role.name);
    if (priority) return priority;
    const roleName = String(first.role.name || '').localeCompare(String(second.role.name || ''), 'pt-BR');
    if (roleName) return roleName;
    return String(first.member.name || '').localeCompare(String(second.member.name || ''), 'pt-BR');
  });
}

export function availablePublicLionYears(state, at = new Date()) {
  const current = currentLionYear(at);
  const years = new Set([current]);
  for (const assignment of Array.isArray(state?.leadershipAssignments) ? state.leadershipAssignments : []) {
    const year = normalizeLionYear(assignment?.lionYear);
    if (year && year <= current) years.add(year);
  }
  return [...years].sort((a, b) => b.localeCompare(a));
}

export function publicLeadersForYear(state, lionYear, at = new Date()) {
  const selectedYear = normalizeLionYear(lionYear) || currentLionYear(at);
  const currentYear = currentLionYear(at);
  const historical = selectedYear !== currentYear;
  const members = new Map((Array.isArray(state?.birthdays) ? state.birthdays : [])
    .filter(member => historical ? !memberIsMutual(member) : memberIsActive(member))
    .map(member => [String(member.id || '').trim(), member]));
  const roles = new Map((Array.isArray(state?.accessRoles) ? state.accessRoles : [])
    .map(role => [String(role.id || '').trim(), role]));

  const assignments = (Array.isArray(state?.leadershipAssignments) ? state.leadershipAssignments : [])
    .filter(assignment => assignment?.active !== false)
    .filter(assignment => assignment?.lionYear === selectedYear)
    .filter(assignment => selectedYear !== currentYear || leadershipAssignmentStatus(assignment, at) === 'current');

  return sortLeaders(assignments
    .map(assignment => ({
      assignment,
      member: members.get(String(assignment.memberId || '').trim()),
      role: historical ? roles.get(String(assignment.roleId || '').trim()) : roleById(state, assignment.roleId)
    }))
    .filter(item => item.member && item.role && (historical || item.role.active !== false)));
}

export function currentPublicLeaders(state, at = new Date()) {
  return publicLeadersForYear(state, currentLionYear(at), at);
}

export function publicLeadershipSummary(state, at = new Date(), lionYear = currentLionYear(at)) {
  const selectedYear = normalizeLionYear(lionYear) || currentLionYear(at);
  const leaders = publicLeadersForYear(state, selectedYear, at);
  return Object.freeze({
    lionYear: selectedYear,
    currentLionYear: currentLionYear(at),
    historical: selectedYear !== currentLionYear(at),
    availableYears: availablePublicLionYears(state, at),
    leaders,
    count: leaders.length,
    roleCount: new Set(leaders.map(item => item.role.id)).size
  });
}
