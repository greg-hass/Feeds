-- Performance optimization indexes
-- Created: 2026-01-22
-- Purpose: Add missing indexes for common query patterns identified in performance analysis

-- 1. Composite index for articles joined with read_state on common filter patterns
-- Helps with: "Get all unread articles for a feed" queries
CREATE INDEX IF NOT EXISTS idx_articles_feed_published
ON articles(feed_id, published_at DESC);

-- 2. Reverse lookup index for read_state (article_id first, then user_id)
-- Helps with: Bulk read status checks like WHERE article_id IN (...)
CREATE INDEX IF NOT EXISTS idx_read_state_article
ON read_state(article_id, user_id);

-- 3. Index for filtering paused feeds with user
-- Helps with: Scheduler queries that filter by (user_id, paused_at IS NULL, deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_feeds_user_paused
ON feeds(user_id, paused_at, deleted_at)
WHERE deleted_at IS NULL;

-- 4. Index for feed type filtering (used in smart folders)
-- Helps with: GROUP BY f.type queries for smart folder counts
CREATE INDEX IF NOT EXISTS idx_feeds_type_user
ON feeds(type, user_id, deleted_at)
WHERE deleted_at IS NULL;

-- 5. Index for articles by fetch time (helps with "recently fetched" queries)
-- Helps with: Finding newest articles across all feeds
CREATE INDEX IF NOT EXISTS idx_articles_fetched_at
ON articles(fetched_at DESC);
