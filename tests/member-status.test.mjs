import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMBER_STATUS,
  memberCanJoinMutual,
  memberIsActive,
  memberIsInactive,
  memberIsMutual,
  memberStatusLabel,
  normalizeMemberRecord
} from '../assets/js/core/portal-members.js';
import { birthdayMatchesPeriod, birthdayRows, createBirthdaysController } from '../assets/js/modules/birthdays.js';
import { entityFormHtml } from '../assets/js/modules/entity-forms/templates.js';
import { buildMembershipViewModel } from '../assets/js/modules/treasury/memberships.js';
import { createTreasuryController } from '../assets/js/modules/treasury/controller.js';
import { parseLocalDate, sumTreasury } from '../assets/js/utils.js';

function createTreasury(state) {
  return createTreasuryController({
    getState: () => state,
    parseLocalDate,
    normalize: value => String(value || '').toLocaleLowerCase('pt-BR'),
    todayStart: () => new Date(2026, 7, 1),
    sumTreasury
  });
}

test('situação Mútua é distinta de associado ativo e de inativo', () => {
  const mutual = normalizeMemberRecord({ id: 'm1', name: 'Mutuário', status: 'Mutuário' });
  const active = normalizeMemberRecord({ id: 'a1', name: 'Associado' });
  const inactive = normalizeMemberRecord({ id: 'i1', name: 'Inativo', active: false });

  assert.equal(mutual.status, MEMBER_STATUS.MUTUAL);
  assert.equal(mutual.active, true);
  assert.equal(memberIsMutual(mutual), true);
  assert.equal(memberIsActive(mutual), false);
  assert.equal(memberCanJoinMutual(mutual), true);
  assert.equal(memberIsActive(active), true);
  assert.equal(memberCanJoinMutual(active), true);
  assert.equal(memberIsInactive(inactive), true);
  assert.equal(memberCanJoinMutual(inactive), false);
});

test('formulário de aniversariante oferece a opção Mútua', () => {
  const html = entityFormHtml('birthday', { status: 'Mútua' });
  assert.match(html, /name="status"/);
  assert.match(html, /value="Mútua" selected/);
  assert.match(html, /Mutuários participam das mútuas/);
});

test('filtro Mutuários lista apenas aniversariantes com situação Mútua', () => {
  const controller = createBirthdaysController();
  controller.activeFilter = 'mutual';
  const common = {
    memberIsActive,
    parseLocalDate,
    nextBirthdayDate: () => new Date(2026, 7, 10),
    daysUntil: () => 9
  };

  assert.equal(birthdayMatchesPeriod({ status: 'Mútua', birthDate: '1980-08-10' }, controller, common), true);
  assert.equal(birthdayMatchesPeriod({ status: 'Ativo', birthDate: '1980-08-10' }, controller, common), false);
  assert.equal(birthdayMatchesPeriod({ status: 'Inativo', birthDate: '1980-08-10' }, controller, common), false);
});

test('identificação visual de aniversariantes mostra Mútua', () => {
  const rows = birthdayRows([{ id: 'm1', name: 'Maria', status: 'Mútua', birthDate: '1980-08-10' }], {
    daysUntil: () => 9,
    nextBirthdayDate: () => new Date(2026, 7, 10),
    birthdayStatus: () => ({ className: 'later', icon: '📅', text: 'Depois' }),
    birthdayDisplayDate: () => '10 de agosto',
    parseLocalDate,
    memberIsActive,
    avatar: () => '<span>👤</span>',
    escapeHtml: value => String(value),
    birthdayActions: () => '',
    showMemberStatus: true,
    showMemberNumber: true
  });

  assert.match(rows, /<small>Mútua<\/small>/);
  assert.equal(memberStatusLabel({ status: 'Mútua' }), 'Mútua');
});

test('Mutuários não entram nas mensalidades, mas permanecem elegíveis para grupos de mútuas', () => {
  const state = {
    settings: {},
    birthdays: [
      { id: 'a1', name: 'Associado', status: 'Ativo', active: true },
      { id: 'm1', name: 'Mutuário', status: 'Mútua', active: true },
      { id: 'i1', name: 'Inativo', status: 'Inativo', active: false }
    ],
    treasuryAccounts: [],
    treasuryCategories: [],
    familyGroups: [],
    mutualGroups: [],
    treasury: []
  };
  const treasury = createTreasury(state);
  treasury.membershipStart = '2026-08';
  treasury.membershipEnd = '2026-08';
  const model = buildMembershipViewModel(state, treasury, new Date(2026, 7, 1));

  assert.deepEqual(model.membershipMembers.map(member => member.id), ['a1']);
  assert.equal(treasury.memberCanJoinMutual(state.birthdays[1]), true);
  assert.equal(treasury.memberIsMutual(state.birthdays[1]), true);
});
