CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  score INTEGER NOT NULL,
  status TEXT NOT NULL,
  location TEXT NOT NULL,
  modality TEXT NOT NULL,
  easy_apply INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL,
  profile TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  apply_result TEXT
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manual_reviews (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  profile TEXT NOT NULL,
  review_status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  min_score INTEGER NOT NULL,
  max_daily_applications INTEGER NOT NULL,
  auto_apply INTEGER NOT NULL,
  preferred_location TEXT NOT NULL,
  blacklist TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
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
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000), -- timestamp em ms
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);