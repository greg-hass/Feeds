-- 022_add_token_version.sql
-- Add token_version to users table for JWT invalidation on password change

ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
