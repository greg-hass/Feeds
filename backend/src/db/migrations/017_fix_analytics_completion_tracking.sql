-- Migration 017: Fix analytics completion tracking
-- Fixes completion_rate never being updated in article_stats
-- Fixes articles_completed never being updated in feed_stats

-- ==========================================================================
-- ADD COMPLETED_COUNT COLUMN TO ARTICLE_STATS
-- ==========================================================================

-- Add completed_count column to track number of completed reading sessions
ALTER TABLE article_stats ADD COLUMN completed_count INTEGER DEFAULT 0;

-- ==========================================================================
-- DROP AND RECREATE TRIGGERS WITH COMPLETION TRACKING
-- ==========================================================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_article_stats_after_session;
DROP TRIGGER IF EXISTS update_feed_stats_after_article_stats;
DROP TRIGGER IF EXISTS update_feed_stats_on_article_update;

-- Recreate article stats trigger with completion_rate calculation
CREATE TRIGGER update_article_stats_after_session
AFTER UPDATE OF ended_at ON reading_sessions
WHEN NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL
BEGIN
    INSERT INTO article_stats (
        article_id,
        total_read_time_seconds,
        read_count,
        avg_scroll_depth,
        completed_count,
        completion_rate,
        last_read_at
    )
    VALUES (
        NEW.article_id,
        COALESCE(NEW.duration_seconds, 0),
        1,
        NEW.scroll_depth_percent,
        CASE WHEN NEW.completed = 1 THEN 1 ELSE 0 END,
        CASE WHEN NEW.completed = 1 THEN 1.0 ELSE 0.0 END,
        NEW.ended_at
    )
    ON CONFLICT(article_id) DO UPDATE SET
        total_read_time_seconds = total_read_time_seconds + COALESCE(NEW.duration_seconds, 0),
        read_count = read_count + 1,
        avg_scroll_depth = ((avg_scroll_depth * read_count) + NEW.scroll_depth_percent) / (read_count + 1),
        completed_count = completed_count + CASE WHEN NEW.completed = 1 THEN 1 ELSE 0 END,
        completion_rate = CAST(completed_count + CASE WHEN NEW.completed = 1 THEN 1 ELSE 0 END AS REAL) / (read_count + 1),
        last_read_at = NEW.ended_at,
        updated_at = datetime('now');
END;

-- Trigger to update feed stats when article_stats is first created (INSERT)
CREATE TRIGGER update_feed_stats_after_article_stats
AFTER INSERT ON article_stats
BEGIN
    INSERT INTO feed_stats (
        feed_id,
        total_articles_read,
        total_read_time_seconds,
        avg_read_time_seconds,
        articles_completed,
        last_engagement_at
    )
    SELECT
        a.feed_id,
        1,
        NEW.total_read_time_seconds,
        NEW.total_read_time_seconds,
        CASE WHEN NEW.completed_count > 0 THEN 1 ELSE 0 END,
        NEW.last_read_at
    FROM articles a
    WHERE a.id = NEW.article_id
    ON CONFLICT(feed_id) DO UPDATE SET
        total_articles_read = total_articles_read + 1,
        total_read_time_seconds = total_read_time_seconds + NEW.total_read_time_seconds,
        avg_read_time_seconds = total_read_time_seconds / total_articles_read,
        articles_completed = articles_completed + CASE WHEN NEW.completed_count > 0 THEN 1 ELSE 0 END,
        last_engagement_at = NEW.last_read_at,
        updated_at = datetime('now');
END;

-- Trigger to update feed stats when an article goes from not completed to completed
-- This fires when an existing article_stats row is updated and completion status changes
CREATE TRIGGER update_feed_stats_on_first_completion
AFTER UPDATE OF completed_count ON article_stats
WHEN OLD.completed_count = 0 AND NEW.completed_count > 0
BEGIN
    UPDATE feed_stats
    SET articles_completed = articles_completed + 1,
        updated_at = datetime('now')
    WHERE feed_id = (SELECT feed_id FROM articles WHERE id = NEW.article_id);
END;

-- ==========================================================================
-- RECALCULATE EXISTING DATA
-- ==========================================================================

-- Update completed_count for existing article_stats based on reading_sessions
UPDATE article_stats
SET completed_count = (
    SELECT COUNT(*)
    FROM reading_sessions rs
    WHERE rs.article_id = article_stats.article_id
      AND rs.completed = 1
      AND rs.ended_at IS NOT NULL
);

-- Recalculate completion_rate based on completed_count and read_count
UPDATE article_stats
SET completion_rate = CASE
    WHEN read_count > 0 THEN CAST(completed_count AS REAL) / read_count
    ELSE 0.0
END;

-- Update articles_completed in feed_stats
UPDATE feed_stats
SET articles_completed = (
    SELECT COUNT(DISTINCT ast.article_id)
    FROM article_stats ast
    JOIN articles a ON a.id = ast.article_id
    WHERE a.feed_id = feed_stats.feed_id
      AND ast.completed_count > 0
);
