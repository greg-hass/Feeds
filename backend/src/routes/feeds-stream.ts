import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryAll } from '../db/index.js';
import { refreshFeed, FeedToRefresh } from '../services/feed-refresh.js';
import { FeedType } from '../services/feed-parser.js';

// SSE Event Types
type RefreshProgressEvent =
    | { type: 'start'; total_feeds: number }
    | { type: 'feed_refreshing'; id: number; title: string }
    | { type: 'feed_complete'; id: number; title: string; new_articles: number; next_fetch_at?: string }
    | { type: 'feed_error'; id: number; title: string; error: string }
    | { type: 'complete'; stats: RefreshStats };

interface RefreshStats {
    success: number;
    errors: number;
    failed_feeds: Array<{ id: number; title: string; error: string }>;
}

interface Feed {
    id: number;
    title: string;
    url: string;
    type: FeedType;
    refresh_interval_minutes: number;
}

// Timeout configuration
const FEED_REFRESH_TIMEOUT = 30_000; // 30 seconds
const OPERATION_TIMEOUT = 300_000; // 5 minutes
const KEEPALIVE_INTERVAL = 15_000; // 15 seconds
const DELAY_BETWEEN_FEEDS = 1_000; // 1 second delay between feeds

export async function feedsStreamRoutes(app: FastifyInstance) {
    // Single user app - user_id is always 1
    const userId = 1;

    // Bulk refresh feeds with SSE progress
    app.get('/refresh-multiple', async (request: FastifyRequest<{ Querystring: { ids?: string } }>, reply: FastifyReply) => {
        const idsParam = request.query.ids;

        let feedIds: number[] = [];
        if (idsParam) {
            feedIds = idsParam.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));
        }

        // Get feeds to refresh
        let feeds: Feed[];
        if (feedIds.length > 0) {
            // Refresh specific feeds
            const placeholders = feedIds.map(() => '?').join(',');
            feeds = queryAll<Feed>(
                `SELECT id, title, url, type, refresh_interval_minutes 
                 FROM feeds 
                 WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL`,
                [...feedIds, userId]
            );
        } else {
            // Refresh all feeds
            feeds = queryAll<Feed>(
                `SELECT id, title, url, type, refresh_interval_minutes 
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
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        // Keepalive interval
        const keepaliveTimer = setInterval(() => {
            reply.raw.write(`: keepalive\n\n`);
        }, KEEPALIVE_INTERVAL);

        // Operation timeout
        const timeoutTimer = setTimeout(() => {
            clearInterval(keepaliveTimer);
            sendEvent({
                type: 'complete',
                stats: {
                    success: 0,
                    errors: 1,
                    failed_feeds: [{ id: 0, title: 'Operation', error: 'Timeout after 5 minutes' }],
                },
            });
            reply.raw.end();
        }, OPERATION_TIMEOUT);

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

            // Refresh feeds in batches to avoid overwhelming the server/DB
            const BATCH_SIZE = 5;

            for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
                const batch = feeds.slice(i, i + BATCH_SIZE);

                await Promise.all(batch.map(async (feed) => {
                    sendEvent({
                        type: 'feed_refreshing',
                        id: feed.id,
                        title: feed.title,
                    });

                    try {
                        const feedToRefresh: FeedToRefresh = {
                            id: feed.id,
                            url: feed.url,
                            type: feed.type,
                            refresh_interval_minutes: feed.refresh_interval_minutes,
                        };

                        // Use Promise.race for timeout
                        const refreshPromise = refreshFeed(feedToRefresh);
                        const timeoutPromise = new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('Timeout after 30s')), FEED_REFRESH_TIMEOUT)
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
            clearTimeout(timeoutTimer);
            reply.raw.end();
        }
    });
}
