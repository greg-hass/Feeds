import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { run, db, queryAll, queryOne } from '../db/index.js';
import { getUserSettings, updateUserSettingsRaw } from '../services/settings.js';
import { getGlobalRefreshSchedule, scheduleNextGlobalRefresh } from '../services/refresh-schedule.js';
import { cleanupOldArticles } from '../services/feed-cleanup.js';

const feedFetchLimitsSchema = z.object({
    rss_days: z.number().min(1).max(365).optional(),
    youtube_count: z.number().min(1).max(100).optional(),
    youtube_days: z.number().min(1).max(365).optional(),
    reddit_days: z.number().min(1).max(365).optional(),
    podcast_count: z.number().min(1).max(100).optional(),
});

const updateSettingsSchema = z.object({
    refresh_interval_minutes: z.number().min(5).max(1440).optional(),
    retention_days: z.number().min(1).max(365).optional(),
    fetch_full_content: z.boolean().optional(),
    readability_enabled: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    font_size: z.enum(['small', 'medium', 'large']).optional(),
    show_images: z.boolean().optional(),
    keep_screen_awake: z.boolean().optional(),
    reader_width: z.enum(['narrow', 'comfortable', 'wide']).optional(),
    accent_color: z.enum(['emerald', 'sky', 'indigo', 'purple', 'rose', 'orange', 'amber', 'lime', 'cyan', 'teal', 'slate']).optional(),
    font_family: z.enum(['sans', 'serif']).optional(),
    reader_theme: z.enum(['default', 'sepia', 'paper', 'dark']).optional(),
    reader_line_height: z.number().optional(),
    feed_fetch_limits: feedFetchLimitsSchema.optional(),
});

const restoreBackupSchema = z.object({
    exported_at: z.string().optional(),
    settings: updateSettingsSchema.partial().passthrough(),
    global_last_refresh_at: z.string().nullable().optional(),
    global_next_refresh_at: z.string().nullable().optional(),
    bookmarks: z.array(z.object({
        guid: z.string().optional().nullable(),
        url: z.string().optional().nullable(),
        title: z.string().optional().nullable(),
        published_at: z.string().optional().nullable(),
    })).optional(),
});

// Track if we've already ensured the column exists this session
let columnEnsured = false;

function ensureSettingsColumn(): void {
    if (columnEnsured) return;

    try {
        db().exec("ALTER TABLE users ADD COLUMN settings_json TEXT DEFAULT '{}'");
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '';
        if (!message.includes('duplicate column')) {
            console.error('Failed to ensure settings_json column:', err);
        }
    }
    columnEnsured = true;
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
    const userId = 1;

    app.get('/', async () => {
        ensureSettingsColumn();
        const settings = getUserSettings(userId);
        const refreshedRawSettings = getGlobalRefreshSchedule(userId);
        return {
            settings,
            global_last_refresh_at: refreshedRawSettings.lastRefreshAt,
            global_next_refresh_at: refreshedRawSettings.nextRefreshAt
        };
    });

    app.get('/export', async () => {
        ensureSettingsColumn();
        const settings = getUserSettings(userId);
        const schedule = getGlobalRefreshSchedule(userId);
        return {
            exported_at: new Date().toISOString(),
            settings,
            global_last_refresh_at: schedule.lastRefreshAt,
            global_next_refresh_at: schedule.nextRefreshAt,
        };
    });

    app.get('/backup', async () => {
        ensureSettingsColumn();
        const settings = getUserSettings(userId);
        const schedule = getGlobalRefreshSchedule(userId);
        const bookmarks = queryAll<{
            guid: string;
            url: string | null;
            title: string;
            published_at: string | null;
            feed_title: string;
            feed_type: string;
        }>(
            `SELECT 
                a.guid,
                a.url,
                a.title,
                a.published_at,
                f.title as feed_title,
                f.type as feed_type
             FROM articles a
             JOIN feeds f ON f.id = a.feed_id
             WHERE f.user_id = ? AND f.deleted_at IS NULL AND f.paused_at IS NULL AND a.is_bookmarked = 1
             ORDER BY a.published_at DESC
             LIMIT 1000`,
            [userId]
        );

        return {
            exported_at: new Date().toISOString(),
            settings,
            global_last_refresh_at: schedule.lastRefreshAt,
            global_next_refresh_at: schedule.nextRefreshAt,
            bookmarks,
        };
    });

    app.post('/backup', async (request: FastifyRequest) => {
        ensureSettingsColumn();
        const body = restoreBackupSchema.parse(request.body);

        const restoredSettings = {
            ...getUserSettings(userId),
            ...body.settings,
        };

        updateUserSettingsRaw(userId, restoredSettings);

        if (body.global_last_refresh_at !== undefined || body.global_next_refresh_at !== undefined) {
            updateUserSettingsRaw(userId, {
                global_last_refresh_at: body.global_last_refresh_at ?? null,
                global_next_refresh_at: body.global_next_refresh_at ?? null,
            });
        }

        let restoredBookmarks = 0;
        if (body.bookmarks?.length) {
            for (const bookmark of body.bookmarks) {
                const article = queryOne<{ id: number }>(
                    `SELECT a.id
                     FROM articles a
                     JOIN feeds f ON f.id = a.feed_id
                     WHERE f.user_id = ? AND f.deleted_at IS NULL AND (a.guid = ? OR a.url = ?)
                     ORDER BY a.published_at DESC
                     LIMIT 1`,
                    [userId, bookmark.guid ?? null, bookmark.url ?? null]
                );

                if (!article) continue;

                run('UPDATE articles SET is_bookmarked = 1 WHERE id = ?', [article.id]);
                restoredBookmarks++;
            }
        }

        if (body.global_last_refresh_at === undefined && body.global_next_refresh_at === undefined && body.settings.refresh_interval_minutes !== undefined) {
            scheduleNextGlobalRefresh(userId, body.settings.refresh_interval_minutes);
        }

        return {
            success: true,
            restored: {
                settings: true,
                bookmarks: restoredBookmarks,
            },
        };
    });

    app.patch('/', async (request: FastifyRequest) => {
        const body = updateSettingsSchema.parse(request.body);
        ensureSettingsColumn();

        const currentSettings = getUserSettings(userId);
        const currentSchedule = getGlobalRefreshSchedule(userId);
        const newSettings = {
            ...currentSettings,
            ...body,
        };

        run(
            'UPDATE users SET settings_json = ? WHERE id = ?',
            [JSON.stringify(newSettings), userId]
        );

        let globalNextRefreshAt = currentSchedule.nextRefreshAt;
        if (body.refresh_interval_minutes !== undefined) {
            globalNextRefreshAt = scheduleNextGlobalRefresh(userId, body.refresh_interval_minutes).nextRefreshAt;
        }

        // If feed fetch limits changed, clean up old articles retroactively
        if (body.feed_fetch_limits !== undefined) {
            // Run cleanup asynchronously without blocking the response
            cleanupOldArticles(userId).catch(err => {
                console.error('[Settings] Failed to cleanup old articles:', err);
            });
        }

        return {
            settings: newSettings,
            global_last_refresh_at: currentSchedule.lastRefreshAt,
            global_next_refresh_at: globalNextRefreshAt,
        };
    });
}
