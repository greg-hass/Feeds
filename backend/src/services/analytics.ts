import { queryAll, queryOne, run } from '../db/index.js';

// Alias for convenience
const query = queryAll;

// ============================================================================
// TYPES
// ============================================================================

export interface ReadingSession {
    id: number;
    user_id: number;
    article_id: number;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    scroll_depth_percent: number;
    completed: boolean;
}

export interface ArticleStats {
    article_id: number;
    total_read_time_seconds: number;
    read_count: number;
    avg_scroll_depth: number;
    completion_rate: number;
    last_read_at: string | null;
}

export interface FeedStats {
    feed_id: number;
    total_articles_read: number;
    total_read_time_seconds: number;
    avg_read_time_seconds: number;
    engagement_score: number;
    articles_completed: number;
    last_engagement_at: string | null;
}

export interface DailyStats {
    date: string;
    articles_read: number;
    total_read_time_seconds: number;
    sessions_count: number;
}

export interface AnalyticsOverview {
    total_articles_read: number;
    total_reading_time_seconds: number;
    average_session_duration: number;
    articles_this_week: number;
    reading_streak_days: number;
    top_feeds: Array<{ feed_id: number; feed_title: string; articles_read: number }>;
    reading_by_day: DailyStats[];
    top_reading_hours: number[]; // Hours of day (0-23)
}

// ============================================================================
// READING SESSION TRACKING
// ============================================================================

/**
 * Start a new reading session
 */
export function startReadingSession(userId: number, articleId: number): number {
    const result = run(
        `INSERT INTO reading_sessions (user_id, article_id, started_at)
         VALUES (?, ?, datetime('now'))`,
        [userId, articleId]
    );
    return result.lastInsertRowid as number;
}

/**
 * End a reading session with duration and scroll depth
 */
export function endReadingSession(
    sessionId: number,
    scrollDepthPercent: number,
    completed: boolean
): void {
    run(
        `UPDATE reading_sessions
         SET ended_at = datetime('now'),
             duration_seconds = CAST((julianday(datetime('now')) - julianday(started_at)) * 86400 AS INTEGER),
             scroll_depth_percent = ?,
             completed = ?
         WHERE id = ?`,
        [scrollDepthPercent, completed ? 1 : 0, sessionId]
    );
}

/**
 * Update scroll depth during active session
 */
export function updateSessionScrollDepth(sessionId: number, scrollDepthPercent: number): void {
    run(
        `UPDATE reading_sessions
         SET scroll_depth_percent = ?
         WHERE id = ?`,
        [scrollDepthPercent, sessionId]
    );
}

/**
 * Get active reading session for user/article
 */
export function getActiveSession(userId: number, articleId: number): ReadingSession | null {
    return queryOne<ReadingSession>(
        `SELECT * FROM reading_sessions
         WHERE user_id = ? AND article_id = ? AND ended_at IS NULL
         ORDER BY started_at DESC LIMIT 1`,
        [userId, articleId]
    ) ?? null;
}

// ============================================================================
// ARTICLE STATISTICS
// ============================================================================

/**
 * Get statistics for a specific article
 */
export function getArticleStats(articleId: number): ArticleStats | null {
    return queryOne<ArticleStats>(
        `SELECT * FROM article_stats WHERE article_id = ?`,
        [articleId]
    ) ?? null;
}

const isMissingTableError = (error: unknown, tableName: string): boolean => {
    if (!(error instanceof Error)) return false;
    return error.message.includes(`no such table: ${tableName}`);
};

/**
 * Get top read articles
 */
export function getTopReadArticles(userId: number, limit: number = 10): Array<ArticleStats & { title: string; feed_title: string }> {
    try {
        return query<ArticleStats & { title: string; feed_title: string }>(
            `SELECT
                s.*,
                a.title,
                f.title as feed_title
            FROM article_stats s
            JOIN articles a ON s.article_id = a.id
            JOIN feeds f ON a.feed_id = f.id
            WHERE f.user_id = ?
            ORDER BY s.read_count DESC, s.total_read_time_seconds DESC
            LIMIT ?`,
            [userId, limit]
        );
    } catch (error) {
        if (isMissingTableError(error, 'article_stats')) {
            return [];
        }
        throw error;
    }
}

// ============================================================================
// FEED ENGAGEMENT
// ============================================================================

/**
 * Calculate engagement score for a feed
 * Score = (articles_read / total_articles) * avg_read_time_weight * completion_rate
 */
function calculateEngagementScore(feedId: number): number {
    const stats = queryOne<{ articles_read: number; total_articles: number; avg_time: number; completion_rate: number }>(
        `SELECT
            fs.total_articles_read as articles_read,
            COUNT(a.id) as total_articles,
            COALESCE(fs.avg_read_time_seconds, 0) as avg_time,
            COALESCE(
                (SELECT COUNT(*) FROM reading_sessions rs
                 JOIN articles a2 ON rs.article_id = a2.id
                 WHERE a2.feed_id = ? AND rs.completed = 1) * 1.0 /
                NULLIF(fs.total_articles_read, 0),
                0
            ) as completion_rate
         FROM feed_stats fs
         JOIN articles a ON a.feed_id = fs.feed_id
         WHERE fs.feed_id = ?
         GROUP BY fs.feed_id`,
        [feedId, feedId]
    );

    if (!stats || stats.total_articles === 0) return 0;

    const readRate = stats.articles_read / stats.total_articles;
    const timeWeight = Math.min(stats.avg_time / 180, 1); // Normalize to 3 minutes max
    const score = readRate * timeWeight * stats.completion_rate;

    return Math.round(score * 100) / 100;
}

/**
 * Update engagement score for a feed
 */
export function updateFeedEngagementScore(feedId: number): void {
    const score = calculateEngagementScore(feedId);
    run(
        `UPDATE feed_stats SET engagement_score = ?, updated_at = datetime('now') WHERE feed_id = ?`,
        [score, feedId]
    );
}

/**
 * Get feed engagement statistics
 */
export function getFeedStats(feedId: number): FeedStats | null {
    return queryOne<FeedStats>(
        `SELECT * FROM feed_stats WHERE feed_id = ?`,
        [feedId]
    ) ?? null;
}

/**
 * Get top engaging feeds
 */
export function getTopEngagingFeeds(userId: number, limit: number = 10): Array<FeedStats & { title: string; type: string }> {
    return query<FeedStats & { title: string; type: string }>(
        `SELECT
            s.*,
            f.title,
            f.type
         FROM feed_stats s
         JOIN feeds f ON s.feed_id = f.id
         WHERE f.user_id = ? AND f.deleted_at IS NULL
         ORDER BY s.engagement_score DESC, s.total_articles_read DESC
         LIMIT ?`,
        [userId, limit]
    );
}

// ============================================================================
// DAILY STATISTICS
// ============================================================================

/**
 * Get daily reading stats for a date range
 */
export function getDailyStats(userId: number, startDate: string, endDate: string): DailyStats[] {
    return query<DailyStats>(
        `SELECT date, articles_read, total_read_time_seconds, sessions_count
         FROM daily_reading_stats
         WHERE user_id = ? AND date BETWEEN ? AND ?
         ORDER BY date ASC`,
        [userId, startDate, endDate]
    );
}

/**
 * Get reading stats for last N days
 */
export function getRecentDailyStats(userId: number, days: number = 30): DailyStats[] {
    return query<DailyStats>(
        `SELECT date, articles_read, total_read_time_seconds, sessions_count
         FROM daily_reading_stats
         WHERE user_id = ? AND date >= date('now', '-' || ? || ' days')
         ORDER BY date ASC`,
        [userId, days]
    );
}

/**
 * Calculate reading streak (consecutive days)
 */
export function getReadingStreak(userId: number): number {
    const stats = query<{ date: string }>(
        `SELECT date FROM daily_reading_stats
         WHERE user_id = ? AND articles_read > 0
         ORDER BY date DESC
         LIMIT 365`,
        [userId]
    );

    if (stats.length === 0) return 0;

    let streak = 0;
    let expectedDate = new Date();
    expectedDate.setHours(0, 0, 0, 0);

    for (const stat of stats) {
        const statDate = new Date(stat.date);
        statDate.setHours(0, 0, 0, 0);

        if (statDate.getTime() === expectedDate.getTime()) {
            streak++;
            expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

// ============================================================================
// ANALYTICS OVERVIEW
// ============================================================================

/**
 * Get comprehensive analytics overview
 */
export function getAnalyticsOverview(userId: number): AnalyticsOverview {
    // Total articles read
    const totalArticles = queryOne<{ count: number }>(
        `SELECT COUNT(DISTINCT article_id) as count
         FROM reading_sessions
         WHERE user_id = ?`,
        [userId]
    )?.count || 0;

    // Total reading time
    const totalTime = queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(duration_seconds), 0) as total
         FROM reading_sessions
         WHERE user_id = ? AND duration_seconds IS NOT NULL`,
        [userId]
    )?.total || 0;

    // Average session duration
    const avgDuration = queryOne<{ avg: number }>(
        `SELECT COALESCE(AVG(duration_seconds), 0) as avg
         FROM reading_sessions
         WHERE user_id = ? AND duration_seconds IS NOT NULL`,
        [userId]
    )?.avg || 0;

    // Articles this week
    const articlesThisWeek = queryOne<{ count: number }>(
        `SELECT COUNT(DISTINCT article_id) as count
         FROM reading_sessions
         WHERE user_id = ? AND started_at >= date('now', '-7 days')`,
        [userId]
    )?.count || 0;

    // Reading streak
    const streak = getReadingStreak(userId);

    // Top feeds
    const topFeeds = query<{ feed_id: number; feed_title: string; articles_read: number }>(
        `SELECT
            f.id as feed_id,
            f.title as feed_title,
            fs.total_articles_read as articles_read
         FROM feed_stats fs
         JOIN feeds f ON fs.feed_id = f.id
         WHERE f.user_id = ? AND f.deleted_at IS NULL
         ORDER BY fs.total_articles_read DESC
         LIMIT 5`,
        [userId]
    );

    // Reading by day (last 30 days)
    const readingByDay = getRecentDailyStats(userId, 30);

    // Top reading hours
    const hourStats = query<{ hour: number; count: number }>(
        `SELECT
            CAST(strftime('%H', started_at) AS INTEGER) as hour,
            COUNT(*) as count
         FROM reading_sessions
         WHERE user_id = ? AND started_at >= date('now', '-30 days')
         GROUP BY hour
         ORDER BY count DESC
         LIMIT 3`,
        [userId]
    );
    const topReadingHours = hourStats.map((h: { hour: number; count: number }) => h.hour);

    return {
        total_articles_read: totalArticles,
        total_reading_time_seconds: totalTime,
        average_session_duration: Math.round(avgDuration),
        articles_this_week: articlesThisWeek,
        reading_streak_days: streak,
        top_feeds: topFeeds,
        reading_by_day: readingByDay,
        top_reading_hours: topReadingHours,
    };
}

// ============================================================================
// TOPIC ANALYSIS
// ============================================================================

/**
 * Get topic distribution from article tags
 */
export function getTopicDistribution(userId: number, limit: number = 10): Array<{ tag: string; count: number }> {
    try {
        return query<{ tag: string; count: number }>(
            `SELECT
                t.tag,
                COUNT(*) as count
            FROM article_tags t
            JOIN articles a ON t.article_id = a.id
            JOIN feeds f ON a.feed_id = f.id
            WHERE f.user_id = ?
            GROUP BY t.tag
            ORDER BY count DESC
            LIMIT ?`,
            [userId, limit]
        );
    } catch (error) {
        if (isMissingTableError(error, 'article_tags')) {
            return [];
        }
        throw error;
    }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Archive old reading sessions (keep last 90 days)
 */
export function archiveOldSessions(days: number = 90): number {
    const result = run(
        `DELETE FROM reading_sessions
         WHERE started_at < date('now', '-' || ? || ' days')`,
        [days]
    );
    return result.changes;
}

/**
 * Archive old search history (keep last 90 days)
 */
export function archiveOldSearchHistory(days: number = 90): number {
    const result = run(
        `DELETE FROM search_history
         WHERE searched_at < date('now', '-' || ? || ' days')`,
        [days]
    );
    return result.changes;
}
