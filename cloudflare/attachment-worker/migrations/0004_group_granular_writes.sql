PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_family_groups_sort
  ON family_groups(sort_order, name);
CREATE INDEX IF NOT EXISTS idx_family_group_members_group_sort
  ON family_group_members(group_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_mutual_memberships_active
  ON mutual_memberships(group_id, ended_date, sort_order);
CREATE INDEX IF NOT EXISTS idx_mutual_events_date
  ON mutual_events(death_date DESC, group_id);
CREATE INDEX IF NOT EXISTS idx_mutual_event_participants_event_sort
  ON mutual_event_participants(event_id, sort_order);

INSERT INTO portal_meta (key, value) VALUES ('groups_granular_writes', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta (key, value) VALUES ('schema_version', '3')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

PRAGMA optimize;
