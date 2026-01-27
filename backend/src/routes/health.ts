import { FastifyInstance } from 'fastify';
import { getDatabaseStats, checkMaintenanceNeeded, optimizeDatabase, vacuumDatabase } from '../services/db-maintenance.js';

export async function healthRoutes(app: FastifyInstance) {
    // Get database statistics
    app.get('/db-stats', async (request, reply) => {
        try {
            const stats = getDatabaseStats();
            const maintenance = checkMaintenanceNeeded();
            
            return {
                database: {
                    totalSizeMb: (stats.totalSizeBytes / 1024 / 1024).toFixed(2),
                    articleCount: stats.articleCount,
                    feedCount: stats.feedCount,
                    oldestArticleDate: stats.oldestArticleDate,
                    ftsSizeMb: (stats.ftsSizeBytes / 1024 / 1024).toFixed(2),
                },
                tables: stats.tableSizes.map(t => ({
                    name: t.name,
                    rows: t.rowCount,
                    estimatedSizeMb: (t.sizeBytes / 1024 / 1024).toFixed(2),
                })),
                maintenance: {
                    fragmentationPercent: (maintenance.fragmentationRatio * 100).toFixed(1),
                    needsVacuum: maintenance.needsVacuum,
                    needsOptimize: maintenance.needsOptimize,
                    recommendations: maintenance.recommendations,
                },
            };
        } catch (error) {
            console.error('Failed to get database stats:', error);
            return reply.status(500).send({ error: 'Failed to get database statistics' });
        }
    });

    // Run database optimization (ANALYZE + REINDEX)
    app.post('/db-optimize', async (request, reply) => {
        try {
            const result = await optimizeDatabase();
            
            if (!result.success) {
                return reply.status(500).send({ error: result.message });
            }
            
            return {
                success: true,
                message: result.message,
                durationMs: result.durationMs,
            };
        } catch (error) {
            console.error('Failed to optimize database:', error);
            return reply.status(500).send({ error: 'Failed to optimize database' });
        }
    });

    // Run VACUUM (requires exclusive lock)
    app.post('/db-vacuum', async (request, reply) => {
        try {
            // Check if maintenance is actually needed
            const maintenance = checkMaintenanceNeeded();
            
            if (!maintenance.needsVacuum) {
                return reply.status(400).send({
                    error: 'VACUUM not needed',
                    message: `Fragmentation is only ${(maintenance.fragmentationRatio * 100).toFixed(1)}%. Threshold is 20%.`,
                });
            }
            
            const result = await vacuumDatabase();
            
            if (!result.success) {
                return reply.status(500).send({ error: result.message });
            }
            
            return {
                success: true,
                message: result.message,
                durationMs: result.durationMs,
                bytesReclaimed: result.bytesReclaimed,
                mbReclaimed: (result.bytesReclaimed / 1024 / 1024).toFixed(2),
            };
        } catch (error) {
            console.error('Failed to vacuum database:', error);
            return reply.status(500).send({ error: 'Failed to vacuum database' });
        }
    });
}
