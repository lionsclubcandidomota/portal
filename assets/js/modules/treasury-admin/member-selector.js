import { escapeHtml, normalize } from '../../utils.js';

export function createMemberSelectorCard({ treasury, avatar }) {
  const memberSelectorCard = (member, { checked = false, disabled = false } = {}) => {
    const group = treasury.familyGroupForMember(member.id);
    return `<label class="member-selector-card" data-member-search="${escapeHtml(normalize(`${member.name || ''} ${member.memberNumber || ''} ${group?.name || ''}`))}">
      <input type="checkbox" name="memberIds" value="${escapeHtml(member.id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      ${avatar(member)}
      <span class="member-selector-copy"><strong>${escapeHtml(member.name)}</strong><small>${member.memberNumber ? `Nº ${escapeHtml(member.memberNumber)}` : 'Sem número informado'}</small>${group ? `<span class="membership-family-chip">👨‍👩‍👧‍👦 ${escapeHtml(group.name)}</span>` : ''}</span>
      <span class="member-selector-check" aria-hidden="true">✓</span>
    </label>`;
  };

  return memberSelectorCard;
}
