import { queryAll, queryOne, run } from '../db/index.js';
import { refreshFeed, FeedToRefresh } from './feed-refresh.js';
import { FeedType } from './feed-parser.js';
import { getUserSettings, getUserSettingsRaw, updateUserSettingsRaw } from './settings.js';
import { generateDailyDigest, getCurrentEdition, DigestEdition } from './digest.js';
import { emitRefreshEvent, RefreshFeedUpdate, RefreshStats } from './refresh-events.js';
import { existsSync } from 'node:fs';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { getCacheDir } from './image-cache.js';

interface Feed extends FeedToRefresh {
    title: string;
}

// Scheduler timing configuration
// These values balance responsiveness with resource usage and external API limits
const CHECK_INTERVAL = 60 * 1000; // 1 minute - frequent enough for responsive UI updates without excessive DB polling
const FEED_DELAY = 100; // 100ms between batches - reduces network spikes and prevents overwhelming external servers
const BATCH_SIZE = 5; // Max 5 concurrent feeds - reduces SQLite contention and prevents crashes
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours - daily cleanup is sufficient for maintenance tasks
const DIGEST_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes - checks digest schedule without missing hourly boundaries
const THUMBNAIL_RETENTION_DAYS = 7; // Keep thumbnails for 1 week - balances storage vs re-fetch needs
const MS_PER_DAY = 24 * 60 * 60 * 1000; // Milliseconds per day - utility constant for date calculations

// Circuit breaker configuration
const FAILURE_THRESHOLD = 3;
const MAX_BACKOFF = 5 * 60 * 1000; // 5 minutes
const BASE_BACKOFF = 1000; // 1 second

// Memory safety limits
const MEMORY_WARNING_MB = 400; // Log warning at 400MB
const MEMORY_CRITICAL_MB = 512; // Pause scheduler at 512MB to prevent crash

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface SchedulerState {
    isRunning: boolean;
    consecutiveFailures: number;
    lastFailureTime: number;
    timeoutHandle: NodeJS.Timeout | null;
    cleanupTimeoutHandle: NodeJS.Timeout | null;
    digestTimeoutHandle: NodeJS.Timeout | null;
    isPaused: boolean;
    isProcessing: boolean;
    lastCleanupAt: number;
    lastDigestCheck: number;
}

let state: SchedulerState = {
    isRunning: false,
    consecutiveFailures: 0,
    lastFailureTime: 0,
    timeoutHandle: null,
    cleanupTimeoutHandle: null,
    digestTimeoutHandle: null,
    isPaused: false,
    isProcessing: false,
    lastCleanupAt: 0,
    lastDigestCheck: 0
};

export function isRefreshing() {
    return state.isProcessing;
}

export function startScheduler() {
    if (state.isRunning) return;
    state.isRunning = true;
    state.consecutiveFailures = 0;
    state.isPaused = false;
    console.log('Starting background feed scheduler...');

    // Schedule first run
    state.timeoutHandle = setTimeout(runSchedulerCycle, 5000);

    // Schedule cleanup to run shortly after startup, then daily
    state.cleanupTimeoutHandle = setTimeout(runCleanupCycle, 60000);

    // Schedule digest check to run after startup, then every 5 minutes
    state.digestTimeoutHandle = setTimeout(runDigestCycle, 30000);
}

export function stopScheduler() {
    state.isRunning = false;
    if (state.timeoutHandle) {
        clearTimeout(state.timeoutHandle);
        state.timeoutHandle = null;
    }
    if (state.cleanupTimeoutHandle) {
        clearTimeout(state.cleanupTimeoutHandle);
        state.cleanupTimeoutHandle = null;
    }
    if (state.digestTimeoutHandle) {
        clearTimeout(state.digestTimeoutHandle);
        state.digestTimeoutHandle = null;
    }
    state.isPaused = false;
    console.log('Stopped background feed scheduler');
}

function calculateBackoff(failures: number): number {
    return Math.min(BASE_BACKOFF * Math.pow(2, failures), MAX_BACKOFF);
}

function checkMemoryUsage(): { ok: boolean; warning: boolean; usedMB: number } {
    const memUsage = process.memoryUsage();
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    return {
        ok: usedMB < MEMORY_CRITICAL_MB,
        warning: usedMB > MEMORY_WARNING_MB,
        usedMB,
    };
}

async function runSchedulerCycle() {
    if (!state.isRunning || state.isPaused) return;
    
    // Memory safety check - pause if critically high
    const memCheck = checkMemoryUsage();
    if (!memCheck.ok) {
        console.error(`[Scheduler] CRITICAL: Memory usage at ${memCheck.usedMB}MB, pausing scheduler`);
        state.isPaused = true;
        // Try again in 1 minute after GC has had time to run
        state.timeoutHandle = setTimeout(() => {
            state.isPaused = false;
            if (state.isRunning) {
                state.timeoutHandle = setTimeout(runSchedulerCycle, 5000);
            }
        }, 60000);
        return;
    }
    if (memCheck.warning) {
        console.warn(`[Scheduler] WARNING: Memory usage at ${memCheck.usedMB}MB`);
    }
    
    // Prevent concurrent refresh cycles
    if (state.isProcessing) {
        console.log('[Scheduler] Previous cycle still running, skipping this cycle');
        // Reschedule for next interval
        if (state.isRunning && !state.isPaused) {
            state.timeoutHandle = setTimeout(runSchedulerCycle, CHECK_INTERVAL);
        }
        return;
    }

    try {
        console.log(`[Scheduler] Running cycle (failures: ${state.consecutiveFailures})`);
        await checkFeeds();
        
        // Check if still running after async operation
        if (!state.isRunning) return;
        
        // Reset failure count on success
        state.consecutiveFailures = 0;
        state.isPaused = false;
        
    } catch (err) {
        // Check if still running before updating state
        if (!state.isRunning) return;
        
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
    
    // Schedule next cycle if not paused and still running
    if (state.isRunning && !state.isPaused) {
        state.timeoutHandle = setTimeout(runSchedulerCycle, CHECK_INTERVAL);
    }
}

async function checkFeeds() {
    let feedsChecked = 0;
    let feedsRefreshed = 0;
    let feedsFailed = 0;
    let totalNewArticles = 0;
    const stats: RefreshStats = {
        success: 0,
        errors: 0,
        failed_feeds: [],
    };

    // Set a global timeout for the entire refresh cycle (10 minutes max)
    const cycleTimeoutMs = 10 * 60 * 1000;
    const cycleStartTime = Date.now();
    
    try {
        state.isProcessing = true;
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
        emitRefreshEvent({ type: 'start', total_feeds: feeds.length });

        const toRefreshFeedUpdate = (feed: {
            id: number;
            title: string;
            type: FeedType;
            icon_url: string | null;
            icon_cached_path: string | null;
            updated_at?: string;
            icon_updated_at?: string;
        }): RefreshFeedUpdate => {
            let iconUrl = feed.icon_url;
            if (feed.icon_cached_path) {
                iconUrl = `/api/v1/icons/${feed.id}`;
            }
            return {
                id: feed.id,
                title: feed.title,
                icon_url: iconUrl,
                type: feed.type,
            };
        };

        // Process in batches with timeout per batch
        for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
            // Check global timeout
            if (Date.now() - cycleStartTime > cycleTimeoutMs) {
                console.error(`[Scheduler] Refresh cycle exceeded ${cycleTimeoutMs/60000} minute limit, aborting`);
                break;
            }
            
            const batch = feeds.slice(i, i + BATCH_SIZE);
            
            // Add timeout for batch processing
            const batchResults = await Promise.allSettled(
                batch.map(async (feed) => {
                    const feedStart = Date.now();
                    feedsChecked++;
                    emitRefreshEvent({ type: 'feed_refreshing', id: feed.id, title: feed.title });
                    
                    try {
                        // Add individual timeout for feed refresh with proper cleanup
                        const timeoutMs = 30000;
                        let timeoutId: NodeJS.Timeout;
                        
                        const timeoutPromise = new Promise<never>((_, reject) => {
                            timeoutId = setTimeout(() => reject(new Error('Feed refresh timeout')), timeoutMs);
                        });
                        
                        const refreshPromise = refreshFeed(feed);
                        
                        const result = await Promise.race([refreshPromise, timeoutPromise]);
                        clearTimeout(timeoutId!); // Clean up timer to prevent memory leak
                        
                        const feedTime = Date.now() - feedStart;
                        
                        if (result.success) {
                            const updatedFeed = queryOne<{
                                id: number;
                                title: string;
                                type: FeedType;
                                icon_url: string | null;
                                icon_cached_path: string | null;
                                updated_at: string;
                                icon_updated_at: string;
                            }>(
                                'SELECT id, title, type, icon_url, icon_cached_path, updated_at, icon_updated_at FROM feeds WHERE id = ?',
                                [feed.id]
                            );
                            feedsRefreshed++;
                            if (result.newArticles > 0) {
                                totalNewArticles += result.newArticles;
                                console.log(`[Scheduler] ✓ ${feed.title}: ${result.newArticles} new (${Math.round(feedTime/1000)}s)`);
                            }
                            stats.success++;
                            emitRefreshEvent({
                                type: 'feed_complete',
                                id: feed.id,
                                title: updatedFeed?.title ?? feed.title,
                                new_articles: result.newArticles,
                                next_fetch_at: result.next_fetch_at,
                                feed: updatedFeed ? toRefreshFeedUpdate(updatedFeed) : undefined,
                            });
                        } else {
                            feedsFailed++;
                            console.error(`[Scheduler] ✗ ${feed.title}: ${result.error}`);
                            stats.errors++;
                            stats.failed_feeds.push({
                                id: feed.id,
                                title: feed.title,
                                error: result.error || 'Unknown error',
                            });
                            emitRefreshEvent({
                                type: 'feed_error',
                                id: feed.id,
                                title: feed.title,
                                error: result.error || 'Unknown error',
                            });
                        }
                        
                        return result;
                        
                    } catch (err) {
                        feedsFailed++;
                        const feedTime = Date.now() - feedStart;
                        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                        console.error(`[Scheduler] ✗ ${feed.title}: ${errorMessage} (${Math.round(feedTime/1000)}s)`);
                        stats.errors++;
                        stats.failed_feeds.push({
                            id: feed.id,
                            title: feed.title,
                            error: errorMessage,
                        });
                        emitRefreshEvent({
                            type: 'feed_error',
                            id: feed.id,
                            title: feed.title,
                            error: errorMessage,
                        });
                        // Don't re-throw - we already tracked the error, let Promise.allSettled handle it
                        return { success: false, newArticles: 0, error: errorMessage };
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
        emitRefreshEvent({ type: 'complete', stats });

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
    } finally {
        state.isProcessing = false;
    }
}

/**
 * Cleanup cycle - runs daily to delete old articles based on retention_days setting.
 * IMPORTANT: Bookmarked articles are NEVER deleted, regardless of age.
 * Uses batch processing to avoid long-running transactions.
 */
async function runCleanupCycle() {
    if (!state.isRunning) return;

    try {
        const userId = 1;
        const settings = getUserSettings(userId);
        const retentionDays = settings.retention_days;
        const BATCH_SIZE = 1000; // Process in batches to avoid locking

        console.log(`[Cleanup] Starting cleanup cycle (retention: ${retentionDays} days)`);

        let totalDeleted = 0;
        let batchDeleted = 0;
        let batchCount = 0;

        // Process deletions in batches to avoid long-running transactions
        do {
            // Get batch of old article IDs to delete
            const articlesToDelete = queryAll<{ id: number }>(
                `SELECT a.id FROM articles a
                 JOIN feeds f ON a.feed_id = f.id
                 WHERE f.user_id = ?
                 AND a.published_at < datetime('now', '-' || ? || ' days')
                 AND (a.is_bookmarked = 0 OR a.is_bookmarked IS NULL)
                 LIMIT ?`,
                [userId, retentionDays, BATCH_SIZE]
            );

            if (articlesToDelete.length === 0) break;

            // Delete this batch
            const ids = articlesToDelete.map(a => a.id);
            const placeholders = ids.map(() => '?').join(',');
            
            const result = run(
                `DELETE FROM articles WHERE id IN (${placeholders})`,
                ids
            );

            batchDeleted = result.changes;
            totalDeleted += batchDeleted;
            batchCount++;

            // Small delay between batches to allow other operations
            if (batchDeleted === BATCH_SIZE) {
                await sleep(100);
            }

        } while (batchDeleted === BATCH_SIZE && state.isRunning);

        if (totalDeleted > 0) {
            console.log(`[Cleanup] Deleted ${totalDeleted} old articles in ${batchCount} batches (older than ${retentionDays} days)`);
            
            // Run OPTIMIZE after significant deletions to help query planner
            if (totalDeleted > 10000) {
                console.log('[Cleanup] Running ANALYZE after large deletion...');
                run('ANALYZE articles');
            }
        } else {
            console.log(`[Cleanup] No articles to clean up`);
        }

        const thumbnailResult = await cleanupThumbnailCache(THUMBNAIL_RETENTION_DAYS);
        if (thumbnailResult.deletedCount > 0) {
            console.log(`[Cleanup] Deleted ${thumbnailResult.deletedCount} cached thumbnails (${formatBytes(thumbnailResult.reclaimedBytes)})`);
        } else if (thumbnailResult.scanned > 0) {
            console.log('[Cleanup] No cached thumbnails to delete');
        }

        state.lastCleanupAt = Date.now();

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Cleanup] Error during cleanup: ${errorMessage}`);
    }

    // Schedule next cleanup cycle
    if (state.isRunning) {
        state.cleanupTimeoutHandle = setTimeout(runCleanupCycle, CLEANUP_INTERVAL);
    }
}

function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const order = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, order);
    return `${value.toFixed(order === 0 ? 0 : 1)} ${units[order]}`;
}

async function cleanupThumbnailCache(retentionDays: number) {
    const thumbnailsDir = getCacheDir('thumbnails');
    if (!existsSync(thumbnailsDir)) {
        return { deletedCount: 0, reclaimedBytes: 0, scanned: 0 };
    }

    const cutoff = Date.now() - retentionDays * MS_PER_DAY;
    let deletedCount = 0;
    let reclaimedBytes = 0;
    let scanned = 0;
    let skippedActive = 0;

    try {
        // Get list of active thumbnail filenames from database
        const activeThumbnails = new Set(
            queryAll<{ thumbnail_cached_path: string }>(
                `SELECT thumbnail_cached_path FROM articles 
                 WHERE thumbnail_cached_path IS NOT NULL 
                 AND published_at > datetime('now', '-30 days')`
            ).map(a => a.thumbnail_cached_path.split('/').pop())
        );

        const entries = await readdir(thumbnailsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            scanned += 1;
            const filePath = join(thumbnailsDir, entry.name);
            try {
                const fileStat = await stat(filePath);
                // Skip files that are still referenced by recent articles
                if (activeThumbnails.has(entry.name)) {
                    skippedActive++;
                    continue;
                }
                if (fileStat.mtimeMs <= cutoff) {
                    await unlink(filePath);
                    deletedCount += 1;
                    reclaimedBytes += fileStat.size;
                }
            } catch (err) {
                console.warn(`[Cleanup] Failed to delete thumbnail ${entry.name}:`, err);
            }
        }

        if (skippedActive > 0) {
            console.log(`[Cleanup] Skipped ${skippedActive} active thumbnails`);
        }
    } catch (err) {
        console.warn('[Cleanup] Failed to scan thumbnail cache:', err);
    }

    return { deletedCount, reclaimedBytes, scanned };
}

/**
 * Digest cycle - checks if it's time to generate morning or evening digest
 * Morning: 08:00 (or user-configured)
 * Evening: 20:00 (or user-configured)
 */
async function runDigestCycle() {
    if (!state.isRunning) return;

    try {
        const userId = 1;
        
        // Get digest settings
        const settings = queryOne<{
            enabled: number;
            schedule_morning: string | null;
            schedule_evening: string | null;
        }>('SELECT enabled, schedule_morning, schedule_evening FROM digest_settings WHERE user_id = ?', [userId]);

        if (!settings || !settings.enabled) {
            // Reschedule and return
            if (state.isRunning) {
                state.digestTimeoutHandle = setTimeout(runDigestCycle, DIGEST_CHECK_INTERVAL);
            }
            return;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentMinutes = currentHour * 60 + currentMinute;
        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

        // Parse schedule times (default to 08:00 and 20:00)
        const morningTime = settings.schedule_morning || '08:00';
        const eveningTime = settings.schedule_evening || '20:00';

        const parseScheduleMinutes = (scheduleTime: string): number | null => {
            const [schedHour, schedMin] = scheduleTime.split(':').map(Number);
            if (Number.isNaN(schedHour) || Number.isNaN(schedMin)) return null;
            return schedHour * 60 + schedMin;
        };

        const morningMinutes = parseScheduleMinutes(morningTime);
        const eveningMinutes = parseScheduleMinutes(eveningTime);

        const shouldRunMorning =
            morningMinutes !== null &&
            currentMinutes >= morningMinutes &&
            (eveningMinutes === null || currentMinutes < eveningMinutes);

        const shouldRunEvening =
            eveningMinutes !== null &&
            currentMinutes >= eveningMinutes;

        const tryGenerate = async (edition: DigestEdition) => {
            const today = new Date().toISOString().split('T')[0];
            const existingDigest = queryOne<{ id: number }>(
                `SELECT id FROM digests 
                 WHERE user_id = ? AND edition = ? AND date(generated_at) = ?`,
                [userId, edition, today]
            );
            if (existingDigest) {
                return;
            }

            console.log(`[Digest] Scheduled ${edition} digest generation at ${currentTimeStr}`);
            const result = await generateDailyDigest(userId, edition);

            if (result.success) {
                console.log(`[Digest] ${edition} digest generated successfully (ID: ${result.digestId})`);
            } else if (result.error !== 'No new articles to summarize') {
                console.error(`[Digest] Failed to generate ${edition} digest: ${result.error}`);
            }
        };

        if (shouldRunMorning) {
            await tryGenerate('morning');
        } else if (shouldRunEvening) {
            await tryGenerate('evening');
        }

        state.lastDigestCheck = Date.now();

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Digest] Error during digest cycle: ${errorMessage}`);
    }

    // Schedule next digest check
    if (state.isRunning) {
        state.digestTimeoutHandle = setTimeout(runDigestCycle, DIGEST_CHECK_INTERVAL);
    }
}
