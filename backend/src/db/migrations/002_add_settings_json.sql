-- 002_add_settings_json.sql
-- Add settings_json column to users table for existing databases
-- This migration adds the column if it doesn't exist. If it does exist,
-- the migration runner will handle the "duplicate column" error gracefully.

ALTER TABLE users ADD COLUMN settings_json TEXT DEFAULT '{}';
