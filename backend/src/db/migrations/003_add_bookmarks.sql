-- Add bookmarks feature to articles
-- Note: Migration runner handles idempotent migrations gracefully

ALTER TABLE articles ADD COLUMN is_bookmarked INTEGER DEFAULT 0;

-- Create index for efficient bookmark queries
CREATE INDEX IF NOT EXISTS idx_articles_bookmarked ON articles(is_bookmarked) WHERE is_bookmarked = 1;
