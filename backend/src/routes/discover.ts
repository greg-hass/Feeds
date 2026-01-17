import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { discoverFeedsFromUrl, discoverByKeyword, DiscoveredFeed } from '../services/discovery.js';

const urlDiscoverSchema = z.object({
    url: z.string().url(),
});

const keywordSchema = z.object({
    q: z.string().min(2),
    limit: z.coerce.number().min(1).max(20).default(10),
});

export async function discoverRoutes(app: FastifyInstance) {
    app.addHook('preHandler', app.authenticate);

    // Discover feeds from URL
    app.post('/url', async (request: FastifyRequest) => {
        const body = urlDiscoverSchema.parse(request.body);

        try {
            const discoveries = await discoverFeedsFromUrl(body.url);
            return { discoveries };
        } catch (err) {
            return {
                discoveries: [],
                error: err instanceof Error ? err.message : 'Discovery failed',
            };
        }
    });

    // Keyword discovery
    app.get('/keyword', async (request: FastifyRequest) => {
        const query = keywordSchema.parse(request.query);

        try {
            const suggestions = await discoverByKeyword(query.q, query.limit);
            return { suggestions };
        } catch (err) {
            return {
                suggestions: [],
                error: err instanceof Error ? err.message : 'Search failed',
            };
        }
    });
}
