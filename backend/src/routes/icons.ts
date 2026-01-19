import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../db/index.js';
import { createReadStream, existsSync } from 'node:fs';
import { getCachedIconPath, resolveIconMime } from '../services/icon-cache.js';

interface IconFeedRow {
    icon_cached_path: string | null;
    icon_cached_content_type: string | null;
    user_id: number;
    deleted_at: string | null;
}

export async function iconsRoutes(app: FastifyInstance) {
    app.get('/:feedId', async (request: FastifyRequest<{ Params: { feedId: string } }>, reply: FastifyReply) => {
        const feedId = parseInt(request.params.feedId, 10);
        if (Number.isNaN(feedId)) {
            return reply.status(400).send({ error: 'Invalid feed ID' });
        }

        const feed = queryOne<IconFeedRow>(
            'SELECT icon_cached_path, icon_cached_content_type, user_id, deleted_at FROM feeds WHERE id = ?',
            [feedId]
        );

        if (!feed || feed.user_id !== 1 || feed.deleted_at) {
            return reply.status(404).send({ error: 'Icon not found' });
        }

        if (!feed.icon_cached_path) {
            return reply.status(404).send({ error: 'Icon not cached yet' });
        }

        const filePath = getCachedIconPath(feed.icon_cached_path);
        if (!existsSync(filePath)) {
            return reply.status(404).send({ error: 'Icon missing' });
        }

        const mime = resolveIconMime(feed.icon_cached_path, feed.icon_cached_content_type);
        reply.header('Content-Type', mime);
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        return reply.send(createReadStream(filePath));
    });
}
