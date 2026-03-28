-- Migration 022: Bookmark organization
-- Adds bookmark folders and archive metadata while preserving the existing
-- article-level is_bookmarked flag for compatibility.

CREATE TABLE IF NOT EXISTS bookmark_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS bookmark_items (
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    folder_id INTEGER,
    archived_at TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, article_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES bookmark_folders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmark_items_user_archived
    ON bookmark_items(user_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_bookmark_items_user_folder
    ON bookmark_items(user_id, folder_id);

CREATE INDEX IF NOT EXISTS idx_bookmark_items_article
    ON bookmark_items(article_id);
