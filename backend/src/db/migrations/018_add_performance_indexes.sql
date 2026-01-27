-- 018_add_performance_indexes.sql
-- Additional indexes for query optimization based on common access patterns

-- Index for cleanup queries (finding old articles to delete)
CREATE INDEX IF NOT EXISTS idx_articles_cleanup 
ON articles(feed_id, published_at, is_bookmarked) 
WHERE is_bookmarked = 0 OR is_bookmarked IS NULL;

-- Index for unread article counts (used in sidebar)
CREATE INDEX IF NOT EXISTS idx_articles_unread 
ON articles(feed_id, is_read) 
WHERE is_read = 0 OR is_read IS NULL;

-- Composite index for article listing with filters
CREATE INDEX IF NOT EXISTS idx_articles_list 
ON articles(feed_id, published_at DESC, is_read);

-- Index for digest generation (finding recent unread articles)
CREATE INDEX IF NOT EXISTS idx_articles_digest 
ON articles(published_at DESC, is_read) 
WHERE is_read = 0;

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
