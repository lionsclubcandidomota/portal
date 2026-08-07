-- Portal v6.47.0 / Worker v1.13.0
-- Consolida todo o conteúdo estruturado público no D1.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portal_public_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS portal_public_events (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  event_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_portal_public_events_date
  ON portal_public_events(event_date DESC, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_portal_public_events_status_date
  ON portal_public_events(status, event_date DESC, sort_order);

CREATE TABLE IF NOT EXISTS portal_public_meetings (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  meeting_date TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_portal_public_meetings_date
  ON portal_public_meetings(meeting_date DESC, sort_order, id);

CREATE TABLE IF NOT EXISTS portal_public_notices (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_portal_public_notices_period
  ON portal_public_notices(start_date DESC, end_date, priority, sort_order);

CREATE TABLE IF NOT EXISTS portal_public_media (
  object_key TEXT PRIMARY KEY,
  public_path TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  checksum TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_portal_public_media_owner
  ON portal_public_media(kind, owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS portal_public_publications (
  revision TEXT PRIMARY KEY,
  previous_revision TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  schema_version INTEGER NOT NULL DEFAULT 1,
  member_count INTEGER NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  meeting_count INTEGER NOT NULL DEFAULT 0,
  notice_count INTEGER NOT NULL DEFAULT 0,
  media_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_public_publications_created
  ON portal_public_publications(created_at DESC);

INSERT OR IGNORE INTO portal_module_revisions (module, revision, updated_at, updated_by)
VALUES ('public', 0, '', '');

INSERT INTO portal_meta (key, value) VALUES
  ('schema_version', '9'),
  ('public_data_d1', '1'),
  ('public_revision', ''),
  ('public_updated_at', ''),
  ('public_updated_by', ''),
  ('public_schema_version', '11'),
  ('public_migration_complete', '0')
ON CONFLICT(key) DO UPDATE SET value = CASE
  WHEN excluded.key = 'schema_version' THEN excluded.value
  WHEN portal_meta.value = '' THEN excluded.value
  ELSE portal_meta.value
END;

PRAGMA optimize;
