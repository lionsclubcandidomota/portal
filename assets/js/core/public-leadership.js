import { memberIsActive } from './portal-members.js?v=6.44.1';
import { roleById } from './portal-access.js?v=6.44.1';
import {
  currentLionYear,
  leadershipAssignmentStatus
} from './portal-leadership.js?v=6.44.1';
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

export function currentPublicLeaders(state, at = new Date()) {
  const lionYear = currentLionYear(at);
  const members = new Map((Array.isArray(state?.birthdays) ? state.birthdays : [])
    .filter(memberIsActive)
    .map(member => [String(member.id || '').trim(), member]));

  return (Array.isArray(state?.leadershipAssignments) ? state.leadershipAssignments : [])
    .filter(assignment => assignment?.active !== false)
    .filter(assignment => assignment?.lionYear === lionYear)
    .filter(assignment => leadershipAssignmentStatus(assignment, at) === 'current')
    .map(assignment => ({
      assignment,
      member: members.get(String(assignment.memberId || '').trim()),
      role: roleById(state, assignment.roleId)
    }))
    .filter(item => item.member && item.role?.active !== false)
    .sort((first, second) => {
      const priority = rolePriority(first.role.name) - rolePriority(second.role.name);
      if (priority) return priority;
      const roleName = String(first.role.name || '').localeCompare(String(second.role.name || ''), 'pt-BR');
      if (roleName) return roleName;
      return String(first.member.name || '').localeCompare(String(second.member.name || ''), 'pt-BR');
    });
}

export function publicLeadershipSummary(state, at = new Date()) {
  const leaders = currentPublicLeaders(state, at);
  return Object.freeze({
    lionYear: currentLionYear(at),
    leaders,
    count: leaders.length,
    roleCount: new Set(leaders.map(item => item.role.id)).size
  });
}
