import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FeedsController } from '../controllers/feeds.controller.js';

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
    action: z.enum(['move', 'delete', 'mark_read', 'update_refresh_interval']),
    feed_ids: z.array(z.coerce.number()),
    folder_id: z.coerce.number().nullable().optional(),
    refresh_interval_minutes: z.number().min(5).max(1440).optional(),
});

export async function feedsRoutes(app: FastifyInstance) {
    // List feeds
    app.get('/', FeedsController.list);

    // Get single feed
    app.get('/:id', FeedsController.getOne);

    // Add feed (with discovery)
    app.post('/', async (request, reply) => {
        const body = addFeedSchema.parse(request.body);
        request.body = body;
        return FeedsController.add(request as any, reply);
    });

    // Update feed
    app.patch('/:id', async (request, reply) => {
        const body = updateFeedSchema.parse(request.body);
        request.body = body;
        // The controller expects params.id
        return FeedsController.update(request as any, reply);
    });

    // Delete feed
    app.delete('/:id', FeedsController.delete);

    // Bulk operations
    app.post('/bulk', async (request, reply) => {
        const body = bulkActionSchema.parse(request.body);
        request.body = body;
        return FeedsController.bulk(request as any, reply);
    });

    // Force refresh feed
    app.post('/:id/refresh', FeedsController.refresh);

    // Pause feed (skip from scheduler)
    app.post('/:id/pause', FeedsController.pause);

    // Resume feed (re-enable in scheduler)
    app.post('/:id/resume', FeedsController.resume);

    // Get feed info (detailed view)
    app.get('/:id/info', FeedsController.getInfo);

    // Force refresh feed icon (useful for YouTube channels)
    app.post('/:id/refresh-icon', FeedsController.refreshIcon);

    // Refetch all YouTube channel icons (one-time fix)
    app.post('/refetch-youtube-icons', FeedsController.refetchYouTubeIcons);
}
