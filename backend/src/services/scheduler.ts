import { queryAll, run } from '../db/index.js';
import { refreshFeed, FeedToRefresh } from './feed-refresh.js';
import { FeedType } from './feed-parser.js';
import { getUserSettings, getUserSettingsRaw, updateUserSettingsRaw } from './settings.js';

interface Feed extends FeedToRefresh {
    title: string;
}

const CHECK_INTERVAL = 60 * 1000; // Check every minute
const FEED_DELAY = 500; // 0.5 second delay between batches
const BATCH_SIZE = 5;

// Circuit breaker configuration
const FAILURE_THRESHOLD = 3;
const MAX_BACKOFF = 5 * 60 * 1000; // 5 minutes
const BASE_BACKOFF = 1000; // 1 second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface SchedulerState {
    isRunning: boolean;
    consecutiveFailures: number;
    lastFailureTime: number;
    timeoutHandle: NodeJS.Timeout | null;
    isPaused: boolean;
}

let state: SchedulerState = {
    isRunning: false,
    consecutiveFailures: 0,
    lastFailureTime: 0,
    timeoutHandle: null,
    isPaused: false
};

export function startScheduler() {
    if (state.isRunning) return;
    state.isRunning = true;
    state.consecutiveFailures = 0;
    state.isPaused = false;
    console.log('Starting background feed scheduler...');

    // Schedule first run
    state.timeoutHandle = setTimeout(runSchedulerCycle, 5000);
}

export function stopScheduler() {
    state.isRunning = false;
    if (state.timeoutHandle) {
        clearTimeout(state.timeoutHandle);
        state.timeoutHandle = null;
    }
    state.isPaused = false;
    console.log('Stopped background feed scheduler');
}

function calculateBackoff(failures: number): number {
    return Math.min(BASE_BACKOFF * Math.pow(2, failures), MAX_BACKOFF);
}

async function runSchedulerCycle() {
    if (!state.isRunning || state.isPaused) return;

    try {
        console.log(`[Scheduler] Running cycle (failures: ${state.consecutiveFailures})`);
        await checkFeeds();
        
        // Reset failure count on success
        state.consecutiveFailures = 0;
        state.isPaused = false;
        
    } catch (err) {
        state.consecutiveFailures++;
        state.lastFailureTime = Date.now();
        
        console.error(`[Scheduler] Cycle ${state.consecutiveFailures} failed:`, err);
        
        // Circuit breaker: pause if too many failures
        if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
            state.isPaused = true;
            const backoff = calculateBackoff(state.consecutiveFailures);
            console.log(`[Scheduler] Circuit breaker activated. Pausing for ${Math.round(backoff / 1000)}s`);
            
            if (state.isRunning) {
                state.timeoutHandle = setTimeout(runSchedulerCycle, backoff);
                return;
            }
        }
    }
    
    // Schedule next cycle if not paused
    if (state.isRunning && !state.isPaused) {
        state.timeoutHandle = setTimeout(runSchedulerCycle, CHECK_INTERVAL);
    }
}

async function checkFeeds() {
    let feedsChecked = 0;
    let feedsRefreshed = 0;
    let feedsFailed = 0;
    let totalNewArticles = 0;

    try {
        const userId = 1;
        const settings = getUserSettings(userId);
        const rawSettings = getUserSettingsRaw(userId);
        const intervalMs = settings.refresh_interval_minutes * 60 * 1000;
        const nowMs = Date.now();

        const nextGlobal = rawSettings.global_next_refresh_at
            ? new Date(rawSettings.global_next_refresh_at as string).getTime()
            : null;

        if (nextGlobal && nowMs < nextGlobal) {
            return;
        }

        // Refresh all feeds together on the global schedule (excluding paused feeds)
        const feeds = queryAll<Feed>(
            `SELECT id, title, url, type, refresh_interval_minutes 
             FROM feeds 
             WHERE deleted_at IS NULL 
             AND paused_at IS NULL
             AND user_id = ?`,
            [userId]
        );

        if (feeds.length === 0) {
            const nextIso = new Date(nowMs + intervalMs).toISOString();
            updateUserSettingsRaw(userId, {
                global_last_refresh_at: new Date(nowMs).toISOString(),
                global_next_refresh_at: nextIso,
            });
            return;
        }

        console.log(`[Scheduler] Processing ${feeds.length} feeds on global refresh`);

        // Process in batches with timeout per batch
        for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
            const batch = feeds.slice(i, i + BATCH_SIZE);
            
            // Add timeout for batch processing
            const batchResults = await Promise.allSettled(
                batch.map(async (feed) => {
                    const feedStart = Date.now();
                    feedsChecked++;
                    
                    try {
                        // Add individual timeout for feed refresh
                        const result = await Promise.race([
                            refreshFeed(feed),
                            new Promise<never>((_, reject) => 
                                setTimeout(() => reject(new Error('Feed refresh timeout')), 120000) // 2 min timeout
                            )
                        ]);
                        
                        const feedTime = Date.now() - feedStart;
                        
                        if (result.success) {
                            feedsRefreshed++;
                            if (result.newArticles > 0) {
                                totalNewArticles += result.newArticles;
                                console.log(`[Scheduler] ✓ ${feed.title}: ${result.newArticles} new (${Math.round(feedTime/1000)}s)`);
                            }
                        } else {
                            feedsFailed++;
                            console.error(`[Scheduler] ✗ ${feed.title}: ${result.error}`);
                        }
                        
                        return result;
                        
                    } catch (err) {
                        feedsFailed++;
                        const feedTime = Date.now() - feedStart;
                        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                        console.error(`[Scheduler] ✗ ${feed.title}: ${errorMessage} (${Math.round(feedTime/1000)}s)`);
                        throw err;
                    }
                })
            );
            
            // Check if any promises rejected (for circuit breaker)
            const batchFailures = batchResults.filter(result => result.status === 'rejected').length;
            if (batchFailures > 0) {
                console.warn(`[Scheduler] Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batchFailures}/${batch.length} feeds failed`);
            }

            // Stagger batches to avoid 429 errors
            if (i + BATCH_SIZE < feeds.length) {
                await sleep(FEED_DELAY);
            }
        }
        
        // Log summary
        console.log(`[Scheduler] Batch complete: ${feedsRefreshed}/${feedsChecked} refreshed, ${totalNewArticles} new articles, ${feedsFailed} failed`);

        const nextGlobalIso = new Date(Date.now() + intervalMs).toISOString();
        updateUserSettingsRaw(userId, {
            global_last_refresh_at: new Date().toISOString(),
            global_next_refresh_at: nextGlobalIso,
        });

        run(
            `UPDATE feeds SET
                refresh_interval_minutes = ?,
                next_fetch_at = datetime('now', '+' || ? || ' minutes'),
                updated_at = datetime('now')
             WHERE user_id = ? AND deleted_at IS NULL`,
            [settings.refresh_interval_minutes, settings.refresh_interval_minutes, userId]
        );
        
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Scheduler] Critical error in checkFeeds: ${errorMessage}`);
        throw err; // Re-throw to trigger circuit breaker
    }
}
