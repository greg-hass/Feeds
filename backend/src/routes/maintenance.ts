import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
    getRetentionSettings,
    updateRetentionSettings,
    cleanupOldArticles,
    getCleanupPreview,
} from '../services/data-retention.js';
import {
    getDatabaseStats,
    checkMaintenanceNeeded,
    optimizeDatabase,
    vacuumDatabase,
} from '../services/db-maintenance.js';

export async function maintenanceRoutes(app: FastifyInstance) {
    /**
     * GET /api/v1/maintenance/stats
     * Get database statistics
     */
    app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const stats = getDatabaseStats();
            return stats;
        } catch (error) {
            console.error('Failed to get database stats:', error);
            reply.status(500);
            return { error: 'Failed to get database statistics' };
        }
    });

    /**
     * GET /api/v1/maintenance/check
     * Check if maintenance is needed
     */
    app.get('/check', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const check = checkMaintenanceNeeded();
            return check;
        } catch (error) {
            console.error('Failed to check maintenance:', error);
            reply.status(500);
            return { error: 'Failed to check maintenance status' };
        }
    });

    /**
     * POST /api/v1/maintenance/optimize
     * Run database optimization (ANALYZE + REINDEX)
     */
    app.post('/optimize', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await optimizeDatabase();
            return result;
        } catch (error) {
            console.error('Failed to optimize database:', error);
            reply.status(500);
            return { error: 'Failed to optimize database' };
        }
    });

    /**
     * POST /api/v1/maintenance/vacuum
     * Run VACUUM to reclaim space
     */
    app.post('/vacuum', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await vacuumDatabase();
            return result;
        } catch (error) {
            console.error('Failed to vacuum database:', error);
            reply.status(500);
            return { error: 'Failed to vacuum database' };
        }
    });

    /**
     * GET /api/v1/maintenance/retention
     * Get current retention settings
     */
    app.get('/retention', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = (request as any).user?.id || 1;
            const settings = getRetentionSettings(userId);
            return settings;
        } catch (error) {
            console.error('Failed to get retention settings:', error);
            reply.status(500);
            return { error: 'Failed to get retention settings' };
        }
    });

    /**
     * PUT /api/v1/maintenance/retention
     * Update retention settings
     */
    app.put('/retention', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = (request as any).user?.id || 1;
            const { enabled, maxArticleAgeDays, maxArticlesPerFeed, keepStarred, keepUnread } = request.body as any;

            updateRetentionSettings(userId, {
                enabled,
                maxArticleAgeDays,
                maxArticlesPerFeed,
                keepStarred,
                keepUnread,
            });

            const updated = getRetentionSettings(userId);
            return updated;
        } catch (error) {
            console.error('Failed to update retention settings:', error);
            reply.status(500);
            return { error: 'Failed to update retention settings' };
        }
    });

    /**
     * GET /api/v1/maintenance/cleanup/preview
     * Preview what would be cleaned up
     */
    app.get('/cleanup/preview', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = (request as any).user?.id || 1;
            const preview = getCleanupPreview(userId);
            return preview;
        } catch (error) {
            console.error('Failed to get cleanup preview:', error);
            reply.status(500);
            return { error: 'Failed to get cleanup preview' };
        }
    });

    /**
     * POST /api/v1/maintenance/cleanup
     * Run cleanup based on retention policy
     */
    app.post('/cleanup', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = (request as any).user?.id || 1;
            const result = await cleanupOldArticles(userId);
            return result;
        } catch (error) {
            console.error('Failed to cleanup articles:', error);
            reply.status(500);
            return { error: 'Failed to cleanup articles' };
        }
    });
}

