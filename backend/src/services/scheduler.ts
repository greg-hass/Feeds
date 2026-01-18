import cron from 'node-cron';
import { queryOne, queryAll, run } from '../db/index.js';
import { refreshFeed } from './feed-refresh.js';

interface FeedToRefresh {
    id: number;
    url: string;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
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
            await refreshFeedWrapper(feed);
        } catch (err) {
            console.error(`Failed to refresh feed ${feed.id}:`, err);
        }

        // Small delay between feeds to avoid hammering
        await sleep(1000);
    }
}

async function refreshFeedWrapper(feed: FeedToRefresh): Promise<void> {
    console.log(`Refreshing feed ${feed.id}: ${feed.url}`);

    const result = await refreshFeed({
        id: feed.id,
        url: feed.url,
        type: feed.type,
        refresh_interval_minutes: feed.refresh_interval_minutes,
    });

    if (result.success) {
        if (result.newArticles > 0) {
            console.log(`  Added ${result.newArticles} new articles`);
        }
    } else {
        console.error(`  Error: ${result.error}`);
    }
}

async function cleanupOldArticles(): Promise<void> {
    const hardLimitDays = 365; // Delete anything older than a year regardless of read state
    let totalChanges = 0;

    // Get all users with their settings
    const users = queryAll<{ id: number; settings_json: string }>('SELECT id, settings_json FROM users');

    console.log(`Starting cleanup for ${users.length} user(s), hard limit = ${hardLimitDays} days`);

    // Clean up articles for each user based on their retention settings
    for (const user of users) {
        let retentionDays = 90; // Default

        if (user.settings_json) {
            try {
                const settings = JSON.parse(user.settings_json);
                if (typeof settings.retention_days === 'number') {
                    retentionDays = settings.retention_days;
                }
            } catch (e) {
                console.error(`Failed to parse settings for user ${user.id}:`, e);
            }
        }

        // Delete old articles that have been read, for this user's feeds only
        const readResult = run(
            `DELETE FROM articles
         WHERE id IN (
           SELECT a.id FROM articles a
           JOIN feeds f ON f.id = a.feed_id
           LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
           WHERE f.user_id = ?
             AND (rs.is_read IS NULL OR rs.is_read = 1)
           AND a.published_at < datetime('now', '-' || ? || ' days')
         )`,
            [user.id, user.id, retentionDays]
        );

        // Delete very old articles for this user's feeds (hard limit)
        const hardResult = run(
            `DELETE FROM articles
         WHERE feed_id IN (SELECT id FROM feeds WHERE user_id = ?)
           AND published_at < datetime('now', '-' || ? || ' days')`,
            [user.id, hardLimitDays]
        );

        const userChanges = readResult.changes + hardResult.changes;
        totalChanges += userChanges;

        if (userChanges > 0) {
            console.log(`  User ${user.id}: cleaned ${userChanges} articles (retention: ${retentionDays}d)`);
        }
    }

    console.log(`Total cleaned up: ${totalChanges} old articles`);

    // Clean up orphaned read states
    const orphanCleanup = run(`DELETE FROM read_state WHERE article_id NOT IN (SELECT id FROM articles)`);
    if (orphanCleanup.changes > 0) {
        console.log(`Cleaned up ${orphanCleanup.changes} orphaned read states`);
    }

    // Run VACUUM to reclaim space if significant deletions occurred
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
