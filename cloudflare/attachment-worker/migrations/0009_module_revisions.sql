-- Portal v6.46.0 / Worker v1.12.0
-- Revisões por módulo para sincronização automática e atualização seletiva.

CREATE TABLE IF NOT EXISTS portal_module_revisions (
  module TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO portal_module_revisions (module, revision, updated_at, updated_by) VALUES
  ('reference', 0, '', ''),
  ('groups', 0, '', ''),
  ('treasury', 0, '', ''),
  ('memberships', 0, '', ''),
  ('mutuals', 0, '', ''),
  ('member-directory', 0, '', '');

INSERT INTO portal_meta (key, value) VALUES
  ('schema_version', '8'),
  ('module_revision_sync', '1'),
  ('automatic_refresh', '1')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

PRAGMA optimize;
