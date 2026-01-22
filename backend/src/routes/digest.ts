import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryOne, queryAll, run } from '../db/index.js';
import { generateDailyDigest } from '../services/digest.js';

const updateSettingsSchema = z.object({
    enabled: z.boolean().optional(),
    schedule_morning: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    schedule_evening: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    included_feeds: z.array(z.number()).nullable().optional(),
    style: z.enum(['bullets', 'paragraphs']).optional()
});

interface Digest {
    id: number;
    user_id: number;
    content: string;
    article_count: number;
    feed_count: number;
    edition: string | null;
    title: string | null;
    topics: string | null;
    generated_at: string;
}

export async function digestRoutes(app: FastifyInstance) {
    const userId = 1;

    // Get latest digest
    app.get('/', async (request: FastifyRequest) => {
        const digest = queryOne<Digest>(
            'SELECT * FROM digests WHERE user_id = ? ORDER BY generated_at DESC LIMIT 1',
            [userId]
        );
        
        if (digest && digest.topics) {
            return { 
                digest: {
                    ...digest,
                    topics: JSON.parse(digest.topics)
                }
            };
        }
        return { digest };
    });

    // Get pending digest (latest that hasn't been dismissed)
    app.get('/pending', async (request: FastifyRequest) => {
        const settings = queryOne<{ last_dismissed_digest_id: number | null }>(
            'SELECT last_dismissed_digest_id FROM digest_settings WHERE user_id = ?',
            [userId]
        );

        const lastDismissedId = settings?.last_dismissed_digest_id || 0;

        const digest = queryOne<Digest>(
            `SELECT * FROM digests 
             WHERE user_id = ? AND id > ? 
             ORDER BY generated_at DESC LIMIT 1`,
            [userId, lastDismissedId]
        );

        if (digest && digest.topics) {
            return { 
                digest: {
                    ...digest,
                    topics: JSON.parse(digest.topics)
                }
            };
        }
        return { digest };
    });

    // Dismiss a digest (hide from timeline)
    app.post('/dismiss/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const digestId = parseInt(request.params.id, 10);
        
        if (isNaN(digestId)) {
            return reply.status(400).send({ error: 'Invalid digest ID' });
        }

        run(
            'UPDATE digest_settings SET last_dismissed_digest_id = ? WHERE user_id = ?',
            [digestId, userId]
        );

        return { success: true };
    });

    // Generate new digest on-demand
    app.post('/generate', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await generateDailyDigest(userId);
        if (result.success) {
            const digest = queryOne<Digest>(
                'SELECT * FROM digests WHERE user_id = ? ORDER BY generated_at DESC LIMIT 1',
                [userId]
            );
            
            if (digest && digest.topics) {
                return { 
                    success: true, 
                    digest: {
                        ...digest,
                        topics: JSON.parse(digest.topics)
                    }
                };
            }
            return { success: true, digest };
        } else {
            if (result.error === 'Digest is disabled') {
                return reply.status(400).send({ error: 'Daily Digest is disabled. Please enable it in settings.' });
            }
            return reply.status(500).send({ error: result.error || 'Failed to generate digest. Check server logs.' });
        }
    });

    // Get digest settings
    app.get('/settings', async (request: FastifyRequest) => {
        interface RawSettings {
            user_id: number;
            enabled: number;
            schedule: string;
            schedule_morning: string | null;
            schedule_evening: string | null;
            included_feeds: string | null;
            style: string;
            last_dismissed_digest_id: number | null;
        }

        let settings = queryOne<RawSettings>(
            'SELECT * FROM digest_settings WHERE user_id = ?',
            [userId]
        );

        if (!settings) {
            // Initialize default settings if not exists
            run(
                `INSERT INTO digest_settings (user_id, enabled, schedule, schedule_morning, schedule_evening, style) 
                 VALUES (?, 1, "08:00", "08:00", "20:00", "bullets")`,
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
                schedule_morning: settings.schedule_morning || '08:00',
                schedule_evening: settings.schedule_evening || '20:00',
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
                `INSERT INTO digest_settings (user_id, enabled, schedule, schedule_morning, schedule_evening, style) 
                 VALUES (?, 1, "08:00", "08:00", "20:00", "bullets")`,
                [userId]
            );
        }

        const updates: string[] = [];
        const params: any[] = [];

        if (body.enabled !== undefined) {
            updates.push('enabled = ?');
            params.push(body.enabled ? 1 : 0);
        }
        if (body.schedule_morning !== undefined) {
            updates.push('schedule_morning = ?');
            params.push(body.schedule_morning);
        }
        if (body.schedule_evening !== undefined) {
            updates.push('schedule_evening = ?');
            params.push(body.schedule_evening);
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

