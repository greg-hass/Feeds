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

    // Discover feeds (automatic URL or keyword)
    app.get('/', async (request: FastifyRequest) => {
        const query = keywordSchema.parse(request.query);
        const q = query.q;

        const isUrl = q.startsWith('http://') || q.startsWith('https://') || q.includes('.');

        if (isUrl) {
            try {
                const urlToTest = q.startsWith('http') ? q : `https://${q}`;
                const discoveries = await discoverFeedsFromUrl(urlToTest);
                if (discoveries.length > 0) {
                    return { discoveries };
                }
            } catch {
                // Not a valid URL or fetch failed, fallback to keyword
            }
        }

        const discoveries = await discoverByKeyword(q, query.limit);
        return { discoveries };
    });

    // Explicit URL discovery
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
}
