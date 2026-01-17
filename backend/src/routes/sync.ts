import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { queryAll, queryOne, run } from '../db/index.js';

const syncQuerySchema = z.object({
    cursor: z.string().optional(),
    include: z.string().default('feeds,folders,articles,read_state'),
});

const pushChangesSchema = z.object({
    read_state: z.array(z.object({
        article_id: z.number(),
        is_read: z.boolean(),
    })).optional(),
});

export async function syncRoutes(app: FastifyInstance) {
    app.addHook('preHandler', app.authenticate);

    // Get changes since cursor
    app.get('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        const query = syncQuerySchema.parse(request.query);
        const include = query.include.split(',');

        let lastSyncAt = '1970-01-01T00:00:00Z';
        if (query.cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(query.cursor, 'base64').toString());
                lastSyncAt = decoded.last_sync_at;
            } catch {
                // Invalid cursor, use epoch
            }
        }

        const changes: Record<string, unknown> = {};

        if (include.includes('feeds')) {
            const createdFeeds = queryAll(
                `SELECT * FROM feeds WHERE user_id = ? AND created_at > ? AND deleted_at IS NULL`,
                [userId, lastSyncAt]
            );
            const updatedFeeds = queryAll(
                `SELECT * FROM feeds WHERE user_id = ? AND updated_at > ? AND created_at <= ? AND deleted_at IS NULL`,
                [userId, lastSyncAt, lastSyncAt]
            );
            const deletedFeeds = queryAll<{ id: number }>(
                `SELECT id FROM feeds WHERE user_id = ? AND deleted_at > ?`,
                [userId, lastSyncAt]
            );

            changes.feeds = {
                created: createdFeeds,
                updated: updatedFeeds,
                deleted: deletedFeeds.map(f => f.id),
            };
        }

        if (include.includes('folders')) {
            const createdFolders = queryAll(
                `SELECT * FROM folders WHERE user_id = ? AND created_at > ? AND deleted_at IS NULL`,
                [userId, lastSyncAt]
            );
            const updatedFolders = queryAll(
                `SELECT * FROM folders WHERE user_id = ? AND updated_at > ? AND created_at <= ? AND deleted_at IS NULL`,
                [userId, lastSyncAt, lastSyncAt]
            );
            const deletedFolders = queryAll<{ id: number }>(
                `SELECT id FROM folders WHERE user_id = ? AND deleted_at > ?`,
                [userId, lastSyncAt]
            );

            changes.folders = {
                created: createdFolders,
                updated: updatedFolders,
                deleted: deletedFolders.map(f => f.id),
            };
        }

        if (include.includes('articles')) {
            // Only return new articles, not all of them
            const newArticles = queryAll(
                `SELECT a.* FROM articles a
         JOIN feeds f ON f.id = a.feed_id
         WHERE f.user_id = ? AND a.fetched_at > ? AND f.deleted_at IS NULL
         ORDER BY a.fetched_at DESC
         LIMIT 500`,
                [userId, lastSyncAt]
            );

            changes.articles = {
                created: newArticles,
                updated: [],
                deleted: [],
            };
        }

        if (include.includes('read_state')) {
            const readChanges = queryAll<{ article_id: number; is_read: number }>(
                `SELECT article_id, is_read FROM read_state
         WHERE user_id = ? AND updated_at > ?`,
                [userId, lastSyncAt]
            );

            changes.read_state = {
                read: readChanges.filter(r => r.is_read).map(r => r.article_id),
                unread: readChanges.filter(r => !r.is_read).map(r => r.article_id),
            };
        }

        const serverTime = new Date().toISOString();
        const nextCursor = Buffer.from(JSON.stringify({
            last_sync_at: serverTime,
        })).toString('base64');

        return {
            changes,
            next_cursor: nextCursor,
            server_time: serverTime,
        };
    });

    // Push local changes
    app.post('/push', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        const body = pushChangesSchema.parse(request.body);

        const results = {
            read_state: { accepted: 0, rejected: 0 },
        };

        if (body.read_state) {
            for (const change of body.read_state) {
                try {
                    run(
                        `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
             VALUES (?, ?, ?, datetime("now"), datetime("now"))`,
                        [userId, change.article_id, change.is_read ? 1 : 0]
                    );
                    results.read_state.accepted++;
                } catch {
                    results.read_state.rejected++;
                }
            }
        }

        return results;
    });
}
