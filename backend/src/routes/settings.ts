import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { queryOne, run, db } from '../db/index.js';

const updateSettingsSchema = z.object({
    refresh_interval_minutes: z.number().min(5).max(1440).optional(),
    retention_days: z.number().min(1).max(365).optional(),
    fetch_full_content: z.boolean().optional(),
    readability_enabled: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    font_size: z.enum(['small', 'medium', 'large']).optional(),
    show_images: z.boolean().optional(),
});

interface UserSettings {
    settings_json?: string;
}

const defaultSettings = {
    refresh_interval_minutes: 30,
    retention_days: 90,
    fetch_full_content: true,
    readability_enabled: true,
    theme: 'auto' as const,
    font_size: 'medium' as const,
    show_images: true,
};

type Settings = typeof defaultSettings;

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

function parseSettingsJson(json: string | undefined): Settings {
    if (!json) return { ...defaultSettings };

    try {
        return { ...defaultSettings, ...JSON.parse(json) };
    } catch {
        return { ...defaultSettings };
    }
}

function getUserSettings(userId: number): Settings {
    try {
        const user = queryOne<UserSettings>('SELECT settings_json FROM users WHERE id = ?', [userId]);
        return parseSettingsJson(user?.settings_json);
    } catch {
        return { ...defaultSettings };
    }
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
    const userId = 1;

    app.get('/', async () => {
        ensureSettingsColumn();
        return { settings: getUserSettings(userId) };
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

        return { settings: newSettings };
    });
}
