CREATE TABLE IF NOT EXISTS runtime_state (
  id TEXT PRIMARY KEY,
  current_state TEXT NOT NULL,
  health TEXT NOT NULL,
  last_execution_started_at INTEGER,
  last_execution_finished_at INTEGER,
  next_execution_at INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  cooldown_until INTEGER,
  session_status TEXT,
  session_id TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_history (
  id TEXT PRIMARY KEY,
  run_type TEXT NOT NULL,
  state TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  duration_ms INTEGER,
  jobs_processed INTEGER NOT NULL DEFAULT 0,
  auto_applies INTEGER NOT NULL DEFAULT 0,
  reviews_created INTEGER NOT NULL DEFAULT 0,
  success_rate INTEGER,
  error_message TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS retry_history (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  error TEXT NOT NULL,
  backoff_ms INTEGER NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_metrics (
  id TEXT PRIMARY KEY,
  recorded_at INTEGER NOT NULL,
  jobs_per_day INTEGER NOT NULL DEFAULT 0,
  applies_per_day INTEGER NOT NULL DEFAULT 0,
  reviews_per_day INTEGER NOT NULL DEFAULT 0,
  apply_success_rate INTEGER NOT NULL DEFAULT 0,
  uptime_percent INTEGER NOT NULL DEFAULT 0,
  average_score INTEGER NOT NULL DEFAULT 0,
  average_duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
