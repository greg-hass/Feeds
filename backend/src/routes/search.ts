import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryAll } from '../db/index.js';
import { rateLimiters } from '../middleware/rate-limit.js';
import {
    searchArticles,
    countSearchResults,
    getSavedSearches,
    createSavedSearch,
    updateSavedSearch,
    deleteSavedSearch,
    incrementSavedSearchUseCount,
    getSearchHistory,
    addSearchHistory,
    clearSearchHistory,
    getPopularSearches,
    getAllTags,
    getAllAuthors,
    SearchFilters,
} from '../services/search.js';

const searchSchema = z.object({
    q: z.string().min(1),
    unread_only: z.coerce.boolean().default(false),
    type: z.enum(['rss', 'youtube', 'reddit', 'podcast']).optional(),
    feed_id: z.coerce.number().optional(),
    folder_id: z.coerce.number().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    cursor: z.string().optional(),
});

const advancedSearchSchema = z.object({
    query: z.string().optional(),
    feed_ids: z.array(z.number()).optional(),
    folder_ids: z.array(z.number()).optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    is_read: z.boolean().optional(),
    is_bookmarked: z.boolean().optional(),
    has_video: z.boolean().optional(),
    has_audio: z.boolean().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    type: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
});

const savedSearchSchema = z.object({
    name: z.string().min(1).max(100),
    query: z.string(),
    filters: z.object({
        query: z.string().optional(),
        feed_ids: z.array(z.number()).optional(),
        folder_ids: z.array(z.number()).optional(),
        author: z.string().optional(),
        tags: z.array(z.string()).optional(),
        is_read: z.boolean().optional(),
        is_bookmarked: z.boolean().optional(),
        has_video: z.boolean().optional(),
        has_audio: z.boolean().optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        type: z.string().optional(),
    }),
});

export async function searchRoutes(app: FastifyInstance) {
    // Single user app - user_id is always 1
    const userId = 1;

    // Apply rate limiting to search endpoint
    app.addHook('onRequest', async (request, reply) => {
        const allowed = await rateLimiters.search(request as FastifyRequest, reply as FastifyReply);
        if (!allowed) {
            reply.code(429).send({ error: 'Too many search requests. Please try again later.' });
        }
    });

    // Full-text search
    app.get('/', async (request: FastifyRequest) => {
        const query = searchSchema.parse(request.query);

        // Build FTS query - properly escape special characters
        const escapeFts = (term: string): string => {
            // Escape double quotes by doubling them (FTS5 syntax)
            return term.replace(/"/g, '""');
        };

        const ftsQuery = query.q
            .split(/\s+/)
            .filter(w => w.length > 2)  // Filter out very short terms
            .map(w => `"${escapeFts(w)}"`)
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

    // ========================================================================
    // ADVANCED SEARCH
    // ========================================================================

    /**
     * Advanced search with multiple filters
     * POST /search/advanced
     */
    app.post('/advanced', async (request: FastifyRequest) => {
        const body = advancedSearchSchema.parse(request.body);

        const { limit, offset, ...filters } = body;
        const results = searchArticles(userId, filters as SearchFilters, limit, offset);
        const total = countSearchResults(userId, filters as SearchFilters);

        // Add to search history
        if (filters.query || Object.keys(filters).length > 0) {
            addSearchHistory(userId, filters.query || '', filters as SearchFilters, total);
        }

        return {
            results,
            pagination: {
                total,
                limit,
                offset,
                has_more: offset + results.length < total,
            },
        };
    });

    // ========================================================================
    // SAVED SEARCHES
    // ========================================================================

    /**
     * Get all saved searches
     * GET /search/saved
     */
    app.get('/saved', async () => {
        const searches = getSavedSearches(userId);
        return { searches };
    });

    /**
     * Create a saved search
     * POST /search/saved
     */
    app.post('/saved', async (request: FastifyRequest) => {
        const body = savedSearchSchema.parse(request.body);
        const searchId = createSavedSearch(userId, body.name, body.query, body.filters as SearchFilters);

        return {
            id: searchId,
            name: body.name,
            query: body.query,
            filters: body.filters,
        };
    });

    /**
     * Update a saved search
     * PATCH /search/saved/:id
     */
    app.patch('/saved/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const searchId = parseInt(request.params.id);
        if (isNaN(searchId)) {
            return { error: 'Invalid search ID' };
        }

        const body = z.object({
            name: z.string().min(1).max(100).optional(),
            query: z.string().optional(),
            filters: savedSearchSchema.shape.filters.optional(),
        }).parse(request.body);

        updateSavedSearch(searchId, userId, body as any);
        return { success: true };
    });

    /**
     * Delete a saved search
     * DELETE /search/saved/:id
     */
    app.delete('/saved/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const searchId = parseInt(request.params.id);
        if (isNaN(searchId)) {
            return { error: 'Invalid search ID' };
        }

        deleteSavedSearch(searchId, userId);
        return { success: true };
    });

    /**
     * Execute a saved search
     * GET /search/saved/:id/execute?limit=50&offset=0
     */
    app.get('/saved/:id/execute', async (request: FastifyRequest<{
        Params: { id: string };
        Querystring: { limit?: string; offset?: string };
    }>) => {
        const searchId = parseInt(request.params.id);
        const limit = parseInt(request.query.limit || '50');
        const offset = parseInt(request.query.offset || '0');

        if (isNaN(searchId)) {
            return { error: 'Invalid search ID' };
        }

        const searches = getSavedSearches(userId);
        const savedSearch = searches.find(s => s.id === searchId);

        if (!savedSearch) {
            return { error: 'Saved search not found' };
        }

        // Increment use count
        incrementSavedSearchUseCount(searchId, userId);

        const results = searchArticles(userId, savedSearch.filters, limit, offset);
        const total = countSearchResults(userId, savedSearch.filters);

        return {
            search: savedSearch,
            results,
            pagination: {
                total,
                limit,
                offset,
                has_more: offset + results.length < total,
            },
        };
    });

    // ========================================================================
    // SEARCH HISTORY
    // ========================================================================

    /**
     * Get search history
     * GET /search/history?limit=50
     */
    app.get('/history', async (request: FastifyRequest<{ Querystring: { limit?: string } }>) => {
        const limit = parseInt(request.query.limit || '50');
        const history = getSearchHistory(userId, limit);
        return { history };
    });

    /**
     * Clear search history
     * DELETE /search/history
     */
    app.delete('/history', async () => {
        clearSearchHistory(userId);
        return { success: true };
    });

    /**
     * Get popular searches
     * GET /search/popular?limit=10
     */
    app.get('/popular', async (request: FastifyRequest<{ Querystring: { limit?: string } }>) => {
        const limit = parseInt(request.query.limit || '10');
        const popular = getPopularSearches(userId, limit);
        return { searches: popular };
    });

    // ========================================================================
    // AUTOCOMPLETE
    // ========================================================================

    /**
     * Get all tags for autocomplete
     * GET /search/autocomplete/tags
     */
    app.get('/autocomplete/tags', async () => {
        const tags = getAllTags(userId);
        return { tags };
    });

    /**
     * Get all authors for autocomplete
     * GET /search/autocomplete/authors
     */
    app.get('/autocomplete/authors', async () => {
        const authors = getAllAuthors(userId);
        return { authors };
    });
}
