import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMemberAllocations,
  buildMembershipChargeMessage,
  calculateMembershipBase,
  normalizeTreasuryEntryPayload,
  resolveTreasuryEntryStatus
} from '../assets/js/modules/treasury-admin/domain.js';


test('calcula mensalidade individual sem duplicar associados', () => {
  const total = calculateMembershipBase({
    selectedIds: ['m1', 'm1', 'm2'],
    individualFee: 50
  });

  assert.equal(total, 100);
});


test('calcula plano familiar com titular e adicionais', () => {
  assert.equal(calculateMembershipBase({
    selectedIds: ['m1', 'm2', 'm3'],
    hasFamilyGroup: true,
    groupPrimaryId: 'm1',
    familyPrimaryFee: 45,
    familyAdditionalFee: 30
  }), 105);

  assert.equal(calculateMembershipBase({
    selectedIds: ['m2', 'm3'],
    hasFamilyGroup: true,
    groupPrimaryId: 'm1',
    familyPrimaryFee: 45,
    familyAdditionalFee: 30
  }), 60);
});


test('gera alocações mensais preservando papel, meses e valor por associado', () => {
  const allocations = buildMemberAllocations({
    memberIds: ['m1', 'm2'],
    members: [
      { id: 'm1', name: 'Ana' },
      { id: 'm2', name: 'Bruno' }
    ],
    coveredMonths: ['2026-07', '2026-08'],
    hasFamilyGroup: true,
    groupPrimaryId: 'm1',
    familyPrimaryFee: 45,
    familyAdditionalFee: 30
  });

  assert.deepEqual(allocations, [
    {
      memberId: 'm1',
      memberName: 'Ana',
      role: 'Titular',
      monthlyAmount: 45,
      months: ['2026-07', '2026-08'],
      amount: 90
    },
    {
      memberId: 'm2',
      memberName: 'Bruno',
      role: 'Familiar',
      monthlyAmount: 30,
      months: ['2026-07', '2026-08'],
      amount: 60
    }
  ]);
});


test('monta mensagem de cobrança com pluralização e valor estimado', () => {
  const message = buildMembershipChargeMessage({
    memberName: 'João da Silva',
    monthLabels: ['julho de 2026', 'agosto de 2026'],
    expectedTotal: 100,
    clubName: 'Lions Clube de Teste'
  });

  assert.match(message, /^Olá, João!/);
  assert.match(message, /mensalidades pendentes referentes a julho de 2026, agosto de 2026/);
  assert.match(message, /R\$\s*100,00/);
  assert.match(message, /Tesouraria do Lions Clube de Teste$/);
});


test('normaliza valores do formulário de lançamento', () => {
  const { data, statusMode } = normalizeTreasuryEntryPayload({
    date: '2026-07-30',
    description: 'Doação',
    category: '  Doações  ',
    accountId: '',
    entry: '120.50',
    exit: '',
    statusMode: 'Efetivado'
  }, { defaultAccountId: 'a1' });

  assert.equal(statusMode, 'Efetivado');
  assert.equal(data.category, 'Doações');
  assert.equal(data.accountId, 'a1');
  assert.equal(data.entry, 120.5);
  assert.equal(data.exit, 0);
  assert.equal('statusMode' in data, false);
});


test('rejeita lançamento sem valor ou com entrada e saída simultâneas', () => {
  assert.throws(
    () => normalizeTreasuryEntryPayload({ category: 'Doações' }),
    /Informe um valor de entrada ou saída/
  );
  assert.throws(
    () => normalizeTreasuryEntryPayload({ category: 'Doações', entry: 10, exit: 5 }),
    /Informe apenas entrada ou saída/
  );
});


test('resolve status de lançamentos efetivados, programados e vencidos', () => {
  const now = new Date(2026, 6, 30, 12, 0, 0);

  assert.equal(resolveTreasuryEntryStatus({ entry: 10, statusMode: 'Efetivado' }, now), 'Recebido');
  assert.equal(resolveTreasuryEntryStatus({ entry: 0, statusMode: 'Efetivado' }, now), 'Pago');
  assert.equal(resolveTreasuryEntryStatus({ date: '2026-07-31', statusMode: 'Programado' }, now), 'Programado');
  assert.equal(resolveTreasuryEntryStatus({ date: '2026-07-29', statusMode: 'Programado' }, now), 'Vencida');
});
