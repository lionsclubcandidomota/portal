PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS portal_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'director')),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TEXT NOT NULL DEFAULT '',
  last_login_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_users_role_enabled
  ON portal_users(role, enabled, username);

CREATE TABLE IF NOT EXISTS portal_auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'director')),
  subject TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_portal_auth_sessions_active
  ON portal_auth_sessions(token_hash, expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS idx_portal_auth_sessions_user
  ON portal_auth_sessions(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS portal_auth_audit (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT NOT NULL DEFAULT '',
  event TEXT NOT NULL,
  outcome TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_auth_audit_created
  ON portal_auth_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_auth_audit_user
  ON portal_auth_audit(user_id, created_at DESC);

INSERT INTO portal_meta (key, value) VALUES ('auth_schema_version', '1')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
