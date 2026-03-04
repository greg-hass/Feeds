import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { queryAll, queryOne, run } from '../db/index.js';
import { isRefreshing } from '../services/scheduler.js';

const ARTICLE_SYNC_LIMIT = 500;
const ICON_ENDPOINT_PREFIX = '/api/v1/icons';
const THUMBNAIL_ENDPOINT_PREFIX = '/api/v1/thumbnails';

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
            // Keep milliseconds if present (YYYY-MM-DD HH:MM:SS.SSS)
            return parsed.toISOString().replace('T', ' ').replace('Z', '');
        }
    }
    return value;
}

interface SyncCursor {
    last_sync_at: string;
    window_end?: string;
    article_fetched_at?: string;
    article_id?: number;
    partial_articles?: boolean;
}

function decodeCursor(cursor: string | undefined): SyncCursor {
    if (!cursor) {
        return { last_sync_at: '1970-01-01 00:00:00.000' };
    }

    try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        return {
            last_sync_at: toSqliteTimestamp(decoded.last_sync_at),
            window_end: decoded.window_end ? toSqliteTimestamp(decoded.window_end) : undefined,
            article_fetched_at: decoded.article_fetched_at ? toSqliteTimestamp(decoded.article_fetched_at) : undefined,
            article_id: typeof decoded.article_id === 'number' ? decoded.article_id : undefined,
            partial_articles: Boolean(decoded.partial_articles),
        };
    } catch {
        return { last_sync_at: '1970-01-01 00:00:00.000' };
    }
}

function encodeCursor(cursor: SyncCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

function getEntityChanges(table: string, userId: number, lastSyncAt: string, upperBound: string): {
    created: unknown[];
    updated: unknown[];
    deleted: number[];
} {
    const created = queryAll(
        `SELECT * FROM ${table} WHERE user_id = ? AND created_at > ? AND created_at <= ? AND deleted_at IS NULL`,
        [userId, lastSyncAt, upperBound]
    );
    const updated = queryAll(
        `SELECT * FROM ${table} WHERE user_id = ? AND updated_at > ? AND updated_at <= ? AND created_at <= ? AND deleted_at IS NULL`,
        [userId, lastSyncAt, upperBound, lastSyncAt]
    );
    const deleted = queryAll<{ id: number }>(
        `SELECT id FROM ${table} WHERE user_id = ? AND deleted_at > ? AND deleted_at <= ?`,
        [userId, lastSyncAt, upperBound]
    ).map(row => row.id);

    return { created, updated, deleted };
}

function resolveFeedIconUrl(feedId: number, cachedPath: string | null, fallback: string | null): string | null {
    if (cachedPath) {
        return `${ICON_ENDPOINT_PREFIX}/${feedId}`;
    }

    return fallback;
}

function resolveThumbnailUrl(articleId: number, cachedPath: string | null, fallback: string | null): string | null {
    if (cachedPath) {
        return `${THUMBNAIL_ENDPOINT_PREFIX}/${articleId}`;
    }

    return fallback;
}

export async function syncRoutes(app: FastifyInstance): Promise<void> {
    const userId = 1;

    app.get('/', async (request: FastifyRequest) => {
        const query = syncQuerySchema.parse(request.query);
        const include = new Set(query.include.split(','));
        const cursor = decodeCursor(query.cursor);
        const lastSyncAt = cursor.last_sync_at;
        const changes: Record<string, unknown> = {};
        const serverTimeRow = queryOne<{ now: string }>("SELECT STRFTIME('%Y-%m-%d %H:%M:%f', 'now') AS now");
        const serverTime = serverTimeRow?.now || new Date().toISOString().replace('T', ' ').replace('Z', '');
        const upperBound = cursor.window_end ?? serverTime;

        if (include.has('feeds')) {
            changes.feeds = getEntityChanges('feeds', userId, lastSyncAt, upperBound);
        }

        if (include.has('folders')) {
            changes.folders = getEntityChanges('folders', userId, lastSyncAt, upperBound);
        }

        let nextCursor: SyncCursor = { last_sync_at: upperBound };

        if (include.has('articles')) {
            const articleParams: Array<string | number> = [userId, lastSyncAt, upperBound];
            let articleCursorCondition = '';

            if (cursor.partial_articles && cursor.article_fetched_at && cursor.article_id) {
                articleCursorCondition = 'AND (a.fetched_at < ? OR (a.fetched_at = ? AND a.id < ?))';
                articleParams.push(cursor.article_fetched_at, cursor.article_fetched_at, cursor.article_id);
            }

            articleParams.push(ARTICLE_SYNC_LIMIT + 1);

            const syncedArticles = queryAll<{
                id: number;
                feed_id: number;
                title: string;
                url: string | null;
                author: string | null;
                summary: string | null;
                published_at: string | null;
                enclosure_url: string | null;
                thumbnail_url: string | null;
                thumbnail_cached_path: string | null;
                feed_title: string;
                feed_icon_url: string | null;
                feed_icon_cached_path: string | null;
                feed_type: 'rss' | 'youtube' | 'reddit' | 'podcast';
                is_read: number | null;
                is_bookmarked: number;
                fetched_at: string;
            }>(
                `SELECT
                    a.id,
                    a.feed_id,
                    a.title,
                    a.url,
                    a.author,
                    a.summary,
                    a.published_at,
                    a.enclosure_url,
                    a.thumbnail_url,
                    a.thumbnail_cached_path,
                    a.fetched_at,
                    COALESCE(a.is_bookmarked, 0) as is_bookmarked,
                    f.title as feed_title,
                    f.icon_url as feed_icon_url,
                    f.icon_cached_path as feed_icon_cached_path,
                    f.type as feed_type,
                    rs.is_read
                 FROM articles a
                 JOIN feeds f ON f.id = a.feed_id
                 LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
                 WHERE f.user_id = ?
                   AND a.fetched_at > ?
                   AND a.fetched_at <= ?
                   AND f.deleted_at IS NULL
                   ${articleCursorCondition}
                 ORDER BY a.fetched_at DESC, a.id DESC
                 LIMIT ?`,
                [userId, ...articleParams]
            );

            const hasMoreArticles = syncedArticles.length > ARTICLE_SYNC_LIMIT;
            if (hasMoreArticles) {
                syncedArticles.pop();
                const lastArticle = syncedArticles[syncedArticles.length - 1];
                nextCursor = {
                    last_sync_at: lastSyncAt,
                    window_end: upperBound,
                    article_fetched_at: lastArticle?.fetched_at,
                    article_id: lastArticle?.id,
                    partial_articles: true,
                };
            }

            changes.articles = {
                created: syncedArticles.map((article) => ({
                    id: article.id,
                    feed_id: article.feed_id,
                    feed_title: article.feed_title,
                    feed_icon_url: resolveFeedIconUrl(article.feed_id, article.feed_icon_cached_path, article.feed_icon_url),
                    feed_type: article.feed_type,
                    title: article.title,
                    url: article.url,
                    author: article.author,
                    summary: article.summary,
                    published_at: article.published_at,
                    is_read: Boolean(article.is_read),
                    is_bookmarked: Boolean(article.is_bookmarked),
                    has_audio: Boolean(article.enclosure_url),
                    enclosure_url: article.enclosure_url,
                    thumbnail_url: resolveThumbnailUrl(article.id, article.thumbnail_cached_path, article.thumbnail_url),
                })),
                updated: [],
                deleted: [],
            };
        }

        if (include.has('read_state')) {
            const readChanges = queryAll<{ article_id: number; is_read: number }>(
                `SELECT article_id, is_read
                 FROM read_state
                 WHERE user_id = ? AND updated_at > ? AND updated_at <= ?`,
                [userId, lastSyncAt, upperBound]
            );
            changes.read_state = {
                read: readChanges.filter(r => r.is_read).map(r => r.article_id),
                unread: readChanges.filter(r => !r.is_read).map(r => r.article_id),
            };
        }

        return {
            changes,
            next_cursor: encodeCursor(nextCursor),
            server_time: serverTime,
            is_refreshing: isRefreshing(),
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
                         VALUES (?, ?, ?, STRFTIME('%Y-%m-%d %H:%M:%f', 'now'), STRFTIME('%Y-%m-%d %H:%M:%f', 'now'))`,
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
