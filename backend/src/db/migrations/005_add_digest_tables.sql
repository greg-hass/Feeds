-- Create digest_settings table
CREATE TABLE IF NOT EXISTS digest_settings (
    user_id INTEGER PRIMARY KEY,
    enabled BOOLEAN DEFAULT 1,
    schedule TEXT DEFAULT '06:00',
    included_feeds TEXT, -- JSON array of feed IDs
    style TEXT DEFAULT 'bullets', -- 'bullets' or 'paragraphs'
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Create initial settings for default user
-- Create initial settings for default user ONLY if user exists
INSERT OR IGNORE INTO digest_settings (user_id, enabled, style) 
SELECT 1, 1, 'bullets' 
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

-- Create digests table
CREATE TABLE IF NOT EXISTS digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    article_count INTEGER NOT NULL DEFAULT 0,
    feed_count INTEGER NOT NULL DEFAULT 0,
    generated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
);
