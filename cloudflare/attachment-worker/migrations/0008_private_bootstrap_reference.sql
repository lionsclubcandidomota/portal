CREATE INDEX IF NOT EXISTS idx_treasury_movements_private_working_set
  ON treasury_movements(mutual_group_id, category, movement_date DESC, sort_order);

INSERT INTO portal_meta(key, value) VALUES ('schema_version', '7')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta(key, value) VALUES ('private_bootstrap_read_model', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
INSERT INTO portal_meta(key, value) VALUES ('reference_granular_writes', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;

PRAGMA optimize;
