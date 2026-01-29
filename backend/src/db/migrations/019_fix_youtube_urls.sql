-- Migration: Fix YouTube article URLs
-- Problem: YouTube RSS feeds were storing feed URLs instead of watch URLs in the article.url field
-- Solution: Extract video ID from guid field and reconstruct proper watch URLs

-- Update YouTube articles to use proper watch URLs
-- The guid field contains "yt:video:VIDEO_ID" format
UPDATE articles 
SET url = 'https://www.youtube.com/watch?v=' || SUBSTR(guid, 11)  -- Extract video ID after "yt:video:"
WHERE feed_id IN (
    SELECT id FROM feeds WHERE type = 'youtube'
)
AND (
    -- Only update if URL is missing, empty, or contains feed URL
    url IS NULL 
    OR url = ''
    OR url LIKE '%youtube.com/feeds%'           -- Feed URL
    OR url LIKE '%youtube.com/channel%'         -- Channel URL
    OR url NOT LIKE '%watch?v=%'                -- Not a watch URL
)
AND guid LIKE 'yt:video:%';                     -- Has proper YouTube video GUID

-- Also fix any articles where guid might be in "video:VIDEO_ID" format (older feeds)
UPDATE articles 
SET url = 'https://www.youtube.com/watch?v=' || SUBSTR(guid, 7)   -- Extract video ID after "video:"
WHERE feed_id IN (
    SELECT id FROM feeds WHERE type = 'youtube'
)
AND (
    url IS NULL 
    OR url = ''
    OR url LIKE '%youtube.com/feeds%'
    OR url LIKE '%youtube.com/channel%'
    OR url NOT LIKE '%watch?v=%'
)
AND guid LIKE 'video:%'
AND guid NOT LIKE 'yt:video:%';                 -- Not already handled above
