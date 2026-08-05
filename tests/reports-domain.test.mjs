import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, dateRangeOverlaps, monthRange } from '../assets/js/modules/reports/domain.js';
import { reportCsv } from '../assets/js/modules/reports/controller.js';

const state = {
  settings: { clubName: 'Clube Teste' },
  birthdays: [
    { id: 'm1', name: 'Ana', memberNumber: '10', birthDate: '1990-07-15', active: true },
    { id: 'm2', name: 'Bruno', memberNumber: '20', birthDate: '1985-08-02', active: true }
  ],
  familyGroups: [],
  treasuryAccounts: [{ id: 'acc', name: 'Conta principal' }],
  treasury: [
    { id: 't1', date: '2026-07-10', category: 'Doações', description: 'Entrada', entry: 100, exit: 0, accountId: 'acc', status: 'Recebido' },
    {
      id: 't2',
      date: '2026-07-12',
      category: 'Mensalidades',
      description: 'Mensalidade - Ana',
      entry: 40,
      exit: 0,
      memberId: 'm1',
      memberIds: ['m1'],
      coveredMonths: ['2026-07'],
      memberAllocations: [{ memberId: 'm1', amount: 40 }],
      status: 'Recebido'
    }
  ],
  events: [{ id: 'e1', date: '2026-07-20', time: '19:00', name: 'Evento', location: 'Sede', status: 'Confirmado' }],
  meetings: [{ id: 'r1', date: '2026-08-01', time: '20:00', theme: 'Reunião', location: 'Sede' }],
  notices: [{ id: 'n1', date: '2026-07-01', endDate: '2026-07-31', title: 'Aviso', priority: 'Alta', text: 'Conteúdo' }]
};

const options = {
  bounds: { start: '2026-07-01', end: '2026-07-31' },
  periodPreset: 'custom',
  periodText: 'Julho de 2026',
  now: new Date(2026, 6, 31, 10, 0)
};

test('gera relatório financeiro limitado ao período', () => {
  const report = buildReport('movements', state, options);
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0][3], 'Conta principal');
  assert.equal(report.summary.find(item => item.label === 'Entradas').value, 'R$ 140,00');
});

test('gera relatório de mensalidades com pagos e pendentes', () => {
  const report = buildReport('memberships', state, options);
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0][0], 'Ana');
  assert.equal(report.rows[0].at(-1), 'Em dia');
  assert.equal(report.rows[1].at(-1), 'Pendente');
  assert.equal(report.summary.find(item => item.label === 'Pendências').value, '1');
});

test('gera aniversariantes e agenda somente do período', () => {
  const birthdays = buildReport('birthdays', state, options);
  const agenda = buildReport('agenda', state, options);
  assert.deepEqual(birthdays.rows.map(row => row[0]), ['Ana']);
  assert.deepEqual(agenda.rows.map(row => row[3]), ['Evento']);
});

test('considera aviso com vigência sobreposta ao período', () => {
  assert.equal(dateRangeOverlaps('2026-06-20', '2026-07-03', options.bounds), true);
  assert.equal(dateRangeOverlaps('2026-08-01', '2026-08-10', options.bounds), false);
  const report = buildReport('notices', state, options);
  assert.equal(report.rows.length, 1);
});

test('monta faixa mensal e CSV compatível com Excel', () => {
  assert.deepEqual(monthRange('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  const csv = reportCsv(buildReport('birthdays', state, options));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Pessoa";"Número"/);
  assert.match(csv, /"Ana";"10"/);
});


test('gera relatório de mútuas por evento de falecimento, baixas e exportação', () => {
  const mutualState = {
    ...state,
    mutualGroups: [{
      id: 'mu1',
      name: 'Grupo Solidário',
      createdDate: '2026-07-01',
      closedDate: '',
      memberships: [{ id: 'mum1', memberId: 'm1', joinedDate: '2026-07-01', endedDate: '' }],
      events: [{
        id: 'e1',
        deceasedName: 'João do Distrito',
        deathDate: '2026-07-20',
        amountPerParticipant: 15,
        participantIds: ['m1']
      }]
    }],
    treasury: [
      ...state.treasury,
      {
        id: 'tm1',
        date: '2026-07-31',
        paymentDate: '2026-07-31',
        category: 'Mútuas',
        description: 'Mútua - Falecimento de João do Distrito - Ana',
        entry: 15,
        exit: 0,
        accountId: 'acc',
        status: 'Recebido',
        memberId: 'm1',
        memberIds: ['m1'],
        mutualGroupId: 'mu1',
        mutualEventId: 'e1',
        mutualEventDate: '2026-07-20',
        mutualDeceasedName: 'João do Distrito',
        mutualMemberId: 'm1',
        mutualChargeKey: 'mu1::e1::m1'
      }
    ]
  };

  const report = buildReport('mutuals', mutualState, options);
  assert.equal(report.rows.length, 1);
  assert.deepEqual(report.rows[0].slice(0, 5), ['Grupo Solidário', 'João do Distrito', '20/07/2026', 'Ana', '10']);
  assert.equal(report.rows[0][6], 'Paga');
  assert.equal(report.rows[0][8], 'Conta principal');
  assert.equal(report.summary.find(item => item.label === 'Total recebido').value, 'R$ 15,00');

  const csv = reportCsv(report);
  assert.match(csv, /"Grupo";"Falecimento";"Data";"Participante"/);
  assert.match(csv, /"Grupo Solidário";"João do Distrito";"20\/07\/2026";"Ana"/);
});
