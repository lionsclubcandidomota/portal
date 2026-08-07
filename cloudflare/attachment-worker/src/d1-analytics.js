const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPORT_TYPES = new Set(['movements', 'memberships', 'mutuals']);
const MAX_REPORT_ROWS = 5000;

function text(value) {
  return String(value ?? '');
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validDate(value) {
  const normalized = text(value).trim();
  return DATE_PATTERN.test(normalized) ? normalized : '';
}

function boundsFrom(input = {}) {
  const start = validDate(input.start);
  const end = validDate(input.end);
  if (start && end && end < start) {
    throw new Error('A data final deve ser igual ou posterior à data inicial.');
  }
  return { start, end };
}

function parseObjectPayload(value, label) {
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

function movementBoundsSql(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `(? = '' OR ${prefix}movement_date >= ?) AND (? = '' OR ${prefix}movement_date <= ?)`;
}

function bindBounds(statement, bounds) {
  return statement.bind(bounds.start, bounds.start, bounds.end, bounds.end);
}

export async function queryD1DashboardAnalytics(env, input = {}) {
  if (!env?.PORTAL_DB || typeof env.PORTAL_DB.prepare !== 'function') {
    throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  }
  const bounds = boundsFrom(input);
  const db = env.PORTAL_DB;
  const startedAt = Date.now();
  const aggregate = await bindBounds(db.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN entry_amount > 0 THEN 1 ELSE 0 END) AS entry_count,
      SUM(CASE WHEN exit_amount > 0 THEN 1 ELSE 0 END) AS exit_count,
      COALESCE(SUM(entry_amount), 0) AS entries_value,
      COALESCE(SUM(exit_amount), 0) AS exits_value,
      SUM(CASE WHEN LOWER(status) LIKE '%program%' THEN 1 ELSE 0 END) AS programmed_count,
      COALESCE(SUM(CASE WHEN LOWER(status) LIKE '%program%' THEN entry_amount ELSE 0 END), 0) AS programmed_entries,
      COALESCE(SUM(CASE WHEN LOWER(status) LIKE '%program%' THEN exit_amount ELSE 0 END), 0) AS programmed_exits,
      SUM(CASE WHEN LOWER(status) NOT LIKE '%program%' THEN 1 ELSE 0 END) AS realized_count,
      COALESCE(SUM(CASE WHEN LOWER(status) NOT LIKE '%program%' THEN entry_amount ELSE 0 END), 0) AS realized_entries,
      COALESCE(SUM(CASE WHEN LOWER(status) NOT LIKE '%program%' THEN exit_amount ELSE 0 END), 0) AS realized_exits
    FROM treasury_movements
    WHERE ${movementBoundsSql()}`), bounds).first() || {};

  const entriesValue = number(aggregate.entries_value);
  const exitsValue = number(aggregate.exits_value);
  const programmedEntries = number(aggregate.programmed_entries);
  const programmedExits = number(aggregate.programmed_exits);
  const realizedEntries = number(aggregate.realized_entries);
  const realizedExits = number(aggregate.realized_exits);

  return {
    source: 'd1',
    revision: await currentRevision(db),
    bounds,
    generatedAt: new Date().toISOString(),
    queryDurationMs: Math.max(0, Date.now() - startedAt),
    treasury: {
      total: number(aggregate.total),
      entryCount: number(aggregate.entry_count),
      exitCount: number(aggregate.exit_count),
      entriesValue,
      exitsValue,
      balance: entriesValue - exitsValue,
      maxValue: Math.max(entriesValue, exitsValue),
      programmed: {
        count: number(aggregate.programmed_count),
        entriesValue: programmedEntries,
        exitsValue: programmedExits,
        balance: programmedEntries - programmedExits
      },
      realized: {
        count: number(aggregate.realized_count),
        entriesValue: realizedEntries,
        exitsValue: realizedExits,
        balance: realizedEntries - realizedExits
      }
    }
  };
}

async function accountPayloads(db) {
  return (await rows(db.prepare('SELECT payload FROM treasury_accounts ORDER BY sort_order, name')))
    .map((row, index) => parseObjectPayload(row.payload, `conta ${index + 1}`));
}

async function familyGroupPayloads(db) {
  return (await rows(db.prepare('SELECT payload FROM family_groups ORDER BY sort_order, name')))
    .map((row, index) => parseObjectPayload(row.payload, `grupo familiar ${index + 1}`));
}

async function mutualGroupPayloads(db) {
  return (await rows(db.prepare('SELECT payload FROM mutual_groups ORDER BY sort_order, name')))
    .map((row, index) => parseObjectPayload(row.payload, `grupo de mútua ${index + 1}`));
}

async function movementPayloads(db, bounds) {
  const statement = bindBounds(db.prepare(`SELECT payload FROM treasury_movements
    WHERE ${movementBoundsSql()}
    ORDER BY movement_date, sort_order
    LIMIT ${MAX_REPORT_ROWS}`), bounds);
  return (await rows(statement)).map((row, index) => parseObjectPayload(row.payload, `movimentação ${index + 1}`));
}

async function membershipPayloads(db) {
  const statement = db.prepare(`SELECT payload FROM treasury_movements
    WHERE LOWER(category) LIKE '%mensal%'
    ORDER BY movement_date, sort_order
    LIMIT ${MAX_REPORT_ROWS}`);
  return (await rows(statement)).map((row, index) => parseObjectPayload(row.payload, `mensalidade ${index + 1}`));
}

async function mutualPaymentPayloads(db) {
  const statement = db.prepare(`SELECT payload FROM treasury_movements
    WHERE mutual_group_id <> '' OR mutual_event_id <> '' OR LOWER(category) LIKE '%mutua%' OR LOWER(category) LIKE '%mútua%'
    ORDER BY movement_date, sort_order
    LIMIT ${MAX_REPORT_ROWS}`);
  return (await rows(statement)).map((row, index) => parseObjectPayload(row.payload, `pagamento de mútua ${index + 1}`));
}

export async function queryD1ReportState(env, type, input = {}) {
  if (!env?.PORTAL_DB || typeof env.PORTAL_DB.prepare !== 'function') {
    throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  }
  const reportType = text(type).trim().toLowerCase();
  if (!REPORT_TYPES.has(reportType)) {
    throw new Response('Este relatório não possui uma consulta privada no D1.', { status: 404 });
  }
  const bounds = boundsFrom(input);
  const db = env.PORTAL_DB;
  const startedAt = Date.now();
  const patch = {
    treasuryAccounts: await accountPayloads(db),
    treasury: [],
    familyGroups: [],
    mutualGroups: []
  };

  if (reportType === 'movements') {
    patch.treasury = await movementPayloads(db, bounds);
  } else if (reportType === 'memberships') {
    patch.treasury = await membershipPayloads(db);
    patch.familyGroups = await familyGroupPayloads(db);
  } else if (reportType === 'mutuals') {
    patch.treasury = await mutualPaymentPayloads(db);
    patch.mutualGroups = await mutualGroupPayloads(db);
  }

  return {
    source: 'd1',
    type: reportType,
    revision: await currentRevision(db),
    bounds,
    generatedAt: new Date().toISOString(),
    queryDurationMs: Math.max(0, Date.now() - startedAt),
    counts: {
      treasury: patch.treasury.length,
      accounts: patch.treasuryAccounts.length,
      familyGroups: patch.familyGroups.length,
      mutualGroups: patch.mutualGroups.length
    },
    state: patch
  };
}
