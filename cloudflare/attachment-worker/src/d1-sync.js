export const D1_SYNC_MODULES = Object.freeze([
  'reference',
  'groups',
  'treasury',
  'memberships',
  'mutuals',
  'member-directory'
]);

const MODULE_SET = new Set(D1_SYNC_MODULES);

function text(value) {
  return String(value ?? '');
}

function normalizedModules(modules) {
  return [...new Set((Array.isArray(modules) ? modules : [])
    .map(value => text(value).trim())
    .filter(value => MODULE_SET.has(value)))];
}

export function moduleRevisionStatement(db, modules, {
  updatedAt = '',
  updatedBy = '',
  guardRevision = ''
} = {}) {
  const values = normalizedModules(modules);
  if (!values.length) return null;
  const guard = text(guardRevision);
  return db.prepare(`INSERT INTO portal_module_revisions (module, revision, updated_at, updated_by)
    SELECT value, 1, ?, ? FROM json_each(?)
    WHERE (? = '' OR EXISTS (
      SELECT 1 FROM portal_meta WHERE key = 'revision' AND value = ?
    ))
    ON CONFLICT(module) DO UPDATE SET
      revision = portal_module_revisions.revision + 1,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by`)
    .bind(text(updatedAt), text(updatedBy), JSON.stringify(values), guard, guard);
}

export async function readD1ModuleRevisions(env) {
  if (!env?.PORTAL_DB?.prepare) {
    throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  }
  const db = env.PORTAL_DB;
  const result = await db.prepare(`SELECT module, revision, updated_at, updated_by
    FROM portal_module_revisions ORDER BY module`).all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  const modules = Object.fromEntries(D1_SYNC_MODULES.map(module => [module, {
    revision: 0,
    updatedAt: '',
    updatedBy: ''
  }]));
  rows.forEach(row => {
    const module = text(row.module);
    if (!MODULE_SET.has(module)) return;
    modules[module] = {
      revision: Math.max(0, Number(row.revision || 0)),
      updatedAt: text(row.updated_at),
      updatedBy: text(row.updated_by)
    };
  });
  const meta = await db.prepare(`SELECT
    (SELECT value FROM portal_meta WHERE key = 'revision') AS revision,
    (SELECT value FROM portal_meta WHERE key = 'updated_at') AS updated_at`).first();
  return {
    revision: text(meta?.revision),
    updatedAt: text(meta?.updated_at),
    generatedAt: new Date().toISOString(),
    modules
  };
}

function parsePayload(value, label) {
  try {
    const parsed = JSON.parse(text(value || 'null'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('payload inválido');
    return parsed;
  } catch {
    throw new Error(`O registro D1 de ${label} contém JSON inválido.`);
  }
}

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function moduleRevision(db, module) {
  const row = await db.prepare(`SELECT revision, updated_at, updated_by
    FROM portal_module_revisions WHERE module = ?`).bind(module).first();
  return {
    revision: Math.max(0, Number(row?.revision || 0)),
    updatedAt: text(row?.updated_at),
    updatedBy: text(row?.updated_by)
  };
}

export async function readD1ReferenceModule(env) {
  if (!env?.PORTAL_DB?.prepare) throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  const db = env.PORTAL_DB;
  const [settings, accountsResult, categoriesResult, revision] = await Promise.all([
    db.prepare('SELECT payload FROM portal_settings WHERE id = 1').first(),
    db.prepare('SELECT id, payload FROM treasury_accounts ORDER BY sort_order, name, id').all(),
    db.prepare('SELECT name FROM treasury_categories ORDER BY sort_order, name').all(),
    moduleRevision(db, 'reference')
  ]);
  return {
    source: 'd1-relational',
    module: 'reference',
    ...revision,
    state: {
      settings: settings?.payload ? parsePayload(settings.payload, 'configurações') : {},
      treasuryAccounts: rows(accountsResult).map(row => parsePayload(row.payload, `conta ${text(row.id)}`)),
      treasuryCategories: rows(categoriesResult).map(row => text(row.name))
    }
  };
}

export async function readD1GroupsModule(env) {
  if (!env?.PORTAL_DB?.prepare) throw new Error('O binding PORTAL_DB não está configurado no Worker.');
  const db = env.PORTAL_DB;
  const [familyResult, mutualResult, revision] = await Promise.all([
    db.prepare('SELECT id, payload FROM family_groups ORDER BY sort_order, name, id').all(),
    db.prepare('SELECT id, payload FROM mutual_groups ORDER BY sort_order, name, id').all(),
    moduleRevision(db, 'groups')
  ]);
  return {
    source: 'd1-relational',
    module: 'groups',
    ...revision,
    state: {
      familyGroups: rows(familyResult).map(row => parsePayload(row.payload, `grupo familiar ${text(row.id)}`)),
      mutualGroups: rows(mutualResult).map(row => parsePayload(row.payload, `grupo de mútua ${text(row.id)}`))
    }
  };
}
