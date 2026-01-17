import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { queryOne, run } from '../db/index.js';

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
    settings_json: string;
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

export async function settingsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', app.authenticate);

    // Get settings
    app.get('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;

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
    });

    // Update settings
    app.patch('/', async (request: FastifyRequest) => {
        const { id: userId } = (request as any).user;
        const body = updateSettingsSchema.parse(request.body);

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
    });
}
