import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryOne, queryAll, run } from '../db/index.js';
import { refreshRecommendations } from '../services/discovery/discovery-engine.js';
import { analyzeUserInterests } from '../services/interest-analyzer.js';
import { discoverFeedsFromUrl, discoverByKeyword } from '../services/discovery.js';

const updateInterestsSchema = z.object({
    topics: z.array(z.string())
});

const urlDiscoverSchema = z.object({
    url: z.string().url(),
});

const keywordSchema = z.object({
    q: z.string().min(2),
    limit: z.coerce.number().min(1).max(20).default(10),
    type: z.enum(['rss', 'youtube', 'reddit', 'podcast']).optional(),
});

export async function discoveryRoutes(app: FastifyInstance) {
    const userId = 1;

    // Get recommendations
    app.get('/recommendations', async (request: FastifyRequest) => {
        const recommendations = queryAll(
            `SELECT fr.* FROM feed_recommendations fr
             LEFT JOIN feeds f ON f.user_id = fr.user_id AND f.url = fr.feed_url AND f.deleted_at IS NULL
             WHERE fr.user_id = ? AND fr.status = 'pending' AND f.id IS NULL
             ORDER BY fr.relevance_score DESC LIMIT 20`,
            [userId]
        );
        return { recommendations };
    });

    // Manually refresh recommendations
    app.post('/refresh', async (request: FastifyRequest) => {
        // First analyze interests to ensure recommendations are fresh
        await analyzeUserInterests(userId);
        await refreshRecommendations(userId);

        const recommendations = queryAll(
            `SELECT fr.* FROM feed_recommendations fr
             LEFT JOIN feeds f ON f.user_id = fr.user_id AND f.url = fr.feed_url AND f.deleted_at IS NULL
             WHERE fr.user_id = ? AND fr.status = 'pending' AND f.id IS NULL
             ORDER BY fr.relevance_score DESC LIMIT 20`,
            [userId]
        );
        return { recommendations };
    });

    // Dismiss a recommendation
    app.post('/:id/dismiss', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const id = parseInt(request.params.id, 10);
        run(
            "UPDATE feed_recommendations SET status = 'dismissed' WHERE id = ? AND user_id = ?",
            [id, userId]
        );
        return { success: true };
    });

    // Get interests
    app.get('/interests', async (request: FastifyRequest) => {
        const interests = queryAll(
            'SELECT topic, source, confidence FROM user_interests WHERE user_id = ? ORDER BY confidence DESC',
            [userId]
        );
        return { interests };
    });

    // Update interests (explicit)
    app.put('/interests', async (request: FastifyRequest) => {
        const { topics } = updateInterestsSchema.parse(request.body);

        // Mark old explicit interests as deleted or just replace?
        // Let's simple replace for now for 'explicit' source
        run('DELETE FROM user_interests WHERE user_id = ? AND source = "explicit"', [userId]);

        for (const topic of topics) {
            run(
                'INSERT INTO user_interests (user_id, topic, source, confidence, created_at) VALUES (?, ?, "explicit", 1.0, datetime("now"))',
                [userId, topic]
            );
        }

        return { success: true };
    });

    // Manual Discovery Routes

    // Discover feeds (automatic URL or keyword)
    app.get('/', async (request: FastifyRequest) => {
        const query = keywordSchema.parse(request.query);
        const q = query.q;

        const isUrl = q.startsWith('http://') || q.startsWith('https://') || q.includes('.');

        if (isUrl) {
            try {
                const urlToTest = q.startsWith('http') ? q : `https://${q}`;
                const discoveries = await discoverFeedsFromUrl(urlToTest);
                // Filter out inactive feeds
                const activeDiscoveries = discoveries.filter(d => d.isActive !== false);
                if (activeDiscoveries.length > 0) {
                    return { discoveries: activeDiscoveries };
                }
            } catch (err) {
                // Not a valid URL or fetch failed, fallback to keyword
                console.error(`[Discovery] URL discovery failed for "${q}":`, err instanceof Error ? err.message : err);
            }
        }

        const discoveries = await discoverByKeyword(q, query.limit, query.type);
        // Filter out inactive feeds (discoverByKeyword already filters, but double-check)
        const activeDiscoveries = discoveries.filter(d => d.isActive !== false);
        return { discoveries: activeDiscoveries };
    });

    // Explicit URL discovery
    app.post('/url', async (request: FastifyRequest) => {
        const body = urlDiscoverSchema.parse(request.body);

        try {
            const discoveries = await discoverFeedsFromUrl(body.url);
            // Filter out inactive feeds
            const activeDiscoveries = discoveries.filter(d => d.isActive !== false);
            return { discoveries: activeDiscoveries };
        } catch (err) {
            return {
                discoveries: [],
                error: err instanceof Error ? err.message : 'Discovery failed',
            };
        }
    });
}
