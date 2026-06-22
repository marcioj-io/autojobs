CREATE TABLE IF NOT EXISTS session_health (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  health_score INTEGER NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  last_validated_at INTEGER NOT NULL,
  cooldown_until INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS selector_failures (
  id TEXT PRIMARY KEY,
  selector_type TEXT NOT NULL,
  selector TEXT NOT NULL,
  page_url TEXT,
  error TEXT NOT NULL,
  metadata TEXT,
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS anomaly_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  severity TEXT NOT NULL,
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS screenshot_metadata (
  id TEXT PRIMARY KEY,
  context_type TEXT NOT NULL,
  context_id TEXT,
  path TEXT,
  metadata TEXT,
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
