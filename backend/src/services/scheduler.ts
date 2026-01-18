import { queryAll } from '../db/index.js';
import { refreshFeed, FeedToRefresh } from './feed-refresh.js';
import { FeedType } from './feed-parser.js';

interface Feed extends FeedToRefresh {
    title: string;
}

const CHECK_INTERVAL = 60 * 1000; // Check every minute

export function startScheduler() {
    console.log('Starting background feed scheduler...');

    // Initial check after 5 seconds
    setTimeout(checkFeeds, 5000);

    // Regular interval
    interval = setInterval(checkFeeds, CHECK_INTERVAL);
}

let interval: NodeJS.Timeout | null = null;

export function stopScheduler() {
    if (interval) {
        clearInterval(interval);
        interval = null;
        console.log('Stopped background feed scheduler');
    }
}

async function checkFeeds() {
    try {
        // Find feeds that are due for refresh
        // next_fetch_at is <= now OR next_fetch_at is NULL (run immediately)
        const feeds = queryAll<Feed>(
            `SELECT id, title, url, type, refresh_interval_minutes 
             FROM feeds 
             WHERE deleted_at IS NULL 
             AND (next_fetch_at <= datetime('now') OR next_fetch_at IS NULL)`
        );

        if (feeds.length === 0) {
            return;
        }

        console.log(`[Scheduler] Found ${feeds.length} feeds due for refresh`);

        // Process sequentially to be gentle on resources in background
        for (const feed of feeds) {
            try {
                const result = await refreshFeed(feed);
                if (result.success) {
                    if (result.newArticles > 0) {
                        console.log(`[Scheduler] Refreshed ${feed.title}: ${result.newArticles} new articles`);
                    }
                } else {
                    console.error(`[Scheduler] Failed to refresh ${feed.title}: ${result.error}`);
                }
            } catch (err) {
                console.error(`[Scheduler] Error refreshing ${feed.title}:`, err);
            }
        }
    } catch (err) {
        console.error('[Scheduler] Error checking feeds:', err);
    }
}
