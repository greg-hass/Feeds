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

function toSqliteTimestamp(value: string): string {
    if (value.includes('T')) {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
        }
    }
    return value;
}

function decodeCursor(cursor: string | undefined): string {
    if (!cursor) return '1970-01-01 00:00:00';

    try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        return toSqliteTimestamp(decoded.last_sync_at);
    } catch {
        return '1970-01-01 00:00:00';
    }
}

function encodeCursor(serverTime: string): string {
    return Buffer.from(JSON.stringify({ last_sync_at: serverTime })).toString('base64');
}

function getEntityChanges(table: string, userId: number, lastSyncAt: string): {
    created: unknown[];
    updated: unknown[];
    deleted: number[];
} {
    const created = queryAll(
        `SELECT * FROM ${table} WHERE user_id = ? AND created_at > ? AND deleted_at IS NULL`,
        [userId, lastSyncAt]
    );
    const updated = queryAll(
        `SELECT * FROM ${table} WHERE user_id = ? AND updated_at > ? AND created_at <= ? AND deleted_at IS NULL`,
        [userId, lastSyncAt, lastSyncAt]
    );
    const deleted = queryAll<{ id: number }>(
        `SELECT id FROM ${table} WHERE user_id = ? AND deleted_at > ?`,
        [userId, lastSyncAt]
    ).map(row => row.id);

    return { created, updated, deleted };
}

export async function syncRoutes(app: FastifyInstance): Promise<void> {
    const userId = 1;

    app.get('/', async (request: FastifyRequest) => {
        const query = syncQuerySchema.parse(request.query);
        const include = new Set(query.include.split(','));
        const lastSyncAt = decodeCursor(query.cursor);
        const changes: Record<string, unknown> = {};

        if (include.has('feeds')) {
            changes.feeds = getEntityChanges('feeds', userId, lastSyncAt);
        }

        if (include.has('folders')) {
            changes.folders = getEntityChanges('folders', userId, lastSyncAt);
        }

        if (include.has('articles')) {
            const newArticles = queryAll(
                `SELECT a.* FROM articles a
                 JOIN feeds f ON f.id = a.feed_id
                 WHERE f.user_id = ? AND a.fetched_at > ? AND f.deleted_at IS NULL
                 ORDER BY a.fetched_at DESC
                 LIMIT 500`,
                [userId, lastSyncAt]
            );
            changes.articles = { created: newArticles, updated: [], deleted: [] };
        }

        if (include.has('read_state')) {
            const readChanges = queryAll<{ article_id: number; is_read: number }>(
                `SELECT article_id, is_read FROM read_state WHERE user_id = ? AND updated_at > ?`,
                [userId, lastSyncAt]
            );
            changes.read_state = {
                read: readChanges.filter(r => r.is_read).map(r => r.article_id),
                unread: readChanges.filter(r => !r.is_read).map(r => r.article_id),
            };
        }

        const serverTimeRow = queryOne<{ now: string }>("SELECT datetime('now') AS now");
        const serverTime = serverTimeRow?.now || new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
        return {
            changes,
            next_cursor: encodeCursor(serverTime),
            server_time: serverTime,
        };
    });

    app.post('/push', async (request: FastifyRequest) => {
        const body = pushChangesSchema.parse(request.body);
        const results = { read_state: { accepted: 0, rejected: 0 } };

        if (body.read_state) {
            for (const change of body.read_state) {
                try {
                    run(
                        `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
                         VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
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
