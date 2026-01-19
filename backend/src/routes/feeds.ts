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
    app.post('/', {
        schema: {
            body: addFeedSchema,
        },
    }, FeedsController.add);

    // Update feed
    app.patch('/:id', {
        schema: {
            body: updateFeedSchema,
        },
    }, FeedsController.update);

    // Delete feed
    app.delete('/:id', FeedsController.delete);

    // Bulk operations
    app.post('/bulk', {
        schema: {
            body: bulkActionSchema,
        },
    }, FeedsController.bulk);

    // Force refresh feed
    app.post('/:id/refresh', FeedsController.refresh);
}
