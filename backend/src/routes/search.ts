import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryAll } from '../db/index.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const searchSchema = z.object({
    q: z.string().min(1),
    unread_only: z.coerce.boolean().default(false),
    type: z.enum(['rss', 'youtube', 'reddit', 'podcast']).optional(),
    feed_id: z.coerce.number().optional(),
    folder_id: z.coerce.number().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    cursor: z.string().optional(),
});

export async function searchRoutes(app: FastifyInstance) {
    app.addHook('preHandler', app.authenticate);

    // Apply rate limiting to search endpoint
    app.addHook('onRequest', async (request, reply) => {
        const allowed = await rateLimiters.search(request as FastifyRequest, reply as FastifyReply);
        if (!allowed) {
            reply.code(429).send({ error: 'Too many search requests. Please try again later.' });
        }
    });

    // Full-text search
    app.get('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        const query = searchSchema.parse(request.query);

        // Build FTS query - escape special characters
        const ftsQuery = query.q
            .replace(/["\-*]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 0)
            .map(w => `"${w}"`)
            .join(' OR ');

        if (!ftsQuery) {
            return { results: [], total: 0, next_cursor: null };
        }

        const conditions: string[] = ['f.user_id = ?', 'f.deleted_at IS NULL'];
        const params: unknown[] = [userId];

        if (query.unread_only) {
            conditions.push('(rs.is_read IS NULL OR rs.is_read = 0)');
        }

        if (query.type) {
            conditions.push('f.type = ?');
            params.push(query.type);
        }

        if (query.feed_id) {
            conditions.push('a.feed_id = ?');
            params.push(query.feed_id);
        }

        if (query.folder_id) {
            conditions.push('f.folder_id = ?');
            params.push(query.folder_id);
        }

        // Cursor for pagination
        let offsetClause = '';
        if (query.cursor) {
            try {
                const offset = parseInt(Buffer.from(query.cursor, 'base64').toString(), 10);
                offsetClause = `OFFSET ${offset}`;
            } catch {
                // Invalid cursor
            }
        }

        const results = queryAll<{
            id: number;
            feed_id: number;
            feed_title: string;
            title: string;
            author: string | null;
            summary: string | null;
            published_at: string | null;
            is_read: number | null;
            snippet: string;
            rank: number;
        }>(
            `SELECT 
        a.id, a.feed_id, f.title as feed_title, a.title, a.author, a.summary, 
        a.published_at, rs.is_read,
        snippet(articles_fts, 2, '<mark>', '</mark>', '...', 40) as snippet,
        bm25(articles_fts) as rank
       FROM articles_fts fts
       JOIN articles a ON a.id = fts.rowid
       JOIN feeds f ON f.id = a.feed_id
       LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
       WHERE articles_fts MATCH ? AND ${conditions.join(' AND ')}
       ORDER BY rank
       LIMIT ? ${offsetClause}`,
            [userId, ftsQuery, ...params, query.limit + 1]
        );

        const hasMore = results.length > query.limit;
        if (hasMore) results.pop();

        // Calculate next cursor
        let nextCursor = null;
        if (hasMore) {
            const currentOffset = query.cursor
                ? parseInt(Buffer.from(query.cursor, 'base64').toString(), 10)
                : 0;
            nextCursor = Buffer.from(String(currentOffset + query.limit)).toString('base64');
        }

        const formattedResults = results.map(r => ({
            id: r.id,
            feed_id: r.feed_id,
            feed_title: r.feed_title,
            title: r.title,
            snippet: r.snippet,
            published_at: r.published_at,
            is_read: Boolean(r.is_read),
            score: Math.abs(r.rank),
        }));

        // Get total count
        const countResult = queryAll<{ count: number }>(
            `SELECT COUNT(*) as count
       FROM articles_fts fts
       JOIN articles a ON a.id = fts.rowid
       JOIN feeds f ON f.id = a.feed_id
       LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
       WHERE articles_fts MATCH ? AND ${conditions.join(' AND ')}`,
            [userId, ftsQuery, ...params]
        );

        return {
            results: formattedResults,
            total: countResult[0]?.count || 0,
            next_cursor: nextCursor,
        };
    });
}
