-- Update existing digest_settings to enable digest by default
-- This migration fixes databases created before migration 005 was updated
UPDATE digest_settings SET enabled = 1 WHERE user_id = 1 AND enabled = 0;
