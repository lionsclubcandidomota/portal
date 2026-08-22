export const REPORT_TYPES = Object.freeze({
  movements: Object.freeze({
    label: 'Movimentações financeiras',
    shortLabel: 'Movimentações',
    icon: 'wallet',
    group: 'Financeiro',
    description: 'Entradas, saídas, contas, categorias e resultado do período.',
    hint: 'Ideal para prestação de contas e conferência financeira.'
  }),
  memberships: Object.freeze({
    label: 'Mensalidades',
    shortLabel: 'Mensalidades',
    icon: 'receipt',
    group: 'Financeiro',
    description: 'Previsto, recebido, pendências e situação de cada associado.',
    hint: 'Respeita valores históricos, pagamentos parciais e saldo anterior separado.'
  }),
  mutuals: Object.freeze({
    label: 'Mútuas',
    shortLabel: 'Mútuas',
    icon: 'heart',
    group: 'Financeiro',
    description: 'Ocorrências, cobranças, pagamentos e valores em aberto.',
    hint: 'Mostra a cobertura das cobranças por falecimento e o que ainda falta receber.'
  }),
  birthdays: Object.freeze({
    label: 'Aniversariantes',
    shortLabel: 'Aniversariantes',
    icon: 'cake',
    group: 'Pessoas',
    description: 'Aniversariantes do período, situação e identificação leonística.',
    hint: 'Útil para comunicação, homenagens e planejamento das próximas datas.'
  }),
  agenda: Object.freeze({
    label: 'Agenda',
    shortLabel: 'Agenda',
    icon: 'calendar',
    group: 'Atividades',
    description: 'Eventos e reuniões com data, local, situação e detalhes.',
    hint: 'Consolida compromissos do período em uma única visão cronológica.'
  }),
  notices: Object.freeze({
    label: 'Avisos',
    shortLabel: 'Avisos',
    icon: 'megaphone',
    group: 'Comunicação',
    description: 'Comunicados cuja vigência coincide com o período selecionado.',
    hint: 'Ajuda a revisar prioridades, vigências e histórico de comunicação.'
  })
});

export const REPORT_ORDER = Object.freeze(Object.keys(REPORT_TYPES));
