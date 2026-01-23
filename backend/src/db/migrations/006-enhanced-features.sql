-- Migration 006: Enhanced Features
-- Adds support for analytics, automation rules, advanced search, reader enhancements
-- Created: 2026-01-23

-- ============================================================================
-- READING ANALYTICS
-- ============================================================================

-- Track individual reading sessions
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

-- Aggregate article statistics
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

-- Feed engagement metrics
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

-- Daily reading aggregates for charts
CREATE TABLE IF NOT EXISTS daily_reading_stats (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD format
    articles_read INTEGER DEFAULT 0,
    total_read_time_seconds INTEGER DEFAULT 0,
    sessions_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_reading_stats_date ON daily_reading_stats(date DESC);

-- ============================================================================
-- AUTOMATION RULES ENGINE
-- ============================================================================

-- User-defined automation rules
CREATE TABLE IF NOT EXISTS automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT 1,
    trigger_type TEXT NOT NULL, -- 'new_article', 'keyword_match', 'feed_match', 'author_match'
    conditions TEXT NOT NULL, -- JSON: [{field, operator, value}]
    actions TEXT NOT NULL, -- JSON: [{type, params}]
    priority INTEGER DEFAULT 0, -- Higher priority runs first
    match_count INTEGER DEFAULT 0, -- Statistics
    last_matched_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_user_enabled ON automation_rules(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON automation_rules(priority DESC);

-- Track rule executions for debugging
CREATE TABLE IF NOT EXISTS rule_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    executed_at TEXT DEFAULT (datetime('now')),
    success BOOLEAN DEFAULT 1,
    actions_taken TEXT, -- JSON array of executed actions
    error_message TEXT,
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rule_executions_rule ON rule_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_executions_article ON rule_executions(article_id);
CREATE INDEX IF NOT EXISTS idx_rule_executions_date ON rule_executions(executed_at DESC);

-- ============================================================================
-- ADVANCED SEARCH
-- ============================================================================

-- Saved searches
CREATE TABLE IF NOT EXISTS saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    filters TEXT, -- JSON: {date_range, authors, feeds, types, tags}
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    use_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_last_used ON saved_searches(last_used_at DESC);

-- Search history for auto-suggestions
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    query TEXT NOT NULL,
    filters TEXT, -- JSON
    results_count INTEGER,
    searched_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_search_history_user_date ON search_history(user_id, searched_at DESC);

-- ============================================================================
-- READER ENHANCEMENTS
-- ============================================================================

-- Text highlights and annotations
CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    text_content TEXT NOT NULL,
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    color TEXT DEFAULT '#ffeb3b', -- Yellow default
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_highlights_article ON highlights(article_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_created ON highlights(created_at DESC);

-- Reading progress tracking
CREATE TABLE IF NOT EXISTS reading_progress (
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    scroll_position INTEGER DEFAULT 0,
    progress_percent INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, article_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_updated ON reading_progress(updated_at DESC);

-- ============================================================================
-- ARTICLE TAGS
-- ============================================================================

-- Manual and automated tags
CREATE TABLE IF NOT EXISTS article_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    source TEXT DEFAULT 'manual', -- 'manual', 'rule', 'ai'
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_article_tags_article ON article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag);
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_tags_unique ON article_tags(article_id, tag);

-- ============================================================================
-- KEYBOARD SHORTCUTS
-- ============================================================================

-- User-customizable keyboard shortcuts
CREATE TABLE IF NOT EXISTS keyboard_shortcuts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'next_article', 'mark_read', 'bookmark', etc.
    key_combo TEXT NOT NULL, -- 'j', 'ctrl+k', 'g h', etc.
    enabled BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_keyboard_shortcuts_user ON keyboard_shortcuts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_keyboard_shortcuts_user_action ON keyboard_shortcuts(user_id, action);

-- ============================================================================
-- NAVIGATION HISTORY
-- ============================================================================

-- Track navigation for breadcrumbs
CREATE TABLE IF NOT EXISTS navigation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    path TEXT NOT NULL, -- '/(app)/article/123'
    title TEXT, -- Article/page title
    visited_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_navigation_history_user_date ON navigation_history(user_id, visited_at DESC);

-- ============================================================================
-- TRIGGERS FOR AUTO-AGGREGATION
-- ============================================================================

-- Auto-update article stats when reading session ends
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

-- Auto-update feed stats when article stats change
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

-- Auto-update daily stats when reading session ends
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

-- Auto-increment rule match count
CREATE TRIGGER IF NOT EXISTS increment_rule_match_count
AFTER INSERT ON rule_executions
WHEN NEW.success = 1
BEGIN
    UPDATE automation_rules
    SET match_count = match_count + 1,
        last_matched_at = NEW.executed_at
    WHERE id = NEW.rule_id;
END;

-- Auto-increment saved search use count
CREATE TRIGGER IF NOT EXISTS increment_search_use_count
AFTER UPDATE OF last_used_at ON saved_searches
BEGIN
    UPDATE saved_searches
    SET use_count = use_count + 1
    WHERE id = NEW.id;
END;
