-- 021_add_rate_limiting.sql
-- Persist rate limiting to database instead of in-memory

CREATE TABLE IF NOT EXISTS rate_limits (
    ip_address      TEXT PRIMARY KEY,
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    reset_at        TEXT NOT NULL,  -- ISO timestamp when window resets
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);
