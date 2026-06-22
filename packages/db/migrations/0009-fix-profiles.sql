DROP TABLE IF EXISTS profiles;

CREATE TABLE profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT UNIQUE NOT NULL,
  searches TEXT NOT NULL,
  keywords TEXT NOT NULL,
  negative_keywords TEXT NOT NULL,
  min_score INTEGER NOT NULL,
  daily_limit INTEGER NOT NULL,
  seniority TEXT NOT NULL,
  stack_priority TEXT NOT NULL,
  cv TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);