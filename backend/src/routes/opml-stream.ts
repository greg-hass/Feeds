import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryOne, run } from '../db/index.js';
import { parseOPML, OPMLFeed, OPMLFolder } from '../services/opml-parser.js';
import { refreshFeed, FeedToRefresh } from '../services/feed-refresh.js';
import { parseFeed, FeedType } from '../services/feed-parser.js';

// SSE Event Types
type ProgressEvent =
    | { type: 'start'; total_folders: number; total_feeds: number }
    | { type: 'folder_created'; name: string; id: number }
    | { type: 'feed_created'; title: string; id: number; folder?: string; status: 'created' | 'duplicate' }
    | { type: 'feed_refreshing'; id: number; title: string }
    | { type: 'feed_complete'; id: number; title: string; new_articles: number }
    | { type: 'feed_error'; id: number; title: string; error: string }
    | { type: 'complete'; stats: ImportStats };

interface ImportStats {
    success: number;
    skipped: number;
    errors: number;
    failed_feeds: Array<{ id: number; title: string; error: string }>;
}

interface Feed {
    id: number;
    folder_id: number | null;
    type: string;
    title: string;
    url: string;
}

interface Folder {
    id: number;
    name: string;
}

// Timeout configuration
const FEED_REFRESH_TIMEOUT = 30_000; // 30 seconds
const OPERATION_TIMEOUT = 300_000; // 5 minutes
const KEEPALIVE_INTERVAL = 15_000; // 15 seconds

export async function opmlStreamRoutes(app: FastifyInstance) {
    // Single user app - user_id is always 1
    const userId = 1;

    // Note: @fastify/multipart is already registered in opml.ts on this prefix

    // Import OPML with SSE progress
    app.post('/import/stream', async (request: FastifyRequest, reply: FastifyReply) => {
        const file = await request.file();
        if (!file) {
            return reply.status(400).send({ error: 'No file uploaded' });
        }

        const buffer = await file.toBuffer();
        const opmlContent = buffer.toString('utf-8');

        let parsed: { folders: OPMLFolder[]; feeds: OPMLFeed[] };
        try {
            parsed = parseOPML(opmlContent);
        } catch (err) {
            return reply.status(400).send({
                error: 'Invalid OPML format',
                details: err instanceof Error ? err.message : 'Parse error',
            });
        }

        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        const sendEvent = (event: ProgressEvent) => {
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
                    skipped: 0,
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
                total_folders: parsed.folders.length,
                total_feeds: parsed.feeds.length,
            });

            const stats: ImportStats = {
                success: 0,
                skipped: 0,
                errors: 0,
                failed_feeds: [],
            };

            // Create folders
            const folderMap = new Map<string, number>();

            for (const folder of parsed.folders) {
                const existing = queryOne<Folder>(
                    'SELECT id FROM folders WHERE user_id = ? AND name = ? AND deleted_at IS NULL',
                    [userId, folder.name]
                );

                if (existing) {
                    folderMap.set(folder.name, existing.id);
                } else {
                    const result = run(
                        'INSERT INTO folders (user_id, name) VALUES (?, ?)',
                        [userId, folder.name]
                    );
                    const folderId = Number(result.lastInsertRowid);
                    folderMap.set(folder.name, folderId);

                    sendEvent({
                        type: 'folder_created',
                        name: folder.name,
                        id: folderId,
                    });
                }
            }

            // Create and refresh feeds
            const createdFeeds: Array<{ id: number; title: string; url: string; type: FeedType }> = [];

            for (const feed of parsed.feeds) {
                if (!feed.xmlUrl) {
                    stats.skipped++;
                    continue;
                }

                // Check for duplicate
                const existing = queryOne<Feed>(
                    'SELECT id FROM feeds WHERE user_id = ? AND url = ? AND deleted_at IS NULL',
                    [userId, feed.xmlUrl]
                );

                if (existing) {
                    sendEvent({
                        type: 'feed_created',
                        title: feed.title || feed.xmlUrl,
                        id: existing.id,
                        folder: feed.folder,
                        status: 'duplicate',
                    });
                    stats.skipped++;
                    continue;
                }

                try {
                    const folderId = feed.folder ? folderMap.get(feed.folder) || null : null;

                    // Try to parse feed to detect type
                    let feedType: FeedType = 'rss';
                    try {
                        const feedData = await parseFeed(feed.xmlUrl);
                        // parseFeed might set type, but default to rss
                    } catch {
                        // If parse fails, we'll still create the feed entry
                    }

                    const result = run(
                        `INSERT INTO feeds (user_id, folder_id, type, title, url, site_url)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [userId, folderId, feedType, feed.title || feed.xmlUrl, feed.xmlUrl, feed.htmlUrl || null]
                    );

                    const feedId = Number(result.lastInsertRowid);

                    sendEvent({
                        type: 'feed_created',
                        title: feed.title || feed.xmlUrl,
                        id: feedId,
                        folder: feed.folder,
                        status: 'created',
                    });

                    createdFeeds.push({
                        id: feedId,
                        title: feed.title || feed.xmlUrl,
                        url: feed.xmlUrl,
                        type: feedType,
                    });
                } catch (err) {
                    stats.errors++;
                    stats.failed_feeds.push({
                        id: 0,
                        title: feed.title || feed.xmlUrl,
                        error: err instanceof Error ? err.message : 'Unknown error',
                    });
                }
            }

            // Auto-refresh each created feed
            for (const feed of createdFeeds) {
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
                        refresh_interval_minutes: 30,
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
                        });
                        stats.success++;
                    } else {
                        sendEvent({
                            type: 'feed_error',
                            id: feed.id,
                            title: feed.title,
                            error: result.error || 'Unknown error',
                        });
                        stats.errors++;
                        stats.failed_feeds.push({
                            id: feed.id,
                            title: feed.title,
                            error: result.error || 'Unknown error',
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
            }

            // Send completion
            sendEvent({ type: 'complete', stats });
        } catch (err) {
            sendEvent({
                type: 'complete',
                stats: {
                    success: 0,
                    skipped: 0,
                    errors: 1,
                    failed_feeds: [
                        {
                            id: 0,
                            title: 'Import',
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
