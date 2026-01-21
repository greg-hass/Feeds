-- 010_add_feed_paused.sql
-- Add paused_at column to feeds table for feed pausing feature

ALTER TABLE feeds ADD COLUMN paused_at TEXT DEFAULT NULL;

-- Index for efficient filtering of paused feeds in scheduler
CREATE INDEX IF NOT EXISTS idx_feeds_paused ON feeds(paused_at) WHERE deleted_at IS NULL;
