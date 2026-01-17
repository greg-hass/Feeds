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

// Track if we've already ensured the column exists this session
let columnEnsured = false;

// Helper to add settings_json column if missing (idempotent)
function ensureSettingsColumn(): void {
    if (columnEnsured) return;

    try {
        db().exec("ALTER TABLE users ADD COLUMN settings_json TEXT DEFAULT '{}'");
        columnEnsured = true;
    } catch (err: any) {
        // Column already exists - this is fine
        if (err?.message?.includes('duplicate column')) {
            columnEnsured = true;
        } else {
            console.error('Failed to ensure settings_json column:', err);
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
            let user: User | undefined;
            try {
                user = queryOne<User>('SELECT id, settings_json FROM users WHERE id = ?', [userId]);
            } catch {
                user = queryOne<User>('SELECT id FROM users WHERE id = ?', [userId]);
            }

            if (!user) {
                return { settings: defaultSettings };
            }

            let settings = { ...defaultSettings };
            if (user.settings_json) {
                try {
                    settings = { ...settings, ...JSON.parse(user.settings_json) };
                } catch {
                    // Use defaults
                }
            }

            return { settings };
        } catch (err: any) {
            console.error('Error fetching settings:', err);
            return { settings: defaultSettings };
        }
    });

    // Update settings
    app.patch('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        const body = updateSettingsSchema.parse(request.body);

        ensureSettingsColumn();

        try {
            let currentSettingsJson = '{}';
            try {
                const user = queryOne<{ settings_json?: string }>('SELECT settings_json FROM users WHERE id = ?', [userId]);
                if (user?.settings_json) {
                    currentSettingsJson = user.settings_json;
                }
            } catch {
                // Column might not exist, use defaults
            }

            let currentSettings = { ...defaultSettings };
            try {
                currentSettings = { ...currentSettings, ...JSON.parse(currentSettingsJson) };
            } catch {
                // Use defaults
            }

            const newSettings = { ...currentSettings, ...body };

            run(
                'UPDATE users SET settings_json = ? WHERE id = ?',
                [JSON.stringify(newSettings), userId]
            );

            return { settings: newSettings };
        } catch (err: any) {
            console.error('Error updating settings:', err);
            throw err;
        }
    });
}
