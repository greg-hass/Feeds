-- 009_add_thumbnail_cache_columns.sql
-- Add cached thumbnail metadata to articles

ALTER TABLE articles ADD COLUMN thumbnail_cached_path TEXT;
ALTER TABLE articles ADD COLUMN thumbnail_cached_content_type TEXT;
