const MONEY_FORMAT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const FIELD_LABELS = {
  clubName: 'Nome do clube',
  logo: 'Logotipo',
  primaryColor: 'Cor principal',
  accentColor: 'Cor de destaque',
  fontFamily: 'Fonte do portal',
  membershipMonthlyFee: 'Mensalidade individual',
  membershipFamilyPrimaryFee: 'Mensalidade do titular',
  membershipFamilyAdditionalFee: 'Mensalidade adicional',
  accessProfiles: 'Perfis de acesso',
  memberNumber: 'Número de associado',
  name: 'Nome',
  birthDate: 'Data de nascimento',
  photo: 'Foto',
  type: 'Tipo',
  initialBalance: 'Saldo inicial',
  active: 'Conta ativa',
  memberIds: 'Integrantes',
  primaryMemberId: 'Titular',
  notes: 'Observações',
  attachments: 'Anexos',
  date: 'Data',
  endDate: 'Data final',
  category: 'Categoria',
  description: 'Descrição',
  entry: 'Entrada',
  exit: 'Saída',
  accountId: 'Conta',
  status: 'Status',
  memberId: 'Associado',
  coveredMonths: 'Meses cobertos',
  referenceMonth: 'Mês de referência',
  familyGroupId: 'Grupo familiar',
  amount: 'Valor',
  memberships: 'Participantes do grupo',
  events: 'Falecimentos registrados',
  deceasedName: 'Pessoa falecida',
  occurrenceDate: 'Data do falecimento',
  participantIds: 'Participantes cobrados',
  createdAt: 'Registrado em',
  time: 'Horário',
  location: 'Local',
  locationType: 'Tipo de local',
  onlineUrl: 'Link on-line',
  theme: 'Tema',
  title: 'Título',
  text: 'Conteúdo',
  priority: 'Prioridade'
};

const SETTINGS_FIELDS = [
  'clubName',
  'logo',
  'primaryColor',
  'accentColor',
  'fontFamily',
  'membershipMonthlyFee',
  'membershipFamilyPrimaryFee',
  'membershipFamilyAdditionalFee',
  'accessProfiles'
];

const COLLECTIONS = [
  {
    key: 'birthdays',
    title: 'Associados e aniversariantes',
    icon: 'cake',
    singular: 'associado',
    fields: ['memberNumber', 'name', 'birthDate', 'photo'],
    itemTitle: item => item?.name || 'Associado sem nome'
  },
  {
    key: 'treasuryAccounts',
    title: 'Contas da Tesouraria',
    icon: 'bank',
    singular: 'conta',
    fields: ['name', 'type', 'initialBalance', 'active'],
    itemTitle: item => item?.name || 'Conta sem nome'
  },
  {
    key: 'familyGroups',
    title: 'Grupos familiares',
    icon: 'family',
    singular: 'grupo familiar',
    fields: ['name', 'memberIds', 'primaryMemberId', 'notes'],
    itemTitle: item => item?.name || 'Grupo sem nome'
  },
  {
    key: 'mutualGroups',
    title: 'Grupos e falecimentos de mútuas',
    icon: 'heart',
    singular: 'grupo de mútua',
    fields: ['name', 'memberships', 'events', 'notes'],
    itemTitle: item => item?.name || 'Grupo de mútua sem nome'
  },
  {
    key: 'treasury',
    title: 'Movimentações da Tesouraria',
    icon: 'money',
    singular: 'movimentação',
    fields: [
      'date', 'description', 'category', 'entry', 'exit', 'status', 'accountId',
      'memberId', 'memberIds', 'coveredMonths', 'referenceMonth',
      'familyGroupId', 'notes', 'attachments'
    ],
    itemTitle: item => item?.description || (Number(item?.entry || 0) > 0 ? 'Entrada financeira' : 'Saída financeira')
  },
  {
    key: 'events',
    title: 'Agenda',
    icon: 'calendar',
    singular: 'agendamento',
    fields: ['name', 'date', 'time', 'location', 'locationType', 'onlineUrl', 'status', 'description'],
    itemTitle: item => item?.name || 'Agendamento sem nome'
  },
  {
    key: 'meetings',
    title: 'Compromissos',
    icon: 'clock',
    singular: 'compromisso',
    fields: ['theme', 'date', 'time', 'location', 'locationType', 'onlineUrl', 'status', 'notes'],
    itemTitle: item => item?.theme || 'Compromisso sem tema'
  },
  {
    key: 'notices',
    title: 'Avisos',
    icon: 'megaphone',
    singular: 'aviso',
    fields: ['title', 'date', 'endDate', 'priority', 'text'],
    itemTitle: item => item?.title || 'Aviso sem título'
  }
];

const MONEY_FIELDS = new Set([
  'initialBalance',
  'membershipMonthlyFee',
  'membershipFamilyPrimaryFee',
  'membershipFamilyAdditionalFee',
  'entry',
  'exit',
  'amount'
]);

const DATE_FIELDS = new Set(['date', 'endDate', 'birthDate', 'occurrenceDate', 'createdAt']);
const IMAGE_FIELDS = new Set(['photo', 'logo']);
const LONG_TEXT_FIELDS = new Set(['notes', 'description', 'text']);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isEqual(first, second) {
  try {
    return JSON.stringify(first) === JSON.stringify(second);
  } catch {
    return first === second;
  }
}

function parseDate(value) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return String(value || '');
  const [year, month] = String(value).split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
}

function summarizeText(value, limit = 260) {
  const text = String(value ?? '').trim();
  if (!text) return 'Não informado';
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
}

function buildLookups(previousState, currentState) {
  const combinedMembers = [
    ...(Array.isArray(previousState?.birthdays) ? previousState.birthdays : []),
    ...(Array.isArray(currentState?.birthdays) ? currentState.birthdays : [])
  ];
  const combinedAccounts = [
    ...(Array.isArray(previousState?.treasuryAccounts) ? previousState.treasuryAccounts : []),
    ...(Array.isArray(currentState?.treasuryAccounts) ? currentState.treasuryAccounts : [])
  ];
  const combinedGroups = [
    ...(Array.isArray(previousState?.familyGroups) ? previousState.familyGroups : []),
    ...(Array.isArray(currentState?.familyGroups) ? currentState.familyGroups : [])
  ];

  return {
    members: new Map(combinedMembers.map(item => [String(item?.id || ''), item?.name || item?.memberNumber || 'Associado'])),
    accounts: new Map(combinedAccounts.map(item => [String(item?.id || ''), item?.name || 'Conta'])),
    groups: new Map(combinedGroups.map(item => [String(item?.id || ''), item?.name || 'Grupo familiar']))
  };
}

function formatValue(field, value, lookups, position = 'after') {
  if (field === 'fontFamily') {
    return ({ modern: 'Moderna', humanist: 'Suave', accessible: 'Alta legibilidade' })[String(value || '')] || 'Moderna';
  }
  if (field === 'attachments') {
    const attachments = Array.isArray(value) ? value : [];
    if (!attachments.length) return 'Nenhum anexo';
    const names = attachments.map(item => String(item?.name || 'Documento').trim() || 'Documento');
    return `${attachments.length} anexo(s): ${summarizeText(names.join(', '), 180)}`;
  }
  if (IMAGE_FIELDS.has(field)) {
    if (!value) return 'Sem imagem';
    return position === 'before' ? 'Imagem anterior' : 'Nova imagem';
  }
  if (MONEY_FIELDS.has(field)) return MONEY_FORMAT.format(Number(value || 0));
  if (DATE_FIELDS.has(field)) {
    const date = parseDate(value);
    return date ? DATE_FORMAT.format(date) : 'Não informado';
  }
  if (field === 'referenceMonth') return monthLabel(value) || 'Não informado';
  if (field === 'coveredMonths') {
    const values = Array.isArray(value) ? value : [];
    return values.length ? values.map(monthLabel).join(', ') : 'Nenhum mês';
  }
  if (field === 'memberIds') {
    const values = Array.isArray(value) ? value : [];
    return values.length
      ? values.map(id => lookups.members.get(String(id)) || 'Associado removido').join(', ')
      : 'Nenhum integrante';
  }
  if (field === 'participantIds') {
    const values = Array.isArray(value) ? value : [];
    return values.length
      ? values.map(id => lookups.members.get(String(id)) || 'Participante removido').join(', ')
      : 'Nenhum participante';
  }
  if (field === 'memberships') {
    const values = Array.isArray(value) ? value : [];
    const active = values.filter(item => !item?.endedMonth);
    return active.length
      ? `${active.length} participante(s) ativo(s): ${active.map(item => lookups.members.get(String(item?.memberId || '')) || 'Participante removido').join(', ')}`
      : 'Nenhum participante ativo';
  }
  if (field === 'events') {
    const values = Array.isArray(value) ? value : [];
    return values.length
      ? `${values.length} falecimento(s): ${values.map(item => `${item?.deceasedName || 'Sem nome'} (${item?.occurrenceDate || 'sem data'})`).join(', ')}`
      : 'Nenhum falecimento registrado';
  }
  if (field === 'memberId' || field === 'primaryMemberId') {
    return lookups.members.get(String(value || '')) || (value ? 'Associado removido' : 'Não informado');
  }
  if (field === 'accountId') {
    return lookups.accounts.get(String(value || '')) || (value ? 'Conta removida' : 'Não informado');
  }
  if (field === 'accessProfiles') {
    const configured = Boolean(value?.director?.passwordHash);
    const legacy = Boolean(value?.director?.fingerprint);
    return configured ? 'Senha da Diretoria configurada' : legacy ? 'Configuração antiga da Diretoria pendente de substituição' : 'Perfil Diretoria não configurado';
  }
  if (field === 'familyGroupId') {
    return lookups.groups.get(String(value || '')) || (value ? 'Grupo removido' : 'Sem grupo familiar');
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Nenhum';
  if (LONG_TEXT_FIELDS.has(field)) return summarizeText(value);
  if (value === '' || value == null) return 'Não informado';
  return summarizeText(value, 180);
}

function fieldChange(field, before, after, lookups) {
  return {
    field,
    label: FIELD_LABELS[field] || field,
    before: formatValue(field, before, lookups, 'before'),
    after: formatValue(field, after, lookups, 'after')
  };
}

function itemIdentity(item, index) {
  if (item && typeof item === 'object' && item.id) return String(item.id);
  return `index:${index}:${JSON.stringify(item)}`;
}

function buildCollectionChanges(definition, previousState, currentState, lookups) {
  const previousItems = Array.isArray(previousState?.[definition.key]) ? previousState[definition.key] : [];
  const currentItems = Array.isArray(currentState?.[definition.key]) ? currentState[definition.key] : [];
  const previousMap = new Map(previousItems.map((item, index) => [itemIdentity(item, index), item]));
  const currentMap = new Map(currentItems.map((item, index) => [itemIdentity(item, index), item]));
  const changes = [];

  for (const [id, item] of currentMap) {
    const previousItem = previousMap.get(id);
    if (!previousItem) {
      const fields = definition.fields
        .filter(field => item?.[field] !== undefined && item?.[field] !== '' && item?.[field] !== null)
        .map(field => fieldChange(field, undefined, item[field], lookups));
      changes.push({
        id,
        type: 'added',
        title: definition.itemTitle(item),
        description: `${definition.singular[0].toUpperCase()}${definition.singular.slice(1)} adicionado(a)`,
        fields
      });
      continue;
    }

    const fields = definition.fields
      .filter(field => !isEqual(previousItem?.[field], item?.[field]))
      .map(field => fieldChange(field, previousItem?.[field], item?.[field], lookups));

    if (fields.length) {
      changes.push({
        id,
        type: 'updated',
        title: definition.itemTitle(item),
        description: `${definition.singular[0].toUpperCase()}${definition.singular.slice(1)} atualizado(a)`,
        fields
      });
    }
  }

  for (const [id, item] of previousMap) {
    if (currentMap.has(id)) continue;
    const fields = definition.fields
      .filter(field => item?.[field] !== undefined && item?.[field] !== '' && item?.[field] !== null)
      .map(field => fieldChange(field, item[field], undefined, lookups));
    changes.push({
      id,
      type: 'removed',
      title: definition.itemTitle(item),
      description: `${definition.singular[0].toUpperCase()}${definition.singular.slice(1)} removido(a)`,
      fields
    });
  }

  return changes;
}

function buildCategoryChanges(previousState, currentState) {
  const previous = new Set(Array.isArray(previousState?.treasuryCategories) ? previousState.treasuryCategories : []);
  const current = new Set(Array.isArray(currentState?.treasuryCategories) ? currentState.treasuryCategories : []);
  const changes = [];

  for (const category of current) {
    if (!previous.has(category)) {
      changes.push({
        id: `added:${category}`,
        type: 'added',
        title: String(category),
        description: 'Categoria financeira adicionada',
        fields: []
      });
    }
  }
  for (const category of previous) {
    if (!current.has(category)) {
      changes.push({
        id: `removed:${category}`,
        type: 'removed',
        title: String(category),
        description: 'Categoria financeira removida',
        fields: []
      });
    }
  }

  return changes;
}

function buildSettingsChanges(previousState, currentState, lookups) {
  const before = previousState?.settings || {};
  const after = currentState?.settings || {};
  const fields = SETTINGS_FIELDS
    .filter(field => !isEqual(before[field], after[field]))
    .map(field => fieldChange(field, before[field], after[field], lookups));

  if (!fields.length) return [];
  return [{
    id: 'portal-settings',
    type: 'updated',
    title: 'Configurações do portal',
    description: 'Preferências gerais atualizadas',
    fields
  }];
}

export function buildPublicationReview(previousState, currentState) {
  const previous = clone(previousState) || {};
  const current = clone(currentState) || {};
  const lookups = buildLookups(previous, current);
  const groups = [];

  const settingsChanges = buildSettingsChanges(previous, current, lookups);
  if (settingsChanges.length) {
    groups.push({ key: 'settings', title: 'Configurações', icon: 'settings', changes: settingsChanges });
  }

  for (const definition of COLLECTIONS) {
    const changes = buildCollectionChanges(definition, previous, current, lookups);
    if (changes.length) groups.push({ ...definition, changes });
  }

  const categoryChanges = buildCategoryChanges(previous, current);
  if (categoryChanges.length) {
    groups.push({
      key: 'treasuryCategories',
      title: 'Categorias financeiras',
      icon: 'tag',
      changes: categoryChanges
    });
  }

  return {
    total: groups.reduce((sum, group) => sum + group.changes.length, 0),
    fieldsTotal: groups.reduce(
      (sum, group) => sum + group.changes.reduce((groupSum, change) => groupSum + change.fields.length, 0),
      0
    ),
    groups
  };
}
