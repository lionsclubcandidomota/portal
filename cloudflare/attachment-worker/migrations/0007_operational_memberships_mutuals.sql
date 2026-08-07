CREATE TABLE IF NOT EXISTS portal_members (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  member_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Ativo',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  mutual INTEGER NOT NULL DEFAULT 0 CHECK (mutual IN (0, 1)),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_portal_members_active_name
  ON portal_members(active, name, sort_order);
CREATE INDEX IF NOT EXISTS idx_portal_members_status_name
  ON portal_members(status, name, sort_order);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_membership_date
  ON treasury_movements(category, status, movement_date DESC, sort_order);
CREATE INDEX IF NOT EXISTS idx_mutual_events_operational
  ON mutual_events(group_id, death_date DESC, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_mutual_payments_operational
  ON treasury_movements(mutual_group_id, mutual_event_id, mutual_member_id, movement_date DESC);

INSERT INTO portal_meta(key, value) VALUES ('schema_version', '6')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta(key, value) VALUES ('operational_memberships', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta(key, value) VALUES ('operational_mutuals', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta(key, value) VALUES ('member_directory_updated_at', '')
  ON CONFLICT(key) DO NOTHING;

PRAGMA optimize;
