PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portal_mutations (
  mutation_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  expected_revision TEXT NOT NULL,
  applied_revision TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  actor TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_mutations_created
  ON portal_mutations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_mutations_scope
  ON portal_mutations(scope, created_at DESC);

INSERT INTO portal_meta (key, value) VALUES ('treasury_granular_writes', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta (key, value) VALUES ('schema_version', '2')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
