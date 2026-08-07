PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_treasury_movements_category_status_date
  ON treasury_movements(category, status, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_date_amounts
  ON treasury_movements(movement_date DESC, entry_amount, exit_amount);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_mutual_date
  ON treasury_movements(mutual_group_id, mutual_event_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_mutual_events_date_group_amount
  ON mutual_events(death_date DESC, group_id, amount_per_participant);

INSERT INTO portal_meta (key, value) VALUES ('analytics_read_models', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta (key, value) VALUES ('schema_version', '4')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

PRAGMA optimize;
