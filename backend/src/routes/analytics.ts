import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
    startReadingSession,
    endReadingSession,
    updateSessionScrollDepth,
    getActiveSession,
    getAnalyticsOverview,
    getArticleStats,
    getFeedStats,
    getDailyStats,
    getRecentDailyStats,
    getTopReadArticles,
    getTopEngagingFeeds,
    getTopicDistribution,
    updateFeedEngagementScore,
} from '../services/analytics.js';
import { queryAll } from '../db/index.js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const startSessionSchema = z.object({
    article_id: z.number().int().positive(),
});

const endSessionSchema = z.object({
    session_id: z.number().int().positive(),
    scroll_depth_percent: z.number().int().min(0).max(100),
    completed: z.boolean(),
});

const updateScrollSchema = z.object({
    session_id: z.number().int().positive(),
    scroll_depth_percent: z.number().int().min(0).max(100),
});

const dateRangeSchema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ============================================================================
// ROUTES
// ============================================================================

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
    const userId = 1; // Single-user system

    // ========================================================================
    // READING SESSIONS
    // ========================================================================

    /**
     * Start a new reading session
     * POST /analytics/session/start
     */
    app.post('/session/start', async (request: FastifyRequest) => {
        const { article_id } = startSessionSchema.parse(request.body);

        // Check if there's already an active session for this article
        const existingSession = getActiveSession(userId, article_id);
        if (existingSession) {
            return { session_id: existingSession.id };
        }

        const sessionId = startReadingSession(userId, article_id);
        return { session_id: sessionId };
    });

    /**
     * End a reading session
     * POST /analytics/session/end
     */
    app.post('/session/end', async (request: FastifyRequest) => {
        const { session_id, scroll_depth_percent, completed } = endSessionSchema.parse(request.body);

        endReadingSession(session_id, scroll_depth_percent, completed);

        return { success: true };
    });

    /**
     * Update scroll depth during active session
     * POST /analytics/session/scroll
     */
    app.post('/session/scroll', async (request: FastifyRequest) => {
        const { session_id, scroll_depth_percent } = updateScrollSchema.parse(request.body);

        updateSessionScrollDepth(session_id, scroll_depth_percent);

        return { success: true };
    });

    // ========================================================================
    // ANALYTICS OVERVIEW
    // ========================================================================

    /**
     * Get comprehensive analytics overview
     * GET /analytics/overview
     */
    app.get('/overview', async () => {
        const overview = getAnalyticsOverview(userId);
        return overview;
    });

    // ========================================================================
    // ARTICLE STATISTICS
    // ========================================================================

    /**
     * Get statistics for a specific article
     * GET /analytics/articles/:id
     */
    app.get('/articles/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const articleId = parseInt(request.params.id);

        if (isNaN(articleId)) {
            return { error: 'Invalid article ID' };
        }

        const stats = getArticleStats(articleId);
        return stats || { article_id: articleId, read_count: 0 };
    });

    /**
     * Get top read articles
     * GET /analytics/articles/top?limit=10
     */
    app.get('/articles/top', async (request: FastifyRequest<{ Querystring: { limit?: string } }>) => {
        const limit = parseInt(request.query.limit || '10');
        const topArticles = getTopReadArticles(userId, limit);
        return { articles: topArticles };
    });

    // ========================================================================
    // FEED STATISTICS
    // ========================================================================

    /**
     * Get statistics for a specific feed
     * GET /analytics/feeds/:id
     */
    app.get('/feeds/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const feedId = parseInt(request.params.id);

        if (isNaN(feedId)) {
            return { error: 'Invalid feed ID' };
        }

        const stats = getFeedStats(feedId);
        return stats || { feed_id: feedId, total_articles_read: 0 };
    });

    /**
     * Get top engaging feeds
     * GET /analytics/feeds/top?limit=10
     */
    app.get('/feeds/top', async (request: FastifyRequest<{ Querystring: { limit?: string } }>) => {
        const limit = parseInt(request.query.limit || '10');
        const topFeeds = getTopEngagingFeeds(userId, limit);
        return { feeds: topFeeds };
    });

    /**
     * Recalculate engagement score for a feed
     * POST /analytics/feeds/:id/recalculate
     */
    app.post('/feeds/:id/recalculate', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const feedId = parseInt(request.params.id);

        if (isNaN(feedId)) {
            return { error: 'Invalid feed ID' };
        }

        updateFeedEngagementScore(feedId);
        const stats = getFeedStats(feedId);

        return { success: true, stats };
    });

    // ========================================================================
    // DAILY STATISTICS
    // ========================================================================

    /**
     * Get daily reading stats for a date range
     * POST /analytics/daily
     */
    app.post('/daily', async (request: FastifyRequest) => {
        const { start_date, end_date } = dateRangeSchema.parse(request.body);

        const stats = getDailyStats(userId, start_date, end_date);
        return { stats };
    });

    /**
     * Get recent daily stats (last N days)
     * GET /analytics/daily/recent?days=30
     */
    app.get('/daily/recent', async (request: FastifyRequest<{ Querystring: { days?: string } }>) => {
        const days = parseInt(request.query.days || '30');
        const stats = getRecentDailyStats(userId, days);
        return { stats };
    });

    // ========================================================================
    // READING TIME ANALYSIS
    // ========================================================================

    /**
     * Get reading time trends by hour of day
     * GET /analytics/reading-time/by-hour
     */
    app.get('/reading-time/by-hour', async () => {
        const stats = queryAll<{ hour: number; total_time: number; session_count: number }>(
            `SELECT
                CAST(strftime('%H', started_at) AS INTEGER) as hour,
                SUM(COALESCE(duration_seconds, 0)) as total_time,
                COUNT(*) as session_count
             FROM reading_sessions
             WHERE user_id = ? AND started_at >= date('now', '-30 days')
             GROUP BY hour
             ORDER BY hour`,
            [userId]
        );

        // Fill in missing hours with zeros
        const hourlyStats = Array.from({ length: 24 }, (_, hour) => {
            const stat = stats.find(s => s.hour === hour);
            return {
                hour,
                total_time: stat?.total_time || 0,
                session_count: stat?.session_count || 0,
            };
        });

        return { stats: hourlyStats };
    });

    /**
     * Get reading time trends by day of week
     * GET /analytics/reading-time/by-day-of-week
     */
    app.get('/reading-time/by-day-of-week', async () => {
        const stats = queryAll<{ day_of_week: number; total_time: number; articles_read: number }>(
            `SELECT
                CAST(strftime('%w', started_at) AS INTEGER) as day_of_week,
                SUM(COALESCE(duration_seconds, 0)) as total_time,
                COUNT(DISTINCT article_id) as articles_read
             FROM reading_sessions
             WHERE user_id = ? AND started_at >= date('now', '-30 days')
             GROUP BY day_of_week
             ORDER BY day_of_week`,
            [userId]
        );

        // Fill in missing days with zeros (0 = Sunday, 6 = Saturday)
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dailyStats = Array.from({ length: 7 }, (_, day) => {
            const stat = stats.find(s => s.day_of_week === day);
            return {
                day_of_week: day,
                day_name: dayNames[day],
                total_time: stat?.total_time || 0,
                articles_read: stat?.articles_read || 0,
            };
        });

        return { stats: dailyStats };
    });

    // ========================================================================
    // TOPIC ANALYSIS
    // ========================================================================

    /**
     * Get topic distribution
     * GET /analytics/topics?limit=10
     */
    app.get('/topics', async (request: FastifyRequest<{ Querystring: { limit?: string } }>) => {
        const limit = parseInt(request.query.limit || '10');
        const topics = getTopicDistribution(userId, limit);
        return { topics };
    });

    // ========================================================================
    // EXPORT
    // ========================================================================

    /**
     * Export all analytics data as JSON
     * GET /analytics/export
     */
    app.get('/export', async () => {
        const overview = getAnalyticsOverview(userId);
        const topArticles = getTopReadArticles(userId, 50);
        const topFeeds = getTopEngagingFeeds(userId, 50);
        const dailyStats = getRecentDailyStats(userId, 90);
        const topics = getTopicDistribution(userId, 50);

        return {
            exported_at: new Date().toISOString(),
            overview,
            top_articles: topArticles,
            top_feeds: topFeeds,
            daily_stats: dailyStats,
            topic_distribution: topics,
        };
    });
}

// Extend Fastify instance with db property
declare module 'fastify' {
    interface FastifyInstance {
        db: {
            queryAll<T>(sql: string, params: any[]): Promise<T[]>;
            queryOne<T>(sql: string, params: any[]): Promise<T | null>;
        };
    }
}
