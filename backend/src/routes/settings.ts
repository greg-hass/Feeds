import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { run, db } from '../db/index.js';
import { getUserSettings } from '../services/settings.js';
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
    accent_color: z.enum(['emerald', 'sky', 'indigo', 'purple', 'rose', 'orange', 'amber', 'lime', 'cyan', 'teal', 'slate']).optional(),
    font_family: z.enum(['sans', 'serif']).optional(),
    reader_theme: z.enum(['default', 'sepia', 'paper', 'dark']).optional(),
    reader_line_height: z.number().optional(),
    feed_fetch_limits: feedFetchLimitsSchema.optional(),
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
            global_next_refresh_at: refreshedRawSettings.nextRefreshAt
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
            global_next_refresh_at: globalNextRefreshAt,
        };
    });
}
