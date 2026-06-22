-- Add excluded companies column to search_filters
ALTER TABLE search_filters ADD COLUMN excluded_companies TEXT;
