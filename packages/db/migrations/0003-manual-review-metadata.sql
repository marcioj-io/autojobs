ALTER TABLE manual_reviews ADD COLUMN review_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE manual_reviews ADD COLUMN review_notes TEXT;
ALTER TABLE manual_reviews ADD COLUMN reviewed_at INTEGER;
ALTER TABLE manual_reviews ADD COLUMN reviewed_by TEXT;
ALTER TABLE manual_reviews ADD COLUMN snoozed_until INTEGER;
