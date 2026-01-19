-- 008_add_icon_cache_columns.sql
-- Add dedicated columns for cached feed icons

ALTER TABLE feeds ADD COLUMN icon_cached_path TEXT;
ALTER TABLE feeds ADD COLUMN icon_cached_content_type TEXT;
