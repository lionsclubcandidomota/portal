PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_treasury_movements_operational
  ON treasury_movements(movement_date DESC, status, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_type_status_date
  ON treasury_movements(entry_amount, exit_amount, status, movement_date DESC);

INSERT INTO portal_meta (key, value) VALUES ('relational_source', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta (key, value) VALUES ('operational_read_models', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta (key, value) VALUES ('snapshot_stale', '0')
  ON CONFLICT(key) DO NOTHING;
INSERT INTO portal_meta (key, value)
  SELECT 'snapshot_updated_at', COALESCE((SELECT updated_at FROM portal_state_snapshot WHERE id = 1), '')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta (key, value) VALUES ('schema_version', '5')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

PRAGMA optimize;
