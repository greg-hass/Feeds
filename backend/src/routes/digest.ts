import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryOne, queryAll, run } from '../db/index.js';
import { generateDailyDigest } from '../services/digest.js';

const updateSettingsSchema = z.object({
    enabled: z.boolean().optional(),
    schedule: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    included_feeds: z.array(z.number()).nullable().optional(),
    style: z.enum(['bullets', 'paragraphs']).optional()
});

export async function digestRoutes(app: FastifyInstance) {
    const userId = 1;

    // Get latest digest
    app.get('/', async (request: FastifyRequest) => {
        const digest = queryOne(
            'SELECT * FROM digests WHERE user_id = ? ORDER BY generated_at DESC LIMIT 1',
            [userId]
        );
        return { digest };
    });

    // Generate new digest on-demand
    app.post('/generate', async (request: FastifyRequest, reply: FastifyReply) => {
        const success = await generateDailyDigest(userId);
        if (success) {
            const digest = queryOne(
                'SELECT * FROM digests WHERE user_id = ? ORDER BY generated_at DESC LIMIT 1',
                [userId]
            );
            return { success: true, digest };
        } else {
            // Check if failure was due to disabled settings
            const settings = queryOne<{ enabled: number }>('SELECT enabled FROM digest_settings WHERE user_id = ?', [userId]);
            if (settings && !settings.enabled) {
                return reply.status(400).send({ error: 'Daily Digest is disabled. Please enable it in settings.' });
            }
            return reply.status(500).send({ error: 'Failed to generate digest. Check server logs.' });
        }
    });

    // Get digest settings
    app.get('/settings', async (request: FastifyRequest) => {
        interface RawSettings {
            user_id: number;
            enabled: number;
            schedule: string;
            included_feeds: string | null;
            style: string;
        }

        let settings = queryOne<RawSettings>(
            'SELECT * FROM digest_settings WHERE user_id = ?',
            [userId]
        );

        if (!settings) {
            // Initialize default settings if not exists
            run(
                'INSERT INTO digest_settings (user_id, enabled, schedule, style) VALUES (?, 1, "06:00", "bullets")',
                [userId]
            );
            settings = queryOne<RawSettings>(
                'SELECT * FROM digest_settings WHERE user_id = ?',
                [userId]
            );
        }

        if (!settings) {
            throw new Error('Failed to load digest settings');
        }

        return {
            settings: {
                ...settings,
                enabled: Boolean(settings.enabled),
                included_feeds: settings.included_feeds ? JSON.parse(settings.included_feeds) : null
            }
        };
    });

    // Update digest settings
    app.put('/settings', async (request: FastifyRequest) => {
        const body = updateSettingsSchema.parse(request.body);

        const current = queryOne('SELECT * FROM digest_settings WHERE user_id = ?', [userId]);
        if (!current) {
            run(
                'INSERT INTO digest_settings (user_id, enabled, schedule, style) VALUES (?, 1, "06:00", "bullets")',
                [userId]
            );
        }

        const updates: string[] = [];
        const params: any[] = [];

        if (body.enabled !== undefined) {
            updates.push('enabled = ?');
            params.push(body.enabled ? 1 : 0);
        }
        if (body.schedule !== undefined) {
            updates.push('schedule = ?');
            params.push(body.schedule);
        }
        if (body.included_feeds !== undefined) {
            updates.push('included_feeds = ?');
            params.push(body.included_feeds ? JSON.stringify(body.included_feeds) : null);
        }
        if (body.style !== undefined) {
            updates.push('style = ?');
            params.push(body.style);
        }

        if (updates.length > 0) {
            params.push(userId);
            run(
                `UPDATE digest_settings SET ${updates.join(', ')} WHERE user_id = ?`,
                params
            );
        }

        return { success: true };
    });
}
