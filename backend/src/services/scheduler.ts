import { queryAll } from '../db/index.js';
import { refreshFeed, FeedToRefresh } from './feed-refresh.js';
import { FeedType } from './feed-parser.js';

interface Feed extends FeedToRefresh {
    title: string;
}

const CHECK_INTERVAL = 60 * 1000; // Check every minute
const FEED_DELAY = 500; // 0.5 second delay between batches
const BATCH_SIZE = 5;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let isRunning = false;
let timeoutHandle: NodeJS.Timeout | null = null;

export function startScheduler() {
    if (isRunning) return;
    isRunning = true;
    console.log('Starting background feed scheduler...');

    // Schedule first run
    timeoutHandle = setTimeout(runSchedulerCycle, 5000);
}

export function stopScheduler() {
    isRunning = false;
    if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
    }
    console.log('Stopped background feed scheduler');
}

async function runSchedulerCycle() {
    if (!isRunning) return;

    await checkFeeds();

    if (isRunning) {
        timeoutHandle = setTimeout(runSchedulerCycle, CHECK_INTERVAL);
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

        for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
            const batch = feeds.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (feed) => {
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
            }));

            // Stagger batches to avoid 429 errors
            await sleep(FEED_DELAY);
        }
    } catch (err) {
        console.error('[Scheduler] Error checking feeds:', err);
    }
}
