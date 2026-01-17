import cron from 'node-cron';
import { queryOne, queryAll, run } from '../db/index.js';
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

        // Update feed metadata - use single quotes for 'now' in SQLite
        run(
            `UPDATE feeds SET 
        last_fetched_at = datetime('now'), 
        next_fetch_at = datetime('now', '+' || refresh_interval_minutes || ' minutes'),
        error_count = 0,
        last_error = NULL,
        updated_at = datetime('now')
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
        last_error_at = datetime('now'),
        next_fetch_at = datetime('now', '+' || (refresh_interval_minutes * 2) || ' minutes'),
        updated_at = datetime('now')
       WHERE id = ?`,
            [errorMessage, feed.id]
        );
    }
}

async function cleanupOldArticles(): Promise<void> {
    // 1. Get retention settings from the first user (admin)
    const user = queryOne<{ settings_json: string }>('SELECT settings_json FROM users LIMIT 1');
    let retentionDays = 90; // Default
    const hardLimitDays = 365; // Delete anything older than a year regardless of read state

    if (user?.settings_json) {
        try {
            const settings = JSON.parse(user.settings_json);
            if (typeof settings.retention_days === 'number') {
                retentionDays = settings.retention_days;
            }
        } catch (e) {
            console.error('Failed to parse user settings for cleanup:', e);
        }
    }

    console.log(`Starting cleanup: read retention = ${retentionDays} days, hard limit = ${hardLimitDays} days`);

    // 2. Delete old articles that have been read
    const readResult = run(
        `DELETE FROM articles
     WHERE id IN (
       SELECT a.id FROM articles a
       JOIN read_state rs ON rs.article_id = a.id AND rs.is_read = 1
       WHERE a.published_at < datetime('now', '-' || ? || ' days')
     )`,
        [retentionDays]
    );

    // 3. Delete very old articles regardless of read state
    const hardResult = run(
        `DELETE FROM articles
     WHERE published_at < datetime('now', '-' || ? || ' days')`,
        [hardLimitDays]
    );

    const totalChanges = readResult.changes + hardResult.changes;
    console.log(`Cleaned up ${totalChanges} old articles (${readResult.changes} read, ${hardResult.changes} hard limit)`);

    // 4. Clean up orphaned read states
    run(`DELETE FROM read_state WHERE article_id NOT IN (SELECT id FROM articles)`);

    // 5. Run VACUUM to reclaim space if significant deletions occurred
    if (totalChanges > 100) {
        console.log('Running VACUUM to reclaim space...');
        try {
            run('VACUUM');
        } catch (e) {
            console.error('VACUUM failed (likely lock issue):', e);
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
