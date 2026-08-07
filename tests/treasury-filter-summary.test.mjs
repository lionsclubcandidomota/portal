import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeMovementFilter } from '../assets/js/modules/treasury/movements.js';
import { appointmentListItem } from '../assets/js/modules/appointments.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const treasury = {
  isProgrammed(item) {
    return ['Programado', 'Agendado', 'Pendente'].includes(item.status);
  }
};

const movements = [
  { id: 'r-in', entry: 300, exit: 0, status: 'Recebido' },
  { id: 'r-out', entry: 0, exit: 100, status: 'Pago' },
  { id: 'p-in', entry: 220, exit: 0, status: 'Programado' },
  { id: 'p-out', entry: 0, exit: 80, status: 'Programado' }
];

test('filtro Programados recalcula entradas, saídas, saldo e quantidade', () => {
  const programmed = movements.filter(item => treasury.isProgrammed(item));
  const summary = summarizeMovementFilter(programmed, 'scheduled', treasury);

  assert.deepEqual(summary, {
    entries: 220,
    exits: 80,
    result: 140,
    count: 2,
    entryLabel: 'Entradas programadas',
    exitLabel: 'Saídas programadas',
    resultLabel: 'Saldo previsto'
  });
});

test('filtro geral mantém o cálculo histórico somente com realizados', () => {
  const summary = summarizeMovementFilter(movements, 'all', treasury);
  assert.equal(summary.entries, 300);
  assert.equal(summary.exits, 100);
  assert.equal(summary.result, 200);
  assert.equal(summary.count, 2);
});

test('compromisso do Dashboard usa estrutura responsiva sem bloco dentro de small', async () => {
  const html = appointmentListItem({
    id: 'e1',
    appointmentType: 'event',
    title: 'Evento com título longo para testar a responsividade',
    date: '2026-08-10',
    time: '19:30',
    locationType: 'virtual',
    onlineUrl: 'https://meet.google.com/abc-defg-hij'
  });
  const css = await readFile(path.join(projectRoot, 'assets/css/components/clean-ui.css'), 'utf8');

  assert.match(html, /appointment-home-content/);
  assert.match(html, /appointment-home-details/);
  assert.match(html, /appointment-home-type/);
  assert.doesNotMatch(html, /<small[^>]*>\s*<div/);
  assert.match(css, /grid-template-areas:\s*"icon content type"/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /grid-template-areas:\s*\n\s*"icon content"\s*\n\s*"\. type"/);
});
