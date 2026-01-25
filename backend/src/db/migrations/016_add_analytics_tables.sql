-- Migration 016: Add analytics tables
-- Ensures analytics tables exist even if earlier migration was skipped

-- ==========================================================================
-- READING ANALYTICS
-- ==========================================================================

CREATE TABLE IF NOT EXISTS reading_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER,
    scroll_depth_percent INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_article ON reading_sessions(article_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_date ON reading_sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_completed ON reading_sessions(user_id, completed);

CREATE TABLE IF NOT EXISTS article_stats (
    article_id INTEGER PRIMARY KEY,
    total_read_time_seconds INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    avg_scroll_depth INTEGER DEFAULT 0,
    completion_rate REAL DEFAULT 0,
    last_read_at TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feed_stats (
    feed_id INTEGER PRIMARY KEY,
    total_articles_read INTEGER DEFAULT 0,
    total_read_time_seconds INTEGER DEFAULT 0,
    avg_read_time_seconds INTEGER DEFAULT 0,
    engagement_score REAL DEFAULT 0,
    articles_completed INTEGER DEFAULT 0,
    last_engagement_at TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_reading_stats (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    articles_read INTEGER DEFAULT 0,
    total_read_time_seconds INTEGER DEFAULT 0,
    sessions_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_reading_stats_date ON daily_reading_stats(date DESC);

-- ==========================================================================
-- TRIGGERS FOR AUTO-AGGREGATION
-- ==========================================================================

CREATE TRIGGER IF NOT EXISTS update_article_stats_after_session
AFTER UPDATE OF ended_at ON reading_sessions
WHEN NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL
BEGIN
    INSERT INTO article_stats (article_id, total_read_time_seconds, read_count, avg_scroll_depth, last_read_at)
    VALUES (
        NEW.article_id,
        COALESCE(NEW.duration_seconds, 0),
        1,
        NEW.scroll_depth_percent,
        NEW.ended_at
    )
    ON CONFLICT(article_id) DO UPDATE SET
        total_read_time_seconds = total_read_time_seconds + COALESCE(NEW.duration_seconds, 0),
        read_count = read_count + 1,
        avg_scroll_depth = ((avg_scroll_depth * read_count) + NEW.scroll_depth_percent) / (read_count + 1),
        last_read_at = NEW.ended_at,
        updated_at = datetime('now');
END;

CREATE TRIGGER IF NOT EXISTS update_feed_stats_after_article_stats
AFTER INSERT ON article_stats
BEGIN
    INSERT INTO feed_stats (
        feed_id,
        total_articles_read,
        total_read_time_seconds,
        avg_read_time_seconds,
        last_engagement_at
    )
    SELECT
        a.feed_id,
        1,
        NEW.total_read_time_seconds,
        NEW.total_read_time_seconds,
        NEW.last_read_at
    FROM articles a
    WHERE a.id = NEW.article_id
    ON CONFLICT(feed_id) DO UPDATE SET
        total_articles_read = total_articles_read + 1,
        total_read_time_seconds = total_read_time_seconds + NEW.total_read_time_seconds,
        avg_read_time_seconds = total_read_time_seconds / total_articles_read,
        last_engagement_at = NEW.last_read_at,
        updated_at = datetime('now');
END;

CREATE TRIGGER IF NOT EXISTS update_daily_stats_after_session
AFTER UPDATE OF ended_at ON reading_sessions
WHEN NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL
BEGIN
    INSERT INTO daily_reading_stats (user_id, date, articles_read, total_read_time_seconds, sessions_count)
    VALUES (
        NEW.user_id,
        date(NEW.ended_at),
        1,
        COALESCE(NEW.duration_seconds, 0),
        1
    )
    ON CONFLICT(user_id, date) DO UPDATE SET
        articles_read = articles_read + 1,
        total_read_time_seconds = total_read_time_seconds + COALESCE(NEW.duration_seconds, 0),
        sessions_count = sessions_count + 1;
END;
