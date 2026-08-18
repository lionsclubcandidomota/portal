import test from 'node:test';
import assert from 'node:assert/strict';
import { birthdayCards, birthdayRows } from '../assets/js/modules/birthdays.js';

const person = { id: 'm1', name: 'Ana Teste', memberNumber: '123456', birthDate: '1990-08-01', active: true };
const helpers = {
  daysUntil: () => 10,
  nextBirthdayDate: () => new Date(2026, 7, 1),
  birthdayStatus: () => ({ text: 'Daqui a 10 dias', icon: '📅', className: 'later' }),
  birthdayDisplayDate: () => '01 de agosto',
  parseLocalDate: value => new Date(`${value}T00:00:00`),
  memberIsActive: () => true,
  avatar: () => '<span>avatar</span>',
  escapeHtml: value => String(value),
  birthdayActions: () => '',
  empty: () => ''
};

test('oculta número do associado nas linhas de visitante', () => {
  const html = birthdayRows([person], { ...helpers, showMemberStatus: false, showMemberNumber: false });
  assert.doesNotMatch(html, /123456|Nº do associado/);
  assert.match(html, /Ana Teste/);
  assert.equal((html.match(/<td(?:\s|>)/g) || []).length, 4);
});

test('oculta número do associado nos cartões de visitante', () => {
  const html = birthdayCards([person], { ...helpers, showMemberStatus: false, showMemberNumber: false });
  assert.doesNotMatch(html, /123456|Associado nº|Número não informado/);
  assert.match(html, /Ana Teste/);
});
