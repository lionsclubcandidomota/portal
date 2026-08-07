PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portal_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_state_snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_extras (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS treasury_accounts (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_treasury_accounts_active
  ON treasury_accounts(active, sort_order);

CREATE TABLE IF NOT EXISTS treasury_categories (
  name TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS family_groups (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  primary_member_id TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family_group_members (
  group_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, member_id),
  FOREIGN KEY (group_id) REFERENCES family_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_family_group_members_member
  ON family_group_members(member_id);

CREATE TABLE IF NOT EXISTS mutual_groups (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  created_date TEXT NOT NULL DEFAULT '',
  closed_date TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mutual_groups_status
  ON mutual_groups(closed_date, sort_order);

CREATE TABLE IF NOT EXISTS mutual_memberships (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  member_id TEXT NOT NULL,
  joined_date TEXT NOT NULL DEFAULT '',
  ended_date TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  FOREIGN KEY (group_id) REFERENCES mutual_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mutual_memberships_group_member
  ON mutual_memberships(group_id, member_id, ended_date);

CREATE TABLE IF NOT EXISTS mutual_events (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deceased_name TEXT NOT NULL DEFAULT '',
  death_date TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  amount_per_participant REAL NOT NULL DEFAULT 0 CHECK (amount_per_participant >= 0),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  FOREIGN KEY (group_id) REFERENCES mutual_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mutual_events_group_date
  ON mutual_events(group_id, death_date DESC);

CREATE TABLE IF NOT EXISTS mutual_event_participants (
  event_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, member_id),
  FOREIGN KEY (event_id) REFERENCES mutual_events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mutual_event_participants_member
  ON mutual_event_participants(member_id);

CREATE TABLE IF NOT EXISTS treasury_movements (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  movement_date TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  entry_amount REAL NOT NULL DEFAULT 0 CHECK (entry_amount >= 0),
  exit_amount REAL NOT NULL DEFAULT 0 CHECK (exit_amount >= 0),
  mutual_group_id TEXT NOT NULL DEFAULT '',
  mutual_event_id TEXT NOT NULL DEFAULT '',
  mutual_member_id TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_treasury_movements_date
  ON treasury_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_status
  ON treasury_movements(status, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_account
  ON treasury_movements(account_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_category
  ON treasury_movements(category, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_mutual
  ON treasury_movements(mutual_group_id, mutual_event_id, mutual_member_id);

CREATE TABLE IF NOT EXISTS treasury_attachments (
  id TEXT PRIMARY KEY,
  movement_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  object_key TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  checksum TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  FOREIGN KEY (movement_id) REFERENCES treasury_movements(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_treasury_attachments_movement
  ON treasury_attachments(movement_id, sort_order);

INSERT INTO portal_meta (key, value) VALUES ('schema_version', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta (key, value) VALUES ('migration_complete', '0')
  ON CONFLICT(key) DO NOTHING;
