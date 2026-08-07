const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FILTERS = new Set(['all', 'completed', 'scheduled', 'entries', 'exits']);
const DEFAULT_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 50;

function text(value) {
  return String(value ?? '');
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integer(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function parsePayload(value, label) {
  try {
    const parsed = JSON.parse(text(value || '{}'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('payload inválido');
    return parsed;
  } catch {
    throw new Error(`O registro D1 de ${label} contém JSON inválido.`);
  }
}

function filterSql(filter) {
  if (filter === 'completed') return "LOWER(status) NOT LIKE '%program%'";
  if (filter === 'scheduled') return "LOWER(status) LIKE '%program%'";
  if (filter === 'entries') return 'entry_amount > 0';
  if (filter === 'exits') return 'exit_amount > 0';
  return '1 = 1';
}

function baseWhere({ query }) {
  const clauses = [
    "(? = '' OR movement_date >= ?)",
    "(? = '' OR movement_date <= ?)"
  ];
  if (query) {
    clauses.push("(LOWER(payload) LIKE ? OR LOWER(category) LIKE ? OR LOWER(account_id) LIKE ?)");
  }
  return clauses.join(' AND ');
}

function baseBindings(bounds, query) {
  const bindings = [bounds.start, bounds.start, bounds.end, bounds.end];
  if (query) {
    const pattern = `%${query.toLocaleLowerCase('pt-BR')}%`;
    bindings.push(pattern, pattern, pattern);
  }
  return bindings;
}

async function first(db, sql, bindings = []) {
  return db.prepare(sql).bind(...bindings).first() || {};
}

async function rows(db, sql, bindings = []) {
  const result = await db.prepare(sql).bind(...bindings).all();
  return Array.isArray(result?.results) ? result.results : [];
}

function pageInfo(total, requestedPage, pageSize) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pages);
  return { total, page, pages, pageSize, offset: (page - 1) * pageSize };
}

function aggregateResult(row = {}) {
  const entries = number(row.entries_value);
  const exits = number(row.exits_value);
  return {
    count: number(row.total),
    entries,
    exits,
    result: entries - exits
  };
}

async function currentRevision(db) {
  const row = await db.prepare("SELECT value FROM portal_meta WHERE key = 'revision'").first();
  return text(row?.value);
}

export async function queryD1OperationalTreasury(env, input = {}) {
  if (!env?.PORTAL_DB || typeof env.PORTAL_DB.prepare !== 'function') {
    throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  }

  const db = env.PORTAL_DB;
  const bounds = boundsFrom(input);
  const query = text(input.query).trim().slice(0, 120);
  const requestedFilter = text(input.filter).trim().toLowerCase();
  const filter = FILTERS.has(requestedFilter) ? requestedFilter : 'all';
  const pageSize = Math.min(MAX_PAGE_SIZE, integer(input.pageSize, DEFAULT_PAGE_SIZE));
  const requestedScheduledPage = integer(input.scheduledPage, 1);
  const requestedCompletedPage = integer(input.completedPage, 1);
  const where = baseWhere({ query });
  const bindings = baseBindings(bounds, query);
  const selected = filterSql(filter);
  const startedAt = Date.now();

  const countsRow = await first(db, `SELECT
      COUNT(*) AS all_count,
      SUM(CASE WHEN LOWER(status) LIKE '%program%' THEN 1 ELSE 0 END) AS scheduled_count,
      SUM(CASE WHEN LOWER(status) NOT LIKE '%program%' THEN 1 ELSE 0 END) AS completed_count,
      SUM(CASE WHEN entry_amount > 0 THEN 1 ELSE 0 END) AS entries_count,
      SUM(CASE WHEN exit_amount > 0 THEN 1 ELSE 0 END) AS exits_count
    FROM treasury_movements
    WHERE ${where}`, bindings);

  const summaryStatus = filter === 'scheduled'
    ? "LOWER(status) LIKE '%program%'"
    : "LOWER(status) NOT LIKE '%program%'";
  const summaryRow = await first(db, `SELECT
      COUNT(*) AS total,
      COALESCE(SUM(entry_amount), 0) AS entries_value,
      COALESCE(SUM(exit_amount), 0) AS exits_value
    FROM treasury_movements
    WHERE ${where} AND (${selected}) AND (${summaryStatus})`, bindings);

  const scheduledCountRow = await first(db, `SELECT COUNT(*) AS total
    FROM treasury_movements
    WHERE ${where} AND (${selected}) AND LOWER(status) LIKE '%program%'`, bindings);
  const completedCountRow = await first(db, `SELECT COUNT(*) AS total
    FROM treasury_movements
    WHERE ${where} AND (${selected}) AND LOWER(status) NOT LIKE '%program%'`, bindings);

  const scheduledPage = pageInfo(number(scheduledCountRow.total), requestedScheduledPage, pageSize);
  const completedPage = pageInfo(number(completedCountRow.total), requestedCompletedPage, pageSize);

  const scheduledRows = scheduledPage.total
    ? await rows(db, `SELECT payload FROM treasury_movements
        WHERE ${where} AND (${selected}) AND LOWER(status) LIKE '%program%'
        ORDER BY movement_date ASC, sort_order ASC, id ASC
        LIMIT ? OFFSET ?`, [...bindings, pageSize, scheduledPage.offset])
    : [];
  const completedRows = completedPage.total
    ? await rows(db, `SELECT payload FROM treasury_movements
        WHERE ${where} AND (${selected}) AND LOWER(status) NOT LIKE '%program%'
        ORDER BY movement_date DESC, sort_order DESC, id DESC
        LIMIT ? OFFSET ?`, [...bindings, pageSize, completedPage.offset])
    : [];

  return {
    source: 'd1-relational',
    revision: await currentRevision(db),
    generatedAt: new Date().toISOString(),
    queryDurationMs: Math.max(0, Date.now() - startedAt),
    bounds,
    query,
    filter,
    counts: {
      all: number(countsRow.all_count),
      scheduled: number(countsRow.scheduled_count),
      completed: number(countsRow.completed_count),
      entries: number(countsRow.entries_count),
      exits: number(countsRow.exits_count)
    },
    summary: {
      mode: filter === 'scheduled' ? 'scheduled' : 'realized',
      ...aggregateResult(summaryRow)
    },
    scheduled: {
      ...scheduledPage,
      items: scheduledRows.map((row, index) => parsePayload(row.payload, `movimentação programada ${index + 1}`))
    },
    completed: {
      ...completedPage,
      items: completedRows.map((row, index) => parsePayload(row.payload, `movimentação realizada ${index + 1}`))
    }
  };
}
