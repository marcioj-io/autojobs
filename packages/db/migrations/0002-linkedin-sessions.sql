CREATE TABLE IF NOT EXISTS linkedin_sessions (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  cookies TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE jobs ADD COLUMN posted_at TEXT;
ALTER TABLE jobs ADD COLUMN description TEXT;
