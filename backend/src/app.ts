import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initializeDatabase, closeDatabase, run, queryOne } from './db/index.js';
import { feedsRoutes } from './routes/feeds.js';
import { foldersRoutes } from './routes/folders.js';
import { articlesRoutes } from './routes/articles.js';
import { searchRoutes } from './routes/search.js';
import { discoveryRoutes } from './routes/discovery.js';
import { opmlRoutes } from './routes/opml.js';
import { opmlStreamRoutes } from './routes/opml-stream.js';
import { feedsStreamRoutes } from './routes/feeds-stream.js';
import { feedChangesStreamRoutes } from './routes/feed-changes-stream.js';
import { syncRoutes } from './routes/sync.js';
import { settingsRoutes } from './routes/settings.js';
import { digestRoutes } from './routes/digest.js';
import { iconsRoutes } from './routes/icons.js';
import { thumbnailsRoutes } from './routes/thumbnails.js';
import { analyticsRoutes } from './routes/analytics.js';
import { rulesRoutes } from './routes/rules.js';
import { highlightsRoutes } from './routes/highlights.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { maintenanceRoutes } from './routes/maintenance.js';
import { authMiddleware } from './middleware/auth.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';
import { ensureIconCacheDir } from './services/icon-cache.js';
import { ensureThumbnailCacheDir } from './services/thumbnail-cache.js';

export async function buildApp() {
    const app = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
        },
    });

    ensureIconCacheDir();
    ensureThumbnailCacheDir();

    // CORS
    await app.register(cors, {
        origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'development' ? true : 'http://localhost:8080'),
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Authentication middleware (protects all routes except public ones)
    app.addHook('onRequest', authMiddleware);

    // Security headers
    app.addHook('onSend', async (request, reply, payload) => {
        // Content Security Policy
        const csp = [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ""}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: http:",
            "media-src 'self' https: http: blob:",
            "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
            "connect-src 'self' https: http:",
            "font-src 'self' data: https:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ].join('; ');

        reply.header('Content-Security-Policy', csp);
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('X-XSS-Protection', '1; mode=block');
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
        reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    });

    // Health check
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));



    // API routes
    await app.register(feedsRoutes, { prefix: '/api/v1/feeds' });
    await app.register(foldersRoutes, { prefix: '/api/v1/folders' });
    await app.register(articlesRoutes, { prefix: '/api/v1/articles' });
    await app.register(searchRoutes, { prefix: '/api/v1/search' });
    await app.register(discoveryRoutes, { prefix: '/api/v1/discovery' });
    await app.register(opmlRoutes, { prefix: '/api/v1/opml' });
    await app.register(opmlStreamRoutes, { prefix: '/api/v1/opml-stream' });
    await app.register(feedsStreamRoutes, { prefix: '/api/v1/feeds-stream' });
    await app.register(feedChangesStreamRoutes, { prefix: '/api/v1' });
    await app.register(syncRoutes, { prefix: '/api/v1/sync' });
    await app.register(settingsRoutes, { prefix: '/api/v1/settings' });
    await app.register(digestRoutes, { prefix: '/api/v1/digest' });
    await app.register(iconsRoutes, { prefix: '/api/v1/icons' });
    await app.register(thumbnailsRoutes, { prefix: '/api/v1/thumbnails' });
    await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
    await app.register(rulesRoutes, { prefix: '/api/v1/rules' });
    await app.register(highlightsRoutes, { prefix: '/api/v1/highlights' });
    await app.register(healthRoutes, { prefix: '/api/v1/health' });
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.register(maintenanceRoutes, { prefix: '/api/v1/maintenance' });

    return app;
}

export async function startServer() {
    // Initialize database
    initializeDatabase();

    // Ensure default user exists
    const user = queryOne('SELECT id FROM users WHERE id = 1');
    if (!user) {
        console.log('Creating default admin user...');
        run('INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, ?, ?, 1)', ['admin', 'disabled']);
    }

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
