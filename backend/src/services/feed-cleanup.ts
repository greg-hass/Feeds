import { run, queryAll } from '../db/index.js';
import { FeedType } from './feed-parser.js';
import { getUserSettings } from './settings.js';

/**
 * Cleanup old articles based on feed type fetch limits
 * This is called when settings change or periodically
 */
export async function cleanupOldArticles(userId: number = 1): Promise<{ deleted: number }> {
    const settings = getUserSettings(userId);
    const limits = settings.feed_fetch_limits;
    const now = new Date();
    let totalDeleted = 0;

    // Clean up RSS feeds - delete articles older than rss_days
    const rssCutoff = new Date(now.getTime() - limits.rss_days * 24 * 60 * 60 * 1000);
    const rssResult = run(
        `DELETE FROM articles 
         WHERE feed_id IN (
             SELECT id FROM feeds 
             WHERE type = 'rss' AND user_id = ? AND deleted_at IS NULL
         )
         AND is_bookmarked = 0
         AND published_at < ?`,
        [userId, rssCutoff.toISOString()]
    );
    totalDeleted += rssResult.changes;

    // Clean up Reddit feeds - delete articles older than reddit_days
    const redditCutoff = new Date(now.getTime() - limits.reddit_days * 24 * 60 * 60 * 1000);
    const redditResult = run(
        `DELETE FROM articles 
         WHERE feed_id IN (
             SELECT id FROM feeds 
             WHERE type = 'reddit' AND user_id = ? AND deleted_at IS NULL
         )
         AND is_bookmarked = 0
         AND published_at < ?`,
        [userId, redditCutoff.toISOString()]
    );
    totalDeleted += redditResult.changes;

    // Clean up YouTube feeds - delete articles older than youtube_days AND keep only youtube_count most recent
    const youtubeCutoff = new Date(now.getTime() - limits.youtube_days * 24 * 60 * 60 * 1000);
    
    // First, delete old YouTube articles
    const youtubeOldResult = run(
        `DELETE FROM articles 
         WHERE feed_id IN (
             SELECT id FROM feeds 
             WHERE type = 'youtube' AND user_id = ? AND deleted_at IS NULL
         )
         AND is_bookmarked = 0
         AND published_at < ?`,
        [userId, youtubeCutoff.toISOString()]
    );
    totalDeleted += youtubeOldResult.changes;

    // Then, for each YouTube feed, keep only youtube_count most recent articles
    const youtubeFeeds = queryAll<{ id: number }>(
        `SELECT id FROM feeds 
         WHERE type = 'youtube' AND user_id = ? AND deleted_at IS NULL`,
        [userId]
    );

    for (const feed of youtubeFeeds) {
        // Get article IDs to keep (most recent youtube_count non-bookmarked articles)
        const articlesToKeep = queryAll<{ id: number }>(
            `SELECT id FROM articles 
             WHERE feed_id = ? AND is_bookmarked = 0
             ORDER BY published_at DESC 
             LIMIT ?`,
            [feed.id, limits.youtube_count]
        );
        
        const keepIds = articlesToKeep.map(a => a.id);
        if (keepIds.length > 0) {
            const placeholders = keepIds.map(() => '?').join(',');
            const youtubeCountResult = run(
                `DELETE FROM articles 
                 WHERE feed_id = ? 
                 AND is_bookmarked = 0
                 AND id NOT IN (${placeholders})`,
                [feed.id, ...keepIds]
            );
            totalDeleted += youtubeCountResult.changes;
        }
    }

    // Clean up Podcast feeds - keep only podcast_count most recent episodes
    const podcastFeeds = queryAll<{ id: number }>(
        `SELECT id FROM feeds 
         WHERE type = 'podcast' AND user_id = ? AND deleted_at IS NULL`,
        [userId]
    );

    for (const feed of podcastFeeds) {
        // Get article IDs to keep (most recent podcast_count non-bookmarked episodes)
        const episodesToKeep = queryAll<{ id: number }>(
            `SELECT id FROM articles 
             WHERE feed_id = ? AND is_bookmarked = 0
             ORDER BY published_at DESC 
             LIMIT ?`,
            [feed.id, limits.podcast_count]
        );
        
        const keepIds = episodesToKeep.map(a => a.id);
        if (keepIds.length > 0) {
            const placeholders = keepIds.map(() => '?').join(',');
            const podcastResult = run(
                `DELETE FROM articles 
                 WHERE feed_id = ? 
                 AND is_bookmarked = 0
                 AND id NOT IN (${placeholders})`,
                [feed.id, ...keepIds]
            );
            totalDeleted += podcastResult.changes;
        }
    }

    if (totalDeleted > 0) {
        console.log(`[FeedCleanup] Deleted ${totalDeleted} old articles based on fetch limits`);
    }

    return { deleted: totalDeleted };
}