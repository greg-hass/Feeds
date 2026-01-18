-- 001_initial_schema.sql
-- Baseline schema for Feeds v1.0

------------------------------------------------------------
-- USERS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    is_admin        INTEGER NOT NULL DEFAULT 0,
    settings_json   TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

------------------------------------------------------------
-- FOLDERS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT,
    UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id, deleted_at);

------------------------------------------------------------
-- FEEDS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feeds (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id       INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    
    type            TEXT NOT NULL CHECK(type IN ('rss', 'youtube', 'reddit', 'podcast')),
    title           TEXT NOT NULL,
    url             TEXT NOT NULL,
    site_url        TEXT,
    icon_url        TEXT,
    description     TEXT,
    
    refresh_interval_minutes INTEGER DEFAULT 30,
    last_fetched_at TEXT,
    next_fetch_at   TEXT,
    etag            TEXT,
    last_modified   TEXT,
    
    error_count     INTEGER DEFAULT 0,
    last_error      TEXT,
    last_error_at   TEXT,
    
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT,
    
    UNIQUE(user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_feeds_user ON feeds(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_feeds_folder ON feeds(folder_id);
CREATE INDEX IF NOT EXISTS idx_feeds_type ON feeds(user_id, type);
CREATE INDEX IF NOT EXISTS idx_feeds_next_fetch ON feeds(next_fetch_at) WHERE deleted_at IS NULL;

------------------------------------------------------------
-- ARTICLES
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id         INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    
    guid            TEXT NOT NULL,
    title           TEXT NOT NULL,
    url             TEXT,
    author          TEXT,
    summary         TEXT,
    content         TEXT,
    readability_content TEXT,
    
    enclosure_url   TEXT,
    enclosure_type  TEXT,
    enclosure_length INTEGER,
    duration_seconds INTEGER,
    thumbnail_url   TEXT,
    
    published_at    TEXT,
    fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    
    content_hash    TEXT,
    
    UNIQUE(feed_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_fetched ON articles(fetched_at DESC);

------------------------------------------------------------
-- READ STATE
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS read_state (
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id      INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    is_read         INTEGER NOT NULL DEFAULT 1,
    read_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_read_state_user ON read_state(user_id, updated_at);

------------------------------------------------------------
-- SYNC METADATA
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_cursors (
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL,
    last_sync_at    TEXT NOT NULL,
    cursor_data     TEXT,
    PRIMARY KEY (user_id, entity_type)
);

------------------------------------------------------------
-- FULL-TEXT SEARCH
------------------------------------------------------------
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
    title,
    author,
    summary,
    content,
    content='articles',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
    INSERT INTO articles_fts(rowid, title, author, summary, content)
    VALUES (NEW.id, NEW.title, NEW.author, NEW.summary, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
    INSERT INTO articles_fts(articles_fts, rowid, title, author, summary, content)
    VALUES ('delete', OLD.id, OLD.title, OLD.author, OLD.summary, OLD.content);
END;

CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
    INSERT INTO articles_fts(articles_fts, rowid, title, author, summary, content)
    VALUES ('delete', OLD.id, OLD.title, OLD.author, OLD.summary, OLD.content);
    INSERT INTO articles_fts(rowid, title, author, summary, content)
    VALUES (NEW.id, NEW.title, NEW.author, NEW.summary, NEW.content);
END;

------------------------------------------------------------
-- AI FEATURES: DIGESTS & DISCOVERY
------------------------------------------------------------

-- Store digest settings and generated digests
CREATE TABLE IF NOT EXISTS digests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    content         TEXT NOT NULL,  -- HTML/Markdown formatted summary
    article_count   INTEGER DEFAULT 0,
    feed_count      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS digest_settings (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled         INTEGER NOT NULL DEFAULT 1,
    schedule        TEXT DEFAULT '06:00',  -- Time to generate (HH:MM)
    included_feeds  TEXT,  -- JSON array of feed IDs, NULL = all
    style           TEXT DEFAULT 'bullets'  -- 'bullets' or 'paragraphs'
);

-- Store discovered feeds and recommendations
CREATE TABLE IF NOT EXISTS feed_recommendations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feed_url        TEXT NOT NULL,
    feed_type       TEXT NOT NULL,  -- 'rss', 'youtube', 'reddit', 'podcast'
    title           TEXT NOT NULL,
    description     TEXT,
    relevance_score REAL,  -- 0-100 from Gemini
    reason          TEXT,  -- "Based on your interest in..."
    metadata        TEXT,  -- JSON: subscriber count, last updated, etc.
    status          TEXT DEFAULT 'pending',  -- 'pending', 'subscribed', 'dismissed'
    discovered_at   TEXT NOT NULL DEFAULT (datetime('now')),
    shown_at        TEXT,
    UNIQUE(user_id, feed_url)
);

-- Track user interests (explicit and derived)
CREATE TABLE IF NOT EXISTS user_interests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic           TEXT NOT NULL,
    source          TEXT NOT NULL,  -- 'explicit', 'derived', 'content_analysis'
    confidence      REAL DEFAULT 1.0,  -- 0-1
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, topic)
);
