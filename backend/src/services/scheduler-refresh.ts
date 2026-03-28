import { queryAll, queryOne, run } from '../db/index.js';
import { refreshFeed, FeedToRefresh } from './feed-refresh.js';
import type { RefreshResult } from './feed-refresh.js';
import { FeedType } from './feed-parser.js';
import { getUserSettings } from './settings.js';
import { emitRefreshEvent, RefreshFeedUpdate, RefreshStats } from './refresh-events.js';
import { getGlobalRefreshSchedule, scheduleNextGlobalRefresh } from './refresh-schedule.js';
import { getRefreshBatchSize } from './refresh-batch.js';

interface Feed extends FeedToRefresh {
    title: string;
}

export async function runFeedRefreshCycle(userId: number): Promise<void> {
    let feedsChecked = 0;
    let feedsRefreshed = 0;
    let feedsFailed = 0;
    let totalNewArticles = 0;
    const stats: RefreshStats = {
        success: 0,
        errors: 0,
        failed_feeds: [],
    };

    const cycleTimeoutMs = 10 * 60 * 1000;
    const cycleStartTime = Date.now();
    const settings = getUserSettings(userId);
    const nowMs = Date.now();

    const schedule = getGlobalRefreshSchedule(userId);
    const nextGlobal = schedule.nextRefreshAt
        ? new Date(schedule.nextRefreshAt).getTime()
        : null;

    if (nextGlobal && nowMs < nextGlobal) {
        return;
    }

    const feeds = queryAll<Feed>(
        `SELECT id, title, url, type, refresh_interval_minutes 
         FROM feeds 
         WHERE deleted_at IS NULL 
         AND paused_at IS NULL
         AND user_id = ?`,
        [userId]
    );

    if (feeds.length === 0) {
        scheduleNextGlobalRefresh(userId, settings.refresh_interval_minutes, new Date(nowMs));
        return;
    }

    console.log(`[Scheduler] Processing ${feeds.length} feeds on global refresh`);
    emitRefreshEvent({ type: 'start', total_feeds: feeds.length });
    const batchSize = getRefreshBatchSize(feeds.length);

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

    for (let i = 0; i < feeds.length; i += batchSize) {
        if (Date.now() - cycleStartTime > cycleTimeoutMs) {
            console.error(`[Scheduler] Refresh cycle exceeded ${cycleTimeoutMs / 60000} minute limit, aborting`);
            break;
        }

        const batch = feeds.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
            batch.map(async (feed) => {
                const feedStart = Date.now();
                feedsChecked++;
                emitRefreshEvent({ type: 'feed_refreshing', id: feed.id, title: feed.title });

                try {
                    const timeoutMs = 30000;
                    const controller = new AbortController();
                    const refreshPromise = refreshFeed({
                        ...feed,
                        signal: controller.signal,
                    });

                    let timeoutId: NodeJS.Timeout | null = null;
                    const timeoutPromise = new Promise<never>((_, reject) => {
                        timeoutId = setTimeout(() => {
                            controller.abort();
                            reject(new Error('Feed refresh timeout'));
                        }, timeoutMs);
                    });

                    let result: RefreshResult;
                    try {
                        result = await Promise.race([refreshPromise, timeoutPromise]);
                    } finally {
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                        }
                    }

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
                            console.log(`[Scheduler] ✓ ${feed.title}: ${result.newArticles} new (${Math.round(feedTime / 1000)}s)`);
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
                    console.error(`[Scheduler] ✗ ${feed.title}: ${errorMessage} (${Math.round(feedTime / 1000)}s)`);
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
                    return { success: false, newArticles: 0, error: errorMessage };
                }
            })
        );

        const batchFailures = batchResults.filter(result => result.status === 'rejected').length;
        if (batchFailures > 0) {
            console.warn(`[Scheduler] Batch ${Math.floor(i / batchSize) + 1}: ${batchFailures}/${batch.length} feeds failed`);
        }

    }

    console.log(`[Scheduler] Batch complete: ${feedsRefreshed}/${feedsChecked} refreshed, ${totalNewArticles} new articles, ${feedsFailed} failed`);
    emitRefreshEvent({ type: 'complete', stats });

    scheduleNextGlobalRefresh(userId, settings.refresh_interval_minutes);

    run(
        `UPDATE feeds SET
            next_fetch_at = datetime('now', '+' || refresh_interval_minutes || ' minutes')
         WHERE user_id = ? AND deleted_at IS NULL`,
        [userId]
    );
}
