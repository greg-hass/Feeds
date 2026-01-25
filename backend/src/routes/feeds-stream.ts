import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryAll, run } from '../db/index.js';
import { refreshFeed, FeedToRefreshWithCache } from '../services/feed-refresh.js';
import { FeedType } from '../services/feed-parser.js';
import { getUserSettings, updateUserSettingsRaw } from '../services/settings.js';
import { onRefreshEvent, RefreshEvent } from '../services/refresh-events.js';
import { Feed, RefreshStats, RefreshProgressEvent } from '../types/index.js';

function isGenericIconUrl(url: string | null): boolean {
    if (!url) return true;
    return url.includes('google.com/s2/favicons') ||
           url.endsWith('/favicon.ico') ||
           url.includes('youtube.com/favicon') ||
           url.includes('yt3.ggpht.com/favicon');
}

// Timeout configuration
const FEED_REFRESH_TIMEOUT = 15_000; // 15 seconds (reduced from 30s - fail fast on slow feeds)
const KEEPALIVE_INTERVAL = 15_000; // 15 seconds
const DELAY_BETWEEN_FEEDS = 1_000; // 1 second delay between feeds (currently unused)

export async function feedsStreamRoutes(app: FastifyInstance) {
    // Single user app - user_id is always 1
    const userId = 1;

    // Subscribe to background refresh events (scheduler-driven)
    app.get('/refresh-events', async (request: FastifyRequest, reply: FastifyReply) => {
        let isCancelled = false;
        request.raw.on('close', () => {
            isCancelled = true;
        });

        await reply.hijack();

        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no',
        });

        const sendEvent = (event: RefreshEvent) => {
            if (isCancelled) return;
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        const keepaliveTimer = setInterval(() => {
            reply.raw.write(`: keepalive\n\n`);
        }, KEEPALIVE_INTERVAL);

        const unsubscribe = onRefreshEvent(sendEvent);

        request.raw.on('close', () => {
            clearInterval(keepaliveTimer);
            unsubscribe();
        });
    });

    // Bulk refresh feeds with SSE progress
    app.get('/refresh-multiple', async (request: FastifyRequest<{ Querystring: { ids?: string } }>, reply: FastifyReply) => {
        let isCancelled = false;
        request.raw.on('close', () => {
            isCancelled = true;
        });

        const idsParam = request.query.ids;

        let feedIds: number[] = [];
        if (idsParam) {
            feedIds = idsParam.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));
        }
        const refreshAll = feedIds.length === 0;

        // Get feeds to refresh WITH icon cache status in a single query
        // This eliminates 240+ individual queries in refreshFeed()
        interface FeedWithCache extends Feed {
            icon_url: string | null;
            icon_cached_path: string | null;
            user_id: number;
        }

        let feeds: FeedWithCache[];
        if (feedIds.length > 0) {
            // Refresh specific feeds
            const placeholders = feedIds.map(() => '?').join(',');
            feeds = queryAll<FeedWithCache>(
                `SELECT id, title, url, type, refresh_interval_minutes, user_id, icon_url, icon_cached_path
                 FROM feeds
                 WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL`,
                [...feedIds, userId]
            );
        } else {
            // Refresh all feeds
            feeds = queryAll<FeedWithCache>(
                `SELECT id, title, url, type, refresh_interval_minutes, user_id, icon_url, icon_cached_path
                 FROM feeds
                 WHERE user_id = ? AND deleted_at IS NULL
                 ORDER BY title`,
                [userId]
            );
        }

        if (feeds.length === 0) {
            return reply.status(400).send({ error: 'No feeds to refresh' });
        }

        // Take over raw response handling - prevents Fastify from closing the connection
        await reply.hijack();

        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        });

        const sendEvent = (event: RefreshProgressEvent) => {
            if (isCancelled) return;
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        // Keepalive interval
        const keepaliveTimer = setInterval(() => {
            reply.raw.write(`: keepalive\n\n`);
        }, KEEPALIVE_INTERVAL);

        try {
            // Send start event
            sendEvent({
                type: 'start',
                total_feeds: feeds.length,
            });

            const stats: RefreshStats = {
                success: 0,
                errors: 0,
                failed_feeds: [],
            };

            // Refresh feeds in larger batches for speed (optimizations allow higher concurrency)
            // Icon lookups are pre-fetched, content is lazy-loaded, thumbnails are fire-and-forget
            const BATCH_SIZE = 10; // Reduced from 50 for smoother UI updates

            for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
                if (isCancelled) break;
                const batch = feeds.slice(i, i + BATCH_SIZE);

                await Promise.all(batch.map(async (feed) => {
                    if (isCancelled) return;
                    sendEvent({
                        type: 'feed_refreshing',
                        id: feed.id,
                        title: feed.title,
                    });

                    try {
                        // Pass pre-fetched icon and user data to eliminate duplicate queries
                        const feedToRefresh: FeedToRefreshWithCache = {
                            id: feed.id,
                            url: feed.url,
                            type: feed.type,
                            refresh_interval_minutes: feed.refresh_interval_minutes,
                            hasValidIcon: feed.icon_url ? !isGenericIconUrl(feed.icon_url) : false,
                            userId: feed.user_id,
                        };

                        // Use Promise.race for timeout (fail fast on slow feeds)
                        const refreshPromise = refreshFeed(feedToRefresh);
                        const timeoutPromise = new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error(`Timeout after ${FEED_REFRESH_TIMEOUT / 1000}s`)), FEED_REFRESH_TIMEOUT)
                        );

                        const result = await Promise.race([refreshPromise, timeoutPromise]);

                        if (result.success) {
                            sendEvent({
                                type: 'feed_complete',
                                id: feed.id,
                                title: feed.title,
                                new_articles: result.newArticles,
                                next_fetch_at: result.next_fetch_at,
                            });
                            stats.success++;
                        } else {
                            const errorMsg = result.error || 'Unknown error';
                            sendEvent({
                                type: 'feed_error',
                                id: feed.id,
                                title: feed.title,
                                error: errorMsg,
                            });
                            stats.errors++;
                            stats.failed_feeds.push({
                                id: feed.id,
                                title: feed.title,
                                error: errorMsg,
                            });
                        }
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                        sendEvent({
                            type: 'feed_error',
                            id: feed.id,
                            title: feed.title,
                            error: errorMessage,
                        });
                        stats.errors++;
                        stats.failed_feeds.push({
                            id: feed.id,
                            title: feed.title,
                            error: errorMessage,
                        });
                    }
                }));
            }

            // Send completion
            sendEvent({ type: 'complete', stats });

            if (!isCancelled && refreshAll) {
                const settings = getUserSettings(userId);
                const intervalMinutes = settings.refresh_interval_minutes;
                const now = new Date();
                updateUserSettingsRaw(userId, {
                    global_last_refresh_at: now.toISOString(),
                    global_next_refresh_at: new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString(),
                });

                run(
                    `UPDATE feeds SET
                        refresh_interval_minutes = ?,
                        next_fetch_at = datetime('now', '+' || ? || ' minutes'),
                        updated_at = datetime('now')
                     WHERE user_id = ? AND deleted_at IS NULL`,
                    [intervalMinutes, intervalMinutes, userId]
                );
            }
        } catch (err) {
            sendEvent({
                type: 'complete',
                stats: {
                    success: 0,
                    errors: 1,
                    failed_feeds: [
                        {
                            id: 0,
                            title: 'Refresh',
                            error: err instanceof Error ? err.message : 'Unknown error',
                        },
                    ],
                },
            });
        } finally {
            clearInterval(keepaliveTimer);
            reply.raw.end();
        }
    });
}
