import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { queryOne, run, queryAll } from '../db/index.js';

// Schemas
const setupSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(8).max(100),
    base_url: z.string().url().optional(),
});

const loginSchema = z.object({
    username: z.string(),
    password: z.string(),
});

interface User {
    id: number;
    username: string;
    password_hash: string;
    is_admin: number;
    settings_json: string;
    created_at: string;
    updated_at: string;
}

export async function authRoutes(app: FastifyInstance) {
    // Check if setup is needed
    app.get('/status', async () => {
        const user = queryOne<User>('SELECT id FROM users LIMIT 1');
        return {
            setup_required: !user,
            version: '1.0.0',
        };
    });

    // First-run setup
    app.post('/setup', async (request: FastifyRequest, reply: FastifyReply) => {
        const existingUser = queryOne<User>('SELECT id FROM users LIMIT 1');
        if (existingUser) {
            return reply.status(400).send({ error: 'Setup already completed' });
        }

        const body = setupSchema.parse(request.body);
        const passwordHash = await bcrypt.hash(body.password, 12);

        const result = run(
            `INSERT INTO users (username, password_hash, is_admin, settings_json) 
       VALUES (?, ?, 1, ?)`,
            [body.username, passwordHash, JSON.stringify({ base_url: body.base_url })]
        );

        const user = queryOne<User>('SELECT id, username, is_admin, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
        const token = app.jwt.sign({ id: user!.id, username: user!.username });

        return {
            user: {
                id: user!.id,
                username: user!.username,
                is_admin: true,
            },
            token,
        };
    });

    // Login
    app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
        const body = loginSchema.parse(request.body);

        const user = queryOne<User>(
            'SELECT id, username, password_hash, is_admin FROM users WHERE username = ?',
            [body.username]
        );

        if (!user) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(body.password, user.password_hash);
        if (!validPassword) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const token = app.jwt.sign({ id: user.id, username: user.username });

        return {
            user: {
                id: user.id,
                username: user.username,
                is_admin: Boolean(user.is_admin),
            },
            token,
        };
    });

    // Refresh token
    app.post('/refresh', {
        preHandler: [app.authenticate],
    }, async (request: FastifyRequest) => {
        const user = (request as any).user;
        const token = app.jwt.sign({ id: user.id, username: user.username });
        return { token };
    });

    // Get current user
    app.get('/me', {
        preHandler: [app.authenticate],
    }, async (request: FastifyRequest) => {
        const { id } = (request as any).user;
        const user = queryOne<User>(
            'SELECT id, username, is_admin, created_at FROM users WHERE id = ?',
            [id]
        );

        return {
            user: {
                id: user!.id,
                username: user!.username,
                is_admin: Boolean(user!.is_admin),
                created_at: user!.created_at,
            },
        };
    });
}
