import cron from 'node-cron';
import { queryAll, run } from '../db/index.js';
import { parseFeed, normalizeArticle, FeedType } from './feed-parser.js';

interface FeedToRefresh {
    id: number;
    url: string;
    type: FeedType;
    refresh_interval_minutes: number;
    etag: string | null;
    last_modified: string | null;
}

let refreshJob: cron.ScheduledTask | null = null;
let cleanupJob: cron.ScheduledTask | null = null;

export function startScheduler(): void {
    // Refresh feeds every 5 minutes
    refreshJob = cron.schedule('*/5 * * * *', () => {
        console.log('Running feed refresh job...');
        refreshDueFeeds().catch(console.error);
    });

    // Cleanup old articles daily at 3 AM
    cleanupJob = cron.schedule('0 3 * * *', () => {
        console.log('Running cleanup job...');
        cleanupOldArticles().catch(console.error);
    });

    // Run initial refresh after 10 seconds
    setTimeout(() => {
        refreshDueFeeds().catch(console.error);
    }, 10000);

    console.log('Scheduler started');
}

export function stopScheduler(): void {
    if (refreshJob) {
        refreshJob.stop();
        refreshJob = null;
    }
    if (cleanupJob) {
        cleanupJob.stop();
        cleanupJob = null;
    }
    console.log('Scheduler stopped');
}

async function refreshDueFeeds(): Promise<void> {
    const feeds = queryAll<FeedToRefresh>(
        `SELECT id, url, type, refresh_interval_minutes, etag, last_modified
     FROM feeds
     WHERE deleted_at IS NULL
       AND (next_fetch_at IS NULL OR next_fetch_at <= datetime('now'))
       AND error_count < 5
     ORDER BY next_fetch_at ASC
     LIMIT 10`
    );

    console.log(`Found ${feeds.length} feeds to refresh`);

    for (const feed of feeds) {
        try {
            await refreshFeed(feed);
        } catch (err) {
            console.error(`Failed to refresh feed ${feed.id}:`, err);
        }

        // Small delay between feeds to avoid hammering
        await sleep(1000);
    }
}

async function refreshFeed(feed: FeedToRefresh): Promise<void> {
    console.log(`Refreshing feed ${feed.id}: ${feed.url}`);

    try {
        const feedData = await parseFeed(feed.url);
        let newArticles = 0;

        const insertArticle = `
      INSERT OR IGNORE INTO articles 
      (feed_id, guid, title, url, author, summary, content, enclosure_url, enclosure_type, thumbnail_url, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        for (const article of feedData.articles) {
            const normalized = normalizeArticle(article, feed.type);
            const result = run(insertArticle, [
                feed.id,
                normalized.guid,
                normalized.title,
                normalized.url,
                normalized.author,
                normalized.summary,
                normalized.content,
                normalized.enclosure_url,
                normalized.enclosure_type,
                normalized.thumbnail_url,
                normalized.published_at,
            ]);
            if (result.changes > 0) newArticles++;
        }

        // Update feed metadata
        run(
            `UPDATE feeds SET 
        last_fetched_at = datetime("now"), 
        next_fetch_at = datetime("now", "+" || refresh_interval_minutes || " minutes"),
        error_count = 0,
        last_error = NULL,
        updated_at = datetime("now")
       WHERE id = ?`,
            [feed.id]
        );

        if (newArticles > 0) {
            console.log(`  Added ${newArticles} new articles`);
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`  Error: ${errorMessage}`);

        run(
            `UPDATE feeds SET 
        error_count = error_count + 1,
        last_error = ?,
        last_error_at = datetime("now"),
        next_fetch_at = datetime("now", "+" || (refresh_interval_minutes * 2) || " minutes"),
        updated_at = datetime("now")
       WHERE id = ?`,
            [errorMessage, feed.id]
        );
    }
}

async function cleanupOldArticles(): Promise<void> {
    // Get default retention from settings (or use 90 days)
    const retentionDays = 90;

    // Delete old articles that have been read
    const result = run(
        `DELETE FROM articles
     WHERE id IN (
       SELECT a.id FROM articles a
       JOIN read_state rs ON rs.article_id = a.id AND rs.is_read = 1
       WHERE a.published_at < datetime('now', '-' || ? || ' days')
     )`,
        [retentionDays]
    );

    console.log(`Cleaned up ${result.changes} old articles`);

    // Also clean up orphaned read states
    run(`DELETE FROM read_state WHERE article_id NOT IN (SELECT id FROM articles)`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
