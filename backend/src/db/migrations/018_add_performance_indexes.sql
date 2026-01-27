-- 018_add_performance_indexes.sql
-- Additional indexes for query optimization based on common access patterns

-- Index for cleanup queries (finding old articles to delete)
CREATE INDEX IF NOT EXISTS idx_articles_cleanup 
ON articles(feed_id, published_at, is_bookmarked) 
WHERE is_bookmarked = 0 OR is_bookmarked IS NULL;

-- Index for bookmarked articles
CREATE INDEX IF NOT EXISTS idx_articles_bookmarked 
ON articles(feed_id, published_at DESC, is_bookmarked) 
WHERE is_bookmarked = 1;

-- Composite index for article listing by feed and published date
CREATE INDEX IF NOT EXISTS idx_articles_feed_published 
ON articles(feed_id, published_at DESC);

-- Index for recent articles (digest generation)
CREATE INDEX IF NOT EXISTS idx_articles_recent 
ON articles(published_at DESC);

-- Index for feed health monitoring
CREATE INDEX IF NOT EXISTS idx_feeds_health 
ON feeds(user_id, error_count, last_error_at) 
WHERE deleted_at IS NULL;

-- Index for folder organization
CREATE INDEX IF NOT EXISTS idx_folders_position 
ON folders(user_id, position) 
WHERE deleted_at IS NULL;

-- Analyze tables to update query planner statistics
ANALYZE;
