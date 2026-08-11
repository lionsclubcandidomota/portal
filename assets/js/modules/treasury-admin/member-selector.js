import { escapeHtml, normalize } from '../../utils.js';
import { uiIcon } from '../visual-helpers.js?v=6.46.7';

export function createMemberSelectorCard({ treasury, avatar }) {
  const memberSelectorCard = (member, { checked = false, disabled = false } = {}) => {
    const group = treasury.familyGroupForMember(member.id);
    return `<label class="member-selector-card" data-member-search="${escapeHtml(normalize(`${member.name || ''} ${member.memberNumber || ''} ${group?.name || ''}`))}">
      <input type="checkbox" name="memberIds" value="${escapeHtml(member.id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      ${avatar(member)}
      <span class="member-selector-copy"><strong>${escapeHtml(member.name)}</strong><small>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número informado'}</small>${group ? `<span class="membership-family-chip">${uiIcon('family')} ${escapeHtml(group.name)}</span>` : ''}</span>
      <span class="member-selector-check" aria-hidden="true">${uiIcon('check')}</span>
    </label>`;
  };

  return memberSelectorCard;
}
