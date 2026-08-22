import { uid, toInputDate } from '../utils.js';

const TRANSIENT_STATE_FIELDS = new Set(['updatedAt', 'deploymentId']);
const PROGRAMMED_TREASURY_STATUSES = new Set([
  'programado',
  'agendado',
  'pendente',
  'vencida',
  'vencido'
]);

/**
 * Normaliza os status financeiros antigos para os valores usados atualmente.
 * A função preserva a referência do estado para manter compatibilidade com a
 * camada de armazenamento já existente.
 */
export function normalizeTreasuryStatuses(state, today = new Date()) {
  if (!Array.isArray(state?.treasury)) return state;
  const todayKey = toInputDate(today);

  state.treasury.forEach(item => {
    const status = String(item?.status || '').trim().toLocaleLowerCase('pt-BR');

    if (status === 'realizado') {
      item.status = Number(item?.entry || 0) > 0 ? 'Recebido' : 'Pago';
      return;
    }

    if (!PROGRAMMED_TREASURY_STATUSES.has(status)) return;
    item.status = item.date && item.date < todayKey ? 'Vencida' : 'Programado';
  });

  return state;
}

export function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

export function canonicalState(value) {
  if (Array.isArray(value)) return value.map(canonicalState);

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (!TRANSIENT_STATE_FIELDS.has(key)) {
          result[key] = canonicalState(value[key]);
        }
        return result;
      }, {});
  }

  return value;
}

export function statesAreEquivalent(first, second) {
  try {
    return JSON.stringify(canonicalState(first)) === JSON.stringify(canonicalState(second));
  } catch {
    return false;
  }
}

/**
 * Remove propriedades administrativas que não devem ser publicadas e aplica
 * normalizações de compatibilidade antes de salvar ou enviar o estado.
 */
export function sanitizePortalState(state, today = new Date()) {
  state.events = Array.isArray(state.events)
    ? state.events.map(({ responsible, ...event }) => event)
    : [];

  state.meetings = Array.isArray(state.meetings)
    ? state.meetings.map(({ responsible, ...meeting }) => meeting)
    : [];

  return normalizeTreasuryStatuses(state, today);
}

/**
 * Gera dados iniciais somente para instalações ainda não configuradas.
 */
export function createSeedState(state, today = new Date()) {
  if (state.settings?.initialized) return false;

  const future = days => toInputDate(new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + days
  ));

  state.birthdays = [
    {
      id: uid('b'),
      memberNumber: '',
      name: 'Maria Helena',
      birthDate: `1965-${String(today.getMonth() + 1).padStart(2, '0')}-${String(Math.min(28, today.getDate() + 3)).padStart(2, '0')}`,
      photo: ''
    },
    {
      id: uid('b'),
      memberNumber: '',
      name: 'Carlos Alberto',
      birthDate: '1972-09-18',
      photo: ''
    }
  ];

  state.treasuryAccounts = [
    { id: 'acc-current', name: 'Conta corrente', type: 'Conta corrente', initialBalance: 0, active: true, membershipDefault: true },
    { id: 'acc-investment', name: 'Aplicação', type: 'Aplicação', initialBalance: 0, active: true },
    { id: 'acc-cash', name: 'Dinheiro em caixa', type: 'Dinheiro em caixa', initialBalance: 0, active: true }
  ];

  state.treasuryCategories = [
    'Mensalidades',
    'Mútuas',
    'Material de escritório',
    'Documentação',
    'Projeto',
    'Evento',
    'Patrocínio',
    'Combustível',
    'Taxa bancária',
    'Doação',
    'Outros'
  ];

  state.treasury = [
    {
      id: uid('t'),
      date: future(-15),
      description: 'Mensalidades',
      category: 'Mensalidades',
      accountId: 'acc-current',
      entry: 1250,
      exit: 0,
      status: 'Recebido',
      notes: 'Recebimentos do mês'
    },
    {
      id: uid('t'),
      date: future(-7),
      description: 'Material de campanha',
      category: 'Projetos',
      accountId: 'acc-current',
      entry: 0,
      exit: 430.5,
      status: 'Pago',
      notes: ''
    }
  ];

  state.events = [
    {
      id: uid('e'),
      name: 'Porco no Rolete da APAE',
      date: future(12),
      time: '11:00',
      location: 'APAE de Cândido Mota',
      description: 'Evento beneficente.',
      status: 'Confirmado'
    },
    {
      id: uid('e'),
      name: 'Campanha da Visão',
      date: future(30),
      time: '09:00',
      location: 'Praça Central',
      description: 'Ação comunitária.',
      status: 'Em planejamento'
    }
  ];

  state.meetings = [
    {
      id: uid('m'),
      date: future(5),
      time: '20:00',
      location: 'Sede da APAE',
      theme: 'Planejamento das próximas ações',
      notes: 'Participação de todos os companheiros.'
    }
  ];

  state.notices = [
    {
      id: uid('n'),
      title: 'Reunião importante',
      text: 'A presença de todos será fundamental para definirmos as próximas atividades do clube.',
      date: future(1),
      priority: 'Alta'
    }
  ];

  state.settings = {
    ...state.settings,
    initialized: true
  };

  return true;
}
