import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryOne, queryAll, run } from '../db/index.js';
import { refreshRecommendations } from '../services/discovery/discovery-engine.js';
import { analyzeUserInterests } from '../services/interest-analyzer.js';

const updateInterestsSchema = z.object({
    topics: z.array(z.string())
});

export async function discoveryRoutes(app: FastifyInstance) {
    const userId = 1;

    // Get recommendations
    app.get('/recommendations', async (request: FastifyRequest) => {
        const recommendations = queryAll(
            `SELECT * FROM feed_recommendations 
             WHERE user_id = ? AND status = 'pending' 
             ORDER BY relevance_score DESC LIMIT 20`,
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
            `SELECT * FROM feed_recommendations 
             WHERE user_id = ? AND status = 'pending' 
             ORDER BY relevance_score DESC LIMIT 20`,
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
}
