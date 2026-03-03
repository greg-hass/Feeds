-- Create user_interests table
CREATE TABLE IF NOT EXISTS user_interests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    source TEXT NOT NULL, -- 'explicit', 'derived', 'content_analysis'
    confidence REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, topic)
);

-- Create feed_recommendations table
CREATE TABLE IF NOT EXISTS feed_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    feed_url TEXT NOT NULL,
    feed_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    relevance_score INTEGER DEFAULT 0,
    reason TEXT,
    metadata TEXT, -- JSON blob for thumbnails, etc.
    status TEXT DEFAULT 'pending', -- 'pending', 'subscribed', 'dismissed'
    discovered_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, feed_url)
);
