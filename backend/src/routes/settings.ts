import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { run, db } from '../db/index.js';
import { getUserSettings, updateUserSettingsRaw, getUserSettingsRaw } from '../services/settings.js';

const updateSettingsSchema = z.object({
    refresh_interval_minutes: z.number().min(5).max(1440).optional(),
    retention_days: z.number().min(1).max(365).optional(),
    fetch_full_content: z.boolean().optional(),
    readability_enabled: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    font_size: z.enum(['small', 'medium', 'large']).optional(),
    show_images: z.boolean().optional(),
    accent_color: z.enum(['emerald', 'blue', 'indigo', 'violet', 'rose', 'amber']).optional(),
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
        const rawSettings = getUserSettingsRaw(userId);
        return {
            settings,
            global_next_refresh_at: rawSettings.global_next_refresh_at || null
        };
    });

    app.patch('/', async (request: FastifyRequest) => {
        const body = updateSettingsSchema.parse(request.body);
        ensureSettingsColumn();

        const currentSettings = getUserSettings(userId);
        const newSettings = { ...currentSettings, ...body };

        run(
            'UPDATE users SET settings_json = ? WHERE id = ?',
            [JSON.stringify(newSettings), userId]
        );

        if (body.refresh_interval_minutes !== undefined) {
            const interval = body.refresh_interval_minutes;
            run(
                `UPDATE feeds SET
                    refresh_interval_minutes = ?,
                    next_fetch_at = datetime('now', '+' || ? || ' minutes'),
                    updated_at = datetime('now')
                 WHERE user_id = ? AND deleted_at IS NULL`,
                [interval, interval, userId]
            );

            updateUserSettingsRaw(userId, {
                global_next_refresh_at: new Date(Date.now() + interval * 60 * 1000).toISOString(),
            });
        }

        return { settings: newSettings };
    });
}
