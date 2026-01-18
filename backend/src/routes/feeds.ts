import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryOne, queryAll, run } from '../db/index.js';
import { discoverFeedsFromUrl, discoverByKeyword } from '../services/discovery.js';
import { parseFeed, normalizeArticle, FeedType } from '../services/feed-parser.js';
import { refreshFeed } from '../services/feed-refresh.js';

// Schemas
const addFeedSchema = z.object({
    url: z.string().url(),
    folder_id: z.number().optional(),
    discover: z.boolean().default(true),
    title: z.string().optional(),
    refresh_interval_minutes: z.number().min(5).max(1440).optional(),
});

const updateFeedSchema = z.object({
    title: z.string().optional(),
    folder_id: z.coerce.number().nullable().optional(),
    refresh_interval_minutes: z.coerce.number().min(5).max(1440).optional(),
});

const bulkActionSchema = z.object({
    action: z.enum(['move', 'delete', 'mark_read']),
    feed_ids: z.array(z.coerce.number()),
    folder_id: z.coerce.number().nullable().optional(),
});

interface Feed {
    id: number;
    user_id: number;
    folder_id: number | null;
    type: FeedType;
    title: string;
    url: string;
    site_url: string | null;
    icon_url: string | null;
    description: string | null;
    refresh_interval_minutes: number;
    last_fetched_at: string | null;
    error_count: number;
    last_error: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
}

export async function feedsRoutes(app: FastifyInstance) {
    // Single user app - user_id is always 1
    const userId = 1;

    // List feeds
    app.get('/', async (request: FastifyRequest) => {

        const feeds = queryAll<Feed & { unread_count: number }>(
            `SELECT f.*,
        COALESCE(COUNT(a.id) FILTER (WHERE rs.is_read IS NULL OR rs.is_read = 0), 0) as unread_count
       FROM feeds f
       LEFT JOIN articles a ON a.feed_id = f.id
       LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
       WHERE f.user_id = ? AND f.deleted_at IS NULL
       GROUP BY f.id
       ORDER BY f.title`,
            [userId, userId]
        );

        return { feeds };
    });

    // Get single feed
    app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const feedId = parseInt(request.params.id, 10);

        const feed = queryOne<Feed>(
            'SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [feedId, userId]
        );

        if (!feed) {
            return reply.status(404).send({ error: 'Feed not found' });
        }

        return { feed };
    });

    // Add feed (with discovery)
    app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const body = addFeedSchema.parse(request.body);

        // Check for existing feed (including soft-deleted)
        const existing = queryOne<Feed>(
            'SELECT id, deleted_at FROM feeds WHERE user_id = ? AND url = ?',
            [userId, body.url]
        );

        if (existing) {
            if (existing.deleted_at) {
                // Restore the soft-deleted feed instead of creating a new one
                run('UPDATE feeds SET deleted_at = NULL WHERE id = ?', [existing.id]);
                const restoredFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [existing.id]);
                return reply.status(200).send({ feed: restoredFeed, restored: true });
            }
            return reply.status(409).send({ error: 'Feed already exists', feed_id: existing.id });
        }

        let feedUrl = body.url;
        let feedType: FeedType = 'rss';
        let discovered = null;

        // Discover feeds if requested
        if (body.discover) {
            try {
                const discoveries = await discoverFeedsFromUrl(body.url);
                if (discoveries.length > 0) {
                    const best = discoveries[0];
                    feedUrl = best.feed_url;
                    feedType = best.type;
                    discovered = {
                        source_type: best.type,
                        confidence: best.confidence,
                        method: best.method,
                        icon_url: best.icon_url,
                    };
                }
            } catch (err) {
                console.error('Discovery failed, using direct URL:', err);
            }
        }

        // Parse the feed to get metadata
        let feedData;
        try {
            feedData = await parseFeed(feedUrl);
        } catch (err) {
            return reply.status(400).send({
                error: 'Could not parse feed',
                details: err instanceof Error ? err.message : 'Unknown error',
            });
        }

        // Insert feed
        const result = run(
            `INSERT INTO feeds (user_id, folder_id, type, title, url, site_url, icon_url, description, refresh_interval_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                body.folder_id || null,
                feedType,
                body.title || feedData.title,
                feedUrl,
                feedData.link || null,
                feedData.favicon || discovered?.icon_url || null,
                feedData.description || null,
                body.refresh_interval_minutes || 30,
            ]
        );

        const feed = queryOne<Feed>(
            'SELECT * FROM feeds WHERE id = ?',
            [result.lastInsertRowid]
        );

        // Insert initial articles
        if (feedData.articles.length > 0) {
            const insertArticle = `
        INSERT OR IGNORE INTO articles 
        (feed_id, guid, title, url, author, summary, content, enclosure_url, enclosure_type, thumbnail_url, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            for (const article of feedData.articles) {
                const normalized = normalizeArticle(article, feedType);
                run(insertArticle, [
                    feed!.id,
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
            }
        }

        // Update last fetched and next fetch using the feed's interval
        run(
            `UPDATE feeds SET last_fetched_at = datetime('now'), next_fetch_at = datetime('now', '+' || refresh_interval_minutes || ' minutes') WHERE id = ?`,
            [feed!.id]
        );

        return {
            feed: { ...feed, unread_count: feedData.articles.length },
            discovered,
            articles_added: feedData.articles.length,
        };
    });

    // Update feed
    app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const feedId = parseInt(request.params.id, 10);
        const parsed = updateFeedSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
        }
        const body = parsed.data;

        const existing = queryOne<Feed>(
            'SELECT id FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [feedId, userId]
        );

        if (!existing) {
            return reply.status(404).send({ error: 'Feed not found' });
        }

        const updates: string[] = [];
        const params: unknown[] = [];

        if (body.title !== undefined) {
            updates.push('title = ?');
            params.push(body.title);
        }
        if (body.folder_id !== undefined) {
            updates.push('folder_id = ?');
            params.push(body.folder_id);
        }
        if (body.refresh_interval_minutes !== undefined) {
            updates.push('refresh_interval_minutes = ?');
            params.push(body.refresh_interval_minutes);
        }

        if (updates.length > 0) {
            updates.push(`updated_at = datetime('now')`);
            params.push(feedId, userId);
            run(
                `UPDATE feeds SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
                params
            );
        }

        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [feedId]);
        return { feed };
    });

    // Delete feed
    app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const feedId = parseInt(request.params.id, 10);

        const result = run(
            `UPDATE feeds SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
            [feedId, userId]
        );

        if (result.changes === 0) {
            return reply.status(404).send({ error: 'Feed not found' });
        }

        return { deleted: true };
    });

    // Bulk operations
    app.post('/bulk', async (request: FastifyRequest, reply: FastifyReply) => {
        const parsed = bulkActionSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid request', details: parsed.error.flatten() });
        }
        const body = parsed.data;

        if (body.feed_ids.length === 0) {
            return reply.status(400).send({ error: 'feed_ids required' });
        }

        let affected = 0;

        switch (body.action) {
            case 'move':
                if (body.folder_id === undefined) {
                    return reply.status(400).send({ error: 'folder_id required for move action' });
                }
                const targetFolderId = body.folder_id ?? null;
                const moveResult = run(
                    `UPDATE feeds SET folder_id = ?, updated_at = datetime('now')
           WHERE id IN (${body.feed_ids.map(() => '?').join(',')}) AND user_id = ? AND deleted_at IS NULL`,
                    [targetFolderId, ...body.feed_ids, userId]
                );
                affected = moveResult.changes;
                break;

            case 'delete':
                const deleteResult = run(
                    `UPDATE feeds SET deleted_at = datetime('now'), updated_at = datetime('now')
           WHERE id IN (${body.feed_ids.map(() => '?').join(',')}) AND user_id = ? AND deleted_at IS NULL`,
                    [...body.feed_ids, userId]
                );
                affected = deleteResult.changes;
                break;

            case 'mark_read':
                // Mark all articles in these feeds as read
                for (const feedId of body.feed_ids) {
                    run(
                        `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
             SELECT ?, id, 1, datetime('now'), datetime('now')
             FROM articles WHERE feed_id = ?`,
                        [userId, feedId]
                    );
                }
                affected = body.feed_ids.length;
                break;
        }

        return { affected };
    });

    // Force refresh feed
    app.post('/:id/refresh', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const feedId = parseInt(request.params.id, 10);

        const feed = queryOne<Feed>(
            'SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [feedId, userId]
        );

        if (!feed) {
            return reply.status(404).send({ error: 'Feed not found' });
        }

        const result = await refreshFeed({
            id: feed.id,
            url: feed.url,
            type: feed.type,
            refresh_interval_minutes: feed.refresh_interval_minutes,
        });

        if (!result.success) {
            return reply.status(500).send({
                error: 'Failed to refresh feed',
                details: result.error,
            });
        }

        return { success: true, new_articles: result.newArticles };
    });
}
