const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MEMBER_STATUSES = new Set(['all', 'paid', 'pending']);
const MUTUAL_STATUSES = new Set(['all', 'paid', 'pending']);
const DEFAULT_MEMBER_PAGE_SIZE = 12;
const DEFAULT_EVENT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;
const DIRECTORY_REFRESH_MS = 24 * 60 * 60 * 1000;

function text(value) { return String(value ?? ''); }
function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function integer(value, fallback = 1) {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function objectValue(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function arrayValue(value) { return Array.isArray(value) ? value : []; }
function normalize(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
function validMonth(value, fallback = '') {
  const normalized = text(value).trim();
  return MONTH_PATTERN.test(normalized) ? normalized : fallback;
}
function validDate(value) {
  const normalized = text(value).trim();
  return DATE_PATTERN.test(normalized) ? normalized : '';
}
function parsePayload(value, label) {
  try {
    const parsed = JSON.parse(text(value || '{}'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('payload inválido');
    return parsed;
  } catch {
    throw new Error(`O registro D1 de ${label} contém JSON inválido.`);
  }
}
async function rows(statement) {
  const result = await statement.all();
  return Array.isArray(result?.results) ? result.results : [];
}
async function currentRevision(db) {
  const row = await db.prepare("SELECT value FROM portal_meta WHERE key = 'revision'").first();
  return text(row?.value);
}
function monthRange(start, end) {
  const first = validMonth(start);
  const last = validMonth(end, first);
  if (!first) return [];
  if (last < first) throw new Error('O mês final deve ser igual ou posterior ao mês inicial.');
  const [startYear, startMonth] = first.split('-').map(Number);
  const [endYear, endMonth] = last.split('-').map(Number);
  const months = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    if (months.length > 60) throw new Error('O período de mensalidades excede 60 meses.');
  }
  return months;
}
function pageInfo(total, requestedPage, pageSize) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pages);
  return { total, page, pages, pageSize, offset: (page - 1) * pageSize };
}
function memberStatus(member = {}) {
  const status = normalize(member.status);
  if (['mutua', 'mutuario', 'mutuaria'].includes(status)) return 'Mútua';
  if (status === 'inativo' || member.active === false) return 'Inativo';
  return 'Ativo';
}
function publicStateFromPayload(payload) {
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload;
}
async function fetchPublicMembers(env) {
  if (!env.PUBLIC_DATA_URL) return [];
  const separator = text(env.PUBLIC_DATA_URL).includes('?') ? '&' : '?';
  const response = await fetch(`${env.PUBLIC_DATA_URL}${separator}ts=${Date.now()}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!response.ok) throw new Error(`Não foi possível atualizar o diretório de associados (${response.status}).`);
  const state = publicStateFromPayload(await response.json());
  return arrayValue(state?.birthdays);
}
export async function replaceMemberDirectory(env, members = []) {
  const db = env.PORTAL_DB;
  const normalizedMembers = arrayValue(members);
  if (!normalizedMembers.length) throw new Error('O diretório público de associados está vazio.');
  const now = new Date().toISOString();
  const statements = [db.prepare('DELETE FROM portal_members')];
  for (let offset = 0; offset < normalizedMembers.length; offset += 10) {
    const chunk = normalizedMembers.slice(offset, offset + 10);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
    const values = [];
    chunk.forEach((member, index) => {
      const status = memberStatus(member);
      values.push(
        text(member.id || `member-${offset + index}`),
        offset + index,
        text(member.name),
        text(member.memberNumber),
        status,
        status === 'Inativo' ? 0 : 1,
        status === 'Mútua' ? 1 : 0,
        JSON.stringify(objectValue(member)),
        now
      );
    });
    statements.push(db.prepare(`INSERT INTO portal_members
      (id, sort_order, name, member_number, status, active, mutual, payload, updated_at)
      VALUES ${placeholders}`).bind(...values));
  }
  statements.push(db.prepare(`INSERT INTO portal_meta(key, value) VALUES ('member_directory_updated_at', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(now));
  await db.batch(statements);
  return { refreshed: true, count: normalizedMembers.length, updatedAt: now };
}

async function syncMemberDirectory(env, { force = false } = {}) {
  const db = env.PORTAL_DB;
  const meta = await db.prepare("SELECT value FROM portal_meta WHERE key = 'member_directory_updated_at'").first();
  const countRow = await db.prepare('SELECT COUNT(*) AS total FROM portal_members').first();
  const updatedAt = Date.parse(text(meta?.value));
  const stale = !Number.isFinite(updatedAt) || Date.now() - updatedAt > DIRECTORY_REFRESH_MS;
  if (!force && number(countRow?.total) > 0 && !stale) return { refreshed: false, count: number(countRow?.total) };
  const members = await fetchPublicMembers(env);
  if (!members.length) {
    if (number(countRow?.total) > 0) return { refreshed: false, count: number(countRow?.total), warning: 'Diretório público vazio; preservado o cache anterior.' };
    throw new Error('O diretório público de associados está vazio.');
  }
  return replaceMemberDirectory(env, members);
}

function movementMemberIds(item) {
  const ids = arrayValue(item.memberIds).map(text).filter(Boolean);
  if (item.memberId) ids.push(text(item.memberId));
  return [...new Set(ids)];
}
function movementMonths(item) {
  const months = arrayValue(item.coveredMonths).map(value => validMonth(value)).filter(Boolean);
  if (months.length) return [...new Set(months)];
  const reference = validMonth(item.referenceMonth) || validMonth(text(item.date).slice(0, 7));
  return reference ? [reference] : [];
}
function allocationFor(item, memberId) {
  const stored = arrayValue(item.memberAllocations).find(allocation => text(allocation?.memberId) === text(memberId));
  if (stored && Number.isFinite(Number(stored.amount))) return number(stored.amount);
  const ids = movementMemberIds(item);
  return ids.includes(text(memberId)) ? number(item.entry) / Math.max(1, ids.length) : 0;
}

export async function queryD1OperationalMemberships(env, input = {}) {
  if (!env?.PORTAL_DB?.prepare) throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  const db = env.PORTAL_DB;
  const directory = await syncMemberDirectory(env);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const months = monthRange(input.start || currentMonth, input.end || input.start || currentMonth);
  const query = normalize(text(input.query).slice(0, 120));
  const requestedFamily = text(input.family || 'all');
  const requestedStatus = text(input.status || 'all').toLowerCase();
  const status = MEMBER_STATUSES.has(requestedStatus) ? requestedStatus : 'all';
  const pageSize = Math.min(MAX_PAGE_SIZE, integer(input.pageSize, DEFAULT_MEMBER_PAGE_SIZE));
  const startedAt = Date.now();

  const [memberRows, familyRows, familyMemberRows, paymentRows] = await Promise.all([
    rows(db.prepare('SELECT id, name, member_number, status, payload FROM portal_members WHERE active = 1 AND mutual = 0 ORDER BY name, sort_order, id')),
    rows(db.prepare('SELECT id, name, payload FROM family_groups ORDER BY sort_order, name, id')),
    rows(db.prepare('SELECT group_id, member_id FROM family_group_members ORDER BY group_id, sort_order, member_id')),
    rows(db.prepare(`SELECT payload FROM treasury_movements
      WHERE entry_amount > 0
        AND mutual_group_id = ''
        AND LOWER(status) NOT LIKE '%program%'
        AND (LOWER(category) LIKE '%mensal%' OR json_extract(payload, '$.memberId') IS NOT NULL)
        AND json_valid(payload)
        AND (
          EXISTS (SELECT 1 FROM json_each(payload, '$.coveredMonths') WHERE value >= ? AND value <= ?)
          OR substr(COALESCE(json_extract(payload, '$.referenceMonth'), movement_date), 1, 7) BETWEEN ? AND ?
        )
      ORDER BY movement_date, sort_order, id`).bind(months[0], months.at(-1), months[0], months.at(-1)))
  ]);

  const families = familyRows.map(row => parsePayload(row.payload, `grupo familiar ${row.id}`));
  const familyById = new Map(families.map(group => [text(group.id), group]));
  const familyByMember = new Map();
  familyMemberRows.forEach(row => {
    const group = familyById.get(text(row.group_id));
    if (group) familyByMember.set(text(row.member_id), group);
  });
  const payments = paymentRows.map((row, index) => parsePayload(row.payload, `mensalidade ${index + 1}`));
  const progressByMember = new Map(memberRows.map(row => [text(row.id), { paid: new Set(), total: 0 }]));
  payments.forEach(payment => {
    const covered = movementMonths(payment).filter(month => months.includes(month));
    if (!covered.length) return;
    movementMemberIds(payment).forEach(memberId => {
      const progress = progressByMember.get(memberId);
      if (!progress) return;
      covered.forEach(month => progress.paid.add(month));
      progress.total += allocationFor(payment, memberId) * (covered.length / Math.max(1, movementMonths(payment).length));
    });
  });

  const allItems = memberRows.map(row => {
    const member = parsePayload(row.payload, `associado ${row.id}`);
    const group = familyByMember.get(text(row.id)) || null;
    const progress = progressByMember.get(text(row.id)) || { paid: new Set(), total: 0 };
    const paidMonths = months.filter(month => progress.paid.has(month));
    const pendingMonths = months.filter(month => !progress.paid.has(month));
    return {
      member,
      group,
      paidMonths,
      pendingMonths,
      total: progress.total,
      paid: pendingMonths.length === 0,
      referenceMonth: pendingMonths[0] || months.at(-1)
    };
  });

  const filtered = allItems.filter(item => {
    const searchable = normalize(`${item.member?.name || ''} ${item.member?.memberNumber || ''} ${item.group?.name || ''}`);
    const matchesSearch = !query || searchable.includes(query);
    const groupId = text(item.group?.id || 'none');
    const matchesFamily = requestedFamily === 'all' || (requestedFamily === 'none' ? !item.group : groupId === requestedFamily);
    const matchesStatus = status === 'all' || (status === 'paid' ? item.paid : !item.paid);
    return matchesSearch && matchesFamily && matchesStatus;
  });
  const pagination = pageInfo(filtered.length, integer(input.page, 1), pageSize);
  const paidUnits = allItems.reduce((sum, item) => sum + item.paidMonths.length, 0);
  const totalReceived = allItems.reduce((sum, item) => sum + number(item.total), 0);

  return {
    source: 'd1-relational',
    revision: await currentRevision(db),
    generatedAt: new Date().toISOString(),
    queryDurationMs: Math.max(0, Date.now() - startedAt),
    directory,
    months,
    filters: { query: text(input.query), family: requestedFamily, status },
    families,
    summary: {
      members: allItems.length,
      expectedUnits: allItems.length * months.length,
      paidUnits,
      pendingUnits: Math.max(0, allItems.length * months.length - paidUnits),
      totalReceived
    },
    ...pagination,
    items: filtered.slice(pagination.offset, pagination.offset + pageSize)
  };
}

function latestPayment(items) {
  return [...items].sort((a, b) => text(b.paymentDate || b.date).localeCompare(text(a.paymentDate || a.date)))[0] || null;
}
export async function queryD1OperationalMutuals(env, input = {}) {
  if (!env?.PORTAL_DB?.prepare) throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  const db = env.PORTAL_DB;
  const directory = await syncMemberDirectory(env);
  const start = validDate(input.start);
  const end = validDate(input.end);
  if (start && end && end < start) throw new Error('A data final deve ser igual ou posterior à data inicial.');
  const requestedGroup = text(input.group || 'all');
  const query = normalize(text(input.query).slice(0, 120));
  const requestedStatus = text(input.status || 'pending').toLowerCase();
  const status = MUTUAL_STATUSES.has(requestedStatus) ? requestedStatus : 'pending';
  const pageSize = Math.min(20, integer(input.pageSize, DEFAULT_EVENT_PAGE_SIZE));
  const startedAt = Date.now();

  const [memberRows, groupRows, membershipRows, eventRows, participantRows, paymentRows] = await Promise.all([
    rows(db.prepare('SELECT id, payload FROM portal_members WHERE active = 1 ORDER BY name, sort_order, id')),
    rows(db.prepare('SELECT id, payload FROM mutual_groups ORDER BY sort_order, name, id')),
    rows(db.prepare('SELECT id, group_id, member_id, joined_date, ended_date, payload FROM mutual_memberships ORDER BY group_id, sort_order, id')),
    rows(db.prepare(`SELECT id, group_id, death_date, amount_per_participant, payload FROM mutual_events
      WHERE (? = 'all' OR group_id = ?)
        AND (? = '' OR death_date >= ?)
        AND (? = '' OR death_date <= ?)
      ORDER BY death_date DESC, sort_order DESC, id DESC`).bind(requestedGroup, requestedGroup, start, start, end, end)),
    rows(db.prepare('SELECT event_id, member_id FROM mutual_event_participants ORDER BY event_id, sort_order, member_id')),
    rows(db.prepare(`SELECT mutual_group_id, mutual_event_id, mutual_member_id, payload FROM treasury_movements
      WHERE entry_amount > 0 AND mutual_event_id <> '' AND LOWER(status) NOT LIKE '%program%'
      ORDER BY movement_date DESC, sort_order DESC, id DESC`))
  ]);

  const members = new Map(memberRows.map(row => [text(row.id), parsePayload(row.payload, `associado ${row.id}`)]));
  const groups = groupRows.map(row => parsePayload(row.payload, `grupo de mútua ${row.id}`));
  const groupById = new Map(groups.map(group => [text(group.id), group]));
  const membershipsByGroup = new Map();
  membershipRows.forEach(row => {
    if (!membershipsByGroup.has(text(row.group_id))) membershipsByGroup.set(text(row.group_id), []);
    membershipsByGroup.get(text(row.group_id)).push(parsePayload(row.payload, `vínculo ${row.id}`));
  });
  groups.forEach(group => { group.memberships = membershipsByGroup.get(text(group.id)) || []; group.events = []; });
  const participantsByEvent = new Map();
  participantRows.forEach(row => {
    if (!participantsByEvent.has(text(row.event_id))) participantsByEvent.set(text(row.event_id), []);
    participantsByEvent.get(text(row.event_id)).push(text(row.member_id));
  });
  const paymentsByCharge = new Map();
  paymentRows.forEach(row => {
    const key = `${text(row.mutual_group_id)}::${text(row.mutual_event_id)}::${text(row.mutual_member_id)}`;
    if (!paymentsByCharge.has(key)) paymentsByCharge.set(key, []);
    paymentsByCharge.get(key).push(parsePayload(row.payload, `pagamento ${key}`));
  });

  const allEvents = eventRows.map(row => {
    const event = parsePayload(row.payload, `evento ${row.id}`);
    event.participantIds = participantsByEvent.get(text(row.id)) || arrayValue(event.participantIds).map(text);
    const group = groupById.get(text(row.group_id));
    if (!group) return null;
    const amount = Math.max(0, number(event.amountPerParticipant || row.amount_per_participant));
    const charges = [...new Set(event.participantIds)].map(memberId => {
      const member = members.get(memberId) || { id: memberId, name: 'Associado não encontrado', memberNumber: '' };
      const key = `${group.id}::${event.id}::${memberId}`;
      const payment = latestPayment(paymentsByCharge.get(key) || []);
      const paid = Boolean(payment);
      const searchable = normalize(`${member.name || ''} ${member.memberNumber || ''} ${group.name || ''} ${event.deceasedName || ''} ${event.deceasedClub || ''} ${event.deathDate || ''}`);
      const visible = (!query || searchable.includes(query)) && (status === 'all' || (status === 'paid' ? paid : !paid));
      return { key, member, amount, displayAmount: paid ? number(payment?.entry || amount) : amount, payment, paid, visible };
    });
    const visibleCharges = charges.filter(charge => charge.visible);
    return {
      group,
      event,
      charges,
      visibleCharges,
      paidCharges: charges.filter(charge => charge.paid),
      pendingCharges: charges.filter(charge => !charge.paid),
      expectedTotal: charges.reduce((sum, charge) => sum + charge.amount, 0),
      receivedTotal: charges.filter(charge => charge.paid).reduce((sum, charge) => sum + charge.displayAmount, 0),
      matches: visibleCharges.length > 0
    };
  }).filter(Boolean).filter(item => item.matches);

  const pagination = pageInfo(allEvents.length, integer(input.page, 1), pageSize);
  const pageEvents = allEvents.slice(pagination.offset, pagination.offset + pageSize);
  const selectedGroupIds = new Set(pageEvents.map(item => text(item.group.id)));
  if (requestedGroup !== 'all' && groupById.has(requestedGroup)) selectedGroupIds.add(requestedGroup);
  if (requestedGroup === 'all' && pagination.page === 1) {
    const groupsWithEvents = new Set(allEvents.map(item => text(item.group.id)));
    groups.filter(group => !groupsWithEvents.has(text(group.id))).forEach(group => selectedGroupIds.add(text(group.id)));
  }
  const pageGroups = groups.filter(group => selectedGroupIds.has(text(group.id))).map(group => ({
    ...group,
    currentMembers: arrayValue(group.memberships)
      .filter(membership => !membership.endedDate)
      .map(membership => members.get(text(membership.memberId)))
      .filter(Boolean)
  }));
  const allCharges = allEvents.flatMap(item => item.charges);
  const visibleCharges = allEvents.flatMap(item => item.visibleCharges);
  const paidCharges = allCharges.filter(item => item.paid);
  const pendingCharges = allCharges.filter(item => !item.paid);

  return {
    source: 'd1-relational',
    revision: await currentRevision(db),
    generatedAt: new Date().toISOString(),
    queryDurationMs: Math.max(0, Date.now() - startedAt),
    directory,
    filters: { group: requestedGroup, start, end, query: text(input.query), status },
    groups,
    pageGroups,
    summary: {
      groups: groups.filter(group => !group.closedDate).length,
      events: allEvents.length,
      charges: allCharges.length,
      visibleCharges: visibleCharges.length,
      paid: paidCharges.length,
      pending: pendingCharges.length,
      expectedTotal: allCharges.reduce((sum, item) => sum + item.amount, 0),
      receivedTotal: paidCharges.reduce((sum, item) => sum + item.displayAmount, 0)
    },
    ...pagination,
    events: pageEvents
  };
}

export { syncMemberDirectory };
