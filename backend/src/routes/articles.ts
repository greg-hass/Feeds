import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryOne, queryAll, run } from '../db/index.js';
import { extractReadability } from '../services/readability.js';

const listArticlesSchema = z.object({
    feed_id: z.coerce.number().optional(),
    folder_id: z.coerce.number().optional(),
    type: z.enum(['rss', 'youtube', 'reddit', 'podcast']).optional(),
    unread_only: z.coerce.boolean().default(false),
    has_audio: z.coerce.boolean().optional(),
    since: z.string().optional(),
    before: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(200).default(50),
});

const markReadSchema = z.object({
    scope: z.enum(['feed', 'folder', 'type', 'all', 'ids']),
    scope_id: z.number().optional(),
    type: z.enum(['rss', 'youtube', 'reddit', 'podcast']).optional(),
    article_ids: z.array(z.number()).optional(),
    before: z.string().optional(),
});

interface Article {
    id: number;
    feed_id: number;
    guid: string;
    title: string;
    url: string | null;
    author: string | null;
    summary: string | null;
    content: string | null;
    readability_content: string | null;
    enclosure_url: string | null;
    enclosure_type: string | null;
    enclosure_length: number | null;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    published_at: string | null;
    fetched_at: string;
}

export async function articlesRoutes(app: FastifyInstance) {
    app.addHook('preHandler', app.authenticate);

    // List articles
    app.get('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        const query = listArticlesSchema.parse(request.query);

        const conditions: string[] = ['f.user_id = ?', 'f.deleted_at IS NULL'];
        const params: unknown[] = [userId];

        if (query.feed_id) {
            conditions.push('a.feed_id = ?');
            params.push(query.feed_id);
        }

        if (query.folder_id) {
            conditions.push('f.folder_id = ?');
            params.push(query.folder_id);
        }

        if (query.type) {
            conditions.push('f.type = ?');
            params.push(query.type);
        }

        if (query.unread_only) {
            conditions.push('(rs.is_read IS NULL OR rs.is_read = 0)');
        }

        if (query.has_audio) {
            conditions.push('a.enclosure_url IS NOT NULL');
        }

        if (query.since) {
            conditions.push('a.published_at >= ?');
            params.push(query.since);
        }

        if (query.before) {
            conditions.push('a.published_at < ?');
            params.push(query.before);
        }

        // Cursor pagination
        let cursorCondition = '';
        if (query.cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(query.cursor, 'base64').toString());
                cursorCondition = 'AND (a.published_at < ? OR (a.published_at = ? AND a.id < ?))';
                params.push(decoded.published_at, decoded.published_at, decoded.id);
            } catch {
                // Invalid cursor, ignore
            }
        }

        params.push(query.limit + 1); // +1 to check for more

        const articles = queryAll<Article & {
            feed_title: string;
            feed_icon_url: string | null;
            feed_type: string;
            is_read: number | null;
            is_bookmarked: number;
        }>(
            `SELECT 
        a.id, a.feed_id, a.title, a.url, a.author, a.summary, 
        a.enclosure_url, a.enclosure_type, a.thumbnail_url, a.published_at,
        COALESCE(a.is_bookmarked, 0) as is_bookmarked,
        f.title as feed_title, f.icon_url as feed_icon_url, f.type as feed_type,
        rs.is_read
       FROM articles a
       JOIN feeds f ON f.id = a.feed_id
       LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
       WHERE ${conditions.join(' AND ')} ${cursorCondition}
       ORDER BY a.published_at DESC, a.id DESC
       LIMIT ?`,
            [userId, ...params]
        );

        const hasMore = articles.length > query.limit;
        if (hasMore) articles.pop();

        // Build next cursor
        let nextCursor = null;
        if (hasMore && articles.length > 0) {
            const last = articles[articles.length - 1];
            nextCursor = Buffer.from(JSON.stringify({
                published_at: last.published_at,
                id: last.id,
            })).toString('base64');
        }

        // Get total unread for this filter
        const unreadResult = queryOne<{ total: number }>(
            `SELECT COUNT(*) as total FROM articles a
       JOIN feeds f ON f.id = a.feed_id
       LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
       WHERE ${conditions.join(' AND ')} AND (rs.is_read IS NULL OR rs.is_read = 0)`,
            [userId, ...params.slice(0, -1)]
        );

        return {
            articles: articles.map(a => ({
                ...a,
                is_read: Boolean(a.is_read),
                is_bookmarked: Boolean(a.is_bookmarked),
                has_audio: Boolean(a.enclosure_url),
            })),
            next_cursor: nextCursor,
            total_unread: unreadResult?.total || 0,
        };
    });

    // Get single article with full content
    app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id: userId } = (request as any).user;
        const articleId = parseInt(request.params.id, 10);

        const article = queryOne<Article & {
            feed_title: string;
            feed_icon_url: string | null;
            is_read: number | null;
        }>(
            `SELECT a.*, f.title as feed_title, f.icon_url as feed_icon_url, rs.is_read
       FROM articles a
       JOIN feeds f ON f.id = a.feed_id
       LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
       WHERE a.id = ? AND f.user_id = ? AND f.deleted_at IS NULL`,
            [userId, articleId, userId]
        );

        if (!article) {
            return reply.status(404).send({ error: 'Article not found' });
        }

        // If no readability content, try to extract it
        if (!article.readability_content && article.content) {
            try {
                const readable = extractReadability(article.content, article.url || undefined);
                if (readable) {
                    run('UPDATE articles SET readability_content = ? WHERE id = ?', [readable, articleId]);
                    article.readability_content = readable;
                }
            } catch {
                // Ignore readability errors
            }
        }

        // Mark as read automatically
        run(
            `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
       VALUES (?, ?, 1, datetime("now"), datetime("now"))`,
            [userId, articleId]
        );

        return {
            article: {
                ...article,
                is_read: true,
            },
        };
    });

    // Mark article as read
    app.post('/:id/read', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const { id: userId } = (request as any).user;
        const articleId = parseInt(request.params.id, 10);

        run(
            `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
       VALUES (?, ?, 1, datetime("now"), datetime("now"))`,
            [userId, articleId]
        );

        return { success: true };
    });

    // Mark article as unread
    app.post('/:id/unread', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const { id: userId } = (request as any).user;
        const articleId = parseInt(request.params.id, 10);

        run(
            `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
       VALUES (?, ?, 0, datetime("now"), datetime("now"))`,
            [userId, articleId]
        );

        return { success: true };
    });

    // Bulk mark as read
    app.post('/mark-read', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        const body = markReadSchema.parse(request.body);

        let marked = 0;
        const beforeCondition = body.before ? 'AND a.published_at < ?' : '';
        const beforeParam = body.before ? [body.before] : [];

        switch (body.scope) {
            case 'feed':
                const feedResult = run(
                    `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
           SELECT ?, a.id, 1, datetime("now"), datetime("now")
           FROM articles a
           WHERE a.feed_id = ? ${beforeCondition}`,
                    [userId, body.scope_id, ...beforeParam]
                );
                marked = feedResult.changes;
                break;

            case 'folder':
                const folderResult = run(
                    `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
           SELECT ?, a.id, 1, datetime("now"), datetime("now")
           FROM articles a
           JOIN feeds f ON f.id = a.feed_id
           WHERE f.folder_id = ? AND f.user_id = ? AND f.deleted_at IS NULL ${beforeCondition}`,
                    [userId, body.scope_id, userId, ...beforeParam]
                );
                marked = folderResult.changes;
                break;

            case 'type':
                const typeResult = run(
                    `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
           SELECT ?, a.id, 1, datetime("now"), datetime("now")
           FROM articles a
           JOIN feeds f ON f.id = a.feed_id
           WHERE f.type = ? AND f.user_id = ? AND f.deleted_at IS NULL ${beforeCondition}`,
                    [userId, body.type, userId, ...beforeParam]
                );
                marked = typeResult.changes;
                break;

            case 'all':
                const allResult = run(
                    `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
           SELECT ?, a.id, 1, datetime("now"), datetime("now")
           FROM articles a
           JOIN feeds f ON f.id = a.feed_id
           WHERE f.user_id = ? AND f.deleted_at IS NULL ${beforeCondition}`,
                    [userId, userId, ...beforeParam]
                );
                marked = allResult.changes;
                break;

            case 'ids':
                if (body.article_ids && body.article_ids.length > 0) {
                    const placeholders = body.article_ids.map(() => '?').join(',');
                    const idsResult = run(
                        `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
             SELECT ?, a.id, 1, datetime("now"), datetime("now")
             FROM articles a
             WHERE a.id IN (${placeholders})`,
                        [userId, ...body.article_ids]
                    );
                    marked = idsResult.changes;
                }
                break;
        }

        return { marked };
    });

    // Toggle bookmark on article
    app.patch('/:id/bookmark', async (request: FastifyRequest<{ Params: { id: string }; Body: { bookmarked: boolean } }>, reply: FastifyReply) => {
        const { id: userId } = (request as any).user;
        const articleId = parseInt(request.params.id, 10);
        const { bookmarked } = request.body as { bookmarked: boolean };

        // Verify article belongs to user's feeds
        const article = queryOne<{ id: number }>(
            `SELECT a.id FROM articles a
             JOIN feeds f ON f.id = a.feed_id
             WHERE a.id = ? AND f.user_id = ? AND f.deleted_at IS NULL`,
            [articleId, userId]
        );

        if (!article) {
            return reply.status(404).send({ error: 'Article not found' });
        }

        run(
            'UPDATE articles SET is_bookmarked = ? WHERE id = ?',
            [bookmarked ? 1 : 0, articleId]
        );

        return { success: true, is_bookmarked: bookmarked };
    });

    // List bookmarked articles
    app.get('/bookmarks', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;

        const articles = queryAll<Article & {
            feed_title: string;
            feed_icon_url: string | null;
            feed_type: string;
            is_read: number | null;
            is_bookmarked: number;
        }>(
            `SELECT 
                a.id, a.feed_id, a.title, a.url, a.author, a.summary, 
                a.enclosure_url, a.enclosure_type, a.thumbnail_url, a.published_at, a.is_bookmarked,
                f.title as feed_title, f.icon_url as feed_icon_url, f.type as feed_type,
                rs.is_read
             FROM articles a
             JOIN feeds f ON f.id = a.feed_id
             LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
             WHERE f.user_id = ? AND f.deleted_at IS NULL AND a.is_bookmarked = 1
             ORDER BY a.published_at DESC
             LIMIT 200`,
            [userId, userId]
        );

        return {
            articles: articles.map(a => ({
                ...a,
                is_read: Boolean(a.is_read),
                is_bookmarked: Boolean(a.is_bookmarked),
                has_audio: Boolean(a.enclosure_url),
            })),
        };
    });
}
