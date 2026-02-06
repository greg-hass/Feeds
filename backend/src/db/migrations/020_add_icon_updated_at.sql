-- Add icon_updated_at to track explicit icon changes for stable caching
ALTER TABLE feeds ADD COLUMN icon_updated_at TEXT DEFAULT (datetime('now'));

-- Initialize it to created_at or now
UPDATE feeds SET icon_updated_at = updated_at;
