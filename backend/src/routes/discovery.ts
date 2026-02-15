import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { discoverFeedsFromUrl, discoverByKeyword } from '../services/discovery.js';

const urlDiscoverSchema = z.object({
    url: z.string().url(),
});

const keywordSchema = z.object({
    q: z.string().min(2),
    limit: z.coerce.number().min(1).max(20).default(10),
    type: z.enum(['rss', 'youtube', 'reddit', 'podcast']).optional(),
});

export async function discoveryRoutes(app: FastifyInstance) {
    // Manual Discovery Routes only - AI recommendations removed

    // Discover feeds (automatic URL or keyword)
    app.get('/', async (request: FastifyRequest) => {
        const query = keywordSchema.parse(request.query);
        console.log(`[Discovery Route] Query: "${query.q}", Type: ${query.type || 'all'}`);
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

        // Keyword-based discovery with proper error handling
        try {
            const discoveries = await discoverByKeyword(q, query.limit, query.type);
            console.log(`[Discovery Route] Total discoveries: ${discoveries.length}`);
            
            // Filter out inactive feeds (discoverByKeyword already filters, but double-check)
            const activeDiscoveries = discoveries.filter(d => d.isActive !== false);
            console.log(`[Discovery Route] Active discoveries: ${activeDiscoveries.length}`);
            
            return { discoveries: activeDiscoveries };
        } catch (err) {
            console.error(`[Discovery Route] Keyword discovery failed for "${q}":`, err instanceof Error ? err.message : err);
            // Return empty results instead of throwing an error
            return { discoveries: [] };
        }
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
