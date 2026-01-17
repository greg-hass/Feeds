import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { initializeDatabase, closeDatabase } from './db/index.js';
import { authRoutes } from './routes/auth.js';
import { feedsRoutes } from './routes/feeds.js';
import { foldersRoutes } from './routes/folders.js';
import { articlesRoutes } from './routes/articles.js';
import { searchRoutes } from './routes/search.js';
import { discoverRoutes } from './routes/discover.js';
import { opmlRoutes } from './routes/opml.js';
import { syncRoutes } from './routes/sync.js';
import { settingsRoutes } from './routes/settings.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';

export async function buildApp() {
    const app = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
        },
    });

    // CORS
    await app.register(cors, {
        origin: process.env.CORS_ORIGIN || true,
        credentials: true,
    });

    // JWT Auth
    await app.register(jwt, {
        secret: process.env.JWT_SECRET || 'change-me-in-production',
        sign: {
            expiresIn: '7d',
        },
    });

    // Decorators for auth
    app.decorate('authenticate', async function (request: any, reply: any) {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    // Health check
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // API routes
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.register(feedsRoutes, { prefix: '/api/v1/feeds' });
    await app.register(foldersRoutes, { prefix: '/api/v1/folders' });
    await app.register(articlesRoutes, { prefix: '/api/v1/articles' });
    await app.register(searchRoutes, { prefix: '/api/v1/search' });
    await app.register(discoverRoutes, { prefix: '/api/v1/discover' });
    await app.register(opmlRoutes, { prefix: '/api/v1/opml' });
    await app.register(syncRoutes, { prefix: '/api/v1/sync' });
    await app.register(settingsRoutes, { prefix: '/api/v1/settings' });

    return app;
}

export async function startServer() {
    // Initialize database
    initializeDatabase();

    const app = await buildApp();

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    try {
        await app.listen({ port, host });
        console.log(`Server running at http://${host}:${port}`);

        // Start background job scheduler
        startScheduler();

        // Graceful shutdown
        const shutdown = async () => {
            console.log('Shutting down...');
            stopScheduler();
            await app.close();
            closeDatabase();
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
