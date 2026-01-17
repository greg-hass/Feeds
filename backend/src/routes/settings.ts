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
        console.log('[Settings] Ensuring settings_json column exists...');
        db().exec("ALTER TABLE users ADD COLUMN settings_json TEXT DEFAULT '{}'");
        console.log('[Settings] Added settings_json column successfully');
        columnEnsured = true;
    } catch (err: any) {
        // Column already exists - this is fine
        if (err?.message?.includes('duplicate column')) {
            console.log('[Settings] settings_json column already exists');
            columnEnsured = true;
        } else {
            console.error('[Settings] Error ensuring column:', err);
            // Don't throw - let the query fail naturally if there's a real issue
        }
    }
}

export async function settingsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', app.authenticate);

    // Get settings
    app.get('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        console.log('[Settings] GET settings for user:', userId);

        ensureSettingsColumn();

        try {
            // Try to get settings, falling back to just user id if column doesn't exist
            let user: User | undefined;
            try {
                user = queryOne<User>('SELECT id, settings_json FROM users WHERE id = ?', [userId]);
            } catch (err: any) {
                console.log('[Settings] Query error, trying without settings_json:', err?.message);
                // Column might not exist, try without it
                user = queryOne<User>('SELECT id FROM users WHERE id = ?', [userId]);
            }

            if (!user) {
                console.log('[Settings] User not found:', userId);
                return { settings: defaultSettings };
            }

            let settings = { ...defaultSettings };
            if (user.settings_json) {
                try {
                    settings = { ...settings, ...JSON.parse(user.settings_json) };
                } catch {
                    console.log('[Settings] Failed to parse settings_json, using defaults');
                }
            }

            console.log('[Settings] Returning settings:', settings);
            return { settings };
        } catch (err: any) {
            console.error('[Settings] Error in GET:', err);
            return { settings: defaultSettings };
        }
    });

    // Update settings
    app.patch('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        console.log('[Settings] PATCH settings for user:', userId, 'body:', request.body);

        let body;
        try {
            body = updateSettingsSchema.parse(request.body);
        } catch (err: any) {
            console.error('[Settings] Validation error:', err);
            throw err;
        }

        ensureSettingsColumn();

        try {
            // Get current settings
            let currentSettingsJson = '{}';
            try {
                const user = queryOne<{ settings_json?: string }>('SELECT settings_json FROM users WHERE id = ?', [userId]);
                if (user?.settings_json) {
                    currentSettingsJson = user.settings_json;
                }
            } catch (err: any) {
                console.log('[Settings] Could not read current settings:', err?.message);
            }

            let currentSettings = { ...defaultSettings };
            try {
                currentSettings = { ...currentSettings, ...JSON.parse(currentSettingsJson) };
            } catch {
                // Use defaults
            }

            const newSettings = { ...currentSettings, ...body };
            console.log('[Settings] New settings:', newSettings);

            run(
                'UPDATE users SET settings_json = ? WHERE id = ?',
                [JSON.stringify(newSettings), userId]
            );

            console.log('[Settings] Settings updated successfully');
            return { settings: newSettings };
        } catch (err: any) {
            console.error('[Settings] Error in PATCH:', err);
            throw err;
        }
    });
}
