-- Search filters table for managing job search criteria
CREATE TABLE IF NOT EXISTS search_filters (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  name TEXT NOT NULL,
  job_title TEXT,
  modalities TEXT NOT NULL DEFAULT 'Remoto,Híbrido,Presencial',
  cv_id TEXT,
  use_latest_cv INTEGER NOT NULL DEFAULT 1,
  posted_within_hours INTEGER NOT NULL DEFAULT 24,
  required_skills TEXT,
  excluded_skills TEXT,
  seniority TEXT NOT NULL DEFAULT 'junior,mid,senior',
  locations TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_search_filters_profile ON search_filters(profile);
CREATE INDEX idx_search_filters_active ON search_filters(is_active);
