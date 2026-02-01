import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../db/index.js';
import { createReadStream, existsSync } from 'node:fs';
import { getCachedIconPath, resolveIconMime } from '../services/icon-cache.js';
import { stat } from 'node:fs/promises';

interface IconFeedRow {
    icon_cached_path: string | null;
    icon_cached_content_type: string | null;
    icon_url: string | null;
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
            'SELECT icon_cached_path, icon_cached_content_type, icon_url, user_id, deleted_at FROM feeds WHERE id = ?',
            [feedId]
        );

        if (!feed || feed.user_id !== 1 || feed.deleted_at) {
            return reply.status(404).send({ error: 'Icon not found' });
        }

        if (!feed.icon_cached_path) {
            if (feed.icon_url) {
                return reply.redirect(302, feed.icon_url);
            }
            return reply.status(404).send({ error: 'Icon not cached yet' });
        }

        const filePath = getCachedIconPath(feed.icon_cached_path);
        if (!filePath) {
            return reply.status(400).send({ error: 'Invalid icon path' });
        }
        if (!existsSync(filePath)) {
            if (feed.icon_url) {
                return reply.redirect(302, feed.icon_url);
            }
            return reply.status(404).send({ error: 'Icon missing' });
        }

        const mime = resolveIconMime(feed.icon_cached_path, feed.icon_cached_content_type);
        
        // Get file stats for ETag
        try {
            const stats = await stat(filePath);
            const etag = `W/"${stats.mtimeMs.toString(16)}-${stats.size.toString(16)}"`;
            
            if (request.headers['if-none-match'] === etag) {
                return reply.status(304).send();
            }
            
            reply.header('Content-Type', mime);
            reply.header('Cache-Control', 'public, max-age=0, must-revalidate');
            reply.header('ETag', etag);
            reply.header('Last-Modified', stats.mtime.toUTCString());
            
            return reply.send(createReadStream(filePath));
        } catch (err) {
            // File might have been deleted in race condition
            return reply.status(404).send({ error: 'Icon file missing' });
        }
    });
}
