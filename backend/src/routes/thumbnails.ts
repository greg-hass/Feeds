import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../db/index.js';
import { createReadStream, existsSync } from 'node:fs';
import { getCachedThumbnailPath, resolveThumbnailMime } from '../services/thumbnail-cache.js';

interface ThumbnailRow {
    thumbnail_cached_path: string | null;
    thumbnail_cached_content_type: string | null;
    user_id: number;
    deleted_at: string | null;
}

export async function thumbnailsRoutes(app: FastifyInstance) {
    app.get('/:articleId', async (request: FastifyRequest<{ Params: { articleId: string } }>, reply: FastifyReply) => {
        const articleId = parseInt(request.params.articleId, 10);
        if (Number.isNaN(articleId)) {
            return reply.status(400).send({ error: 'Invalid article ID' });
        }

        const row = queryOne<ThumbnailRow>(
            `SELECT a.thumbnail_cached_path, a.thumbnail_cached_content_type, f.user_id, f.deleted_at
             FROM articles a
             JOIN feeds f ON f.id = a.feed_id
             WHERE a.id = ?`,
            [articleId]
        );

        if (!row || row.user_id !== 1 || row.deleted_at) {
            return reply.status(404).send({ error: 'Thumbnail not found' });
        }

        if (!row.thumbnail_cached_path) {
            return reply.status(404).send({ error: 'Thumbnail not cached yet' });
        }

        const filePath = getCachedThumbnailPath(row.thumbnail_cached_path);
        if (!existsSync(filePath)) {
            return reply.status(404).send({ error: 'Thumbnail missing' });
        }

        const mime = resolveThumbnailMime(row.thumbnail_cached_path, row.thumbnail_cached_content_type);
        reply.header('Content-Type', mime);
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        return reply.send(createReadStream(filePath));
    });
}
