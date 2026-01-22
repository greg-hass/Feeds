-- Add scheduled digest times and dismissal tracking

-- Add second schedule time and edition type to digests
ALTER TABLE digest_settings ADD COLUMN schedule_morning TEXT DEFAULT '08:00';
ALTER TABLE digest_settings ADD COLUMN schedule_evening TEXT DEFAULT '20:00';

-- Add edition type to digests (morning/evening) and dismissal tracking
ALTER TABLE digests ADD COLUMN edition TEXT DEFAULT 'morning'; -- 'morning' or 'evening'
ALTER TABLE digests ADD COLUMN title TEXT; -- Generated title for the digest
ALTER TABLE digests ADD COLUMN topics TEXT; -- JSON array of topic headers extracted

-- Track when user last dismissed a digest
ALTER TABLE digest_settings ADD COLUMN last_dismissed_digest_id INTEGER;
