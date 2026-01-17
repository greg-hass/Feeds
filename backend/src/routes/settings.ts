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

interface User {
    id: number;
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

// Helper to check if settings_json column exists
function hasSettingsColumn(): boolean {
    try {
        const result = db().prepare("PRAGMA table_info(users)").all() as { name: string }[];
        return result.some(col => col.name === 'settings_json');
    } catch {
        return false;
    }
}

// Helper to add settings_json column if missing
function ensureSettingsColumn(): void {
    if (!hasSettingsColumn()) {
        try {
            db().exec("ALTER TABLE users ADD COLUMN settings_json TEXT DEFAULT '{}'");
            console.log('Added settings_json column to users table');
        } catch (err: any) {
            // Column might already exist (race condition)
            if (!err?.message?.includes('duplicate column')) {
                console.error('Failed to add settings_json column:', err);
            }
        }
    }
}

export async function settingsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', app.authenticate);

    // Get settings
    app.get('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;

        ensureSettingsColumn();

        try {
            const user = queryOne<User>('SELECT settings_json FROM users WHERE id = ?', [userId]);

            let settings = { ...defaultSettings };
            if (user?.settings_json) {
                try {
                    settings = { ...settings, ...JSON.parse(user.settings_json) };
                } catch {
                    // Use defaults
                }
            }

            return { settings };
        } catch (err: any) {
            console.error('Error fetching settings:', err);
            // If column doesn't exist, return defaults
            if (err?.message?.includes('no such column')) {
                return { settings: defaultSettings };
            }
            throw err;
        }
    });

    // Update settings
    app.patch('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        const body = updateSettingsSchema.parse(request.body);

        ensureSettingsColumn();

        try {
            const user = queryOne<User>('SELECT settings_json FROM users WHERE id = ?', [userId]);

            let currentSettings = { ...defaultSettings };
            if (user?.settings_json) {
                try {
                    currentSettings = { ...currentSettings, ...JSON.parse(user.settings_json) };
                } catch {
                    // Use defaults
                }
            }

            const newSettings = { ...currentSettings, ...body };

            run(
                'UPDATE users SET settings_json = ?, updated_at = datetime("now") WHERE id = ?',
                [JSON.stringify(newSettings), userId]
            );

            return { settings: newSettings };
        } catch (err: any) {
            console.error('Error updating settings:', err);
            throw err;
        }
    });
}
