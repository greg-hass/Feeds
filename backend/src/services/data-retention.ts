import { queryOne, queryAll, run } from '../db/index.js';

export interface RetentionSettings {
    enabled: boolean;
    maxArticleAgeDays: number;
    maxArticlesPerFeed: number;
    keepStarred: boolean;
    keepUnread: boolean;
}

export interface CleanupResult {
    articlesDeleted: number;
    bytesReclaimed: number;
    durationMs: number;
}

const DEFAULT_RETENTION: RetentionSettings = {
    enabled: true,
    maxArticleAgeDays: 90, // Keep articles for 90 days
    maxArticlesPerFeed: 500, // Keep max 500 articles per feed
    keepStarred: true,
    keepUnread: true,
};

/**
 * Get current retention settings
 */
export function getRetentionSettings(userId: number): RetentionSettings {
    const result = queryOne<{ settings_json: string }>(
        'SELECT settings_json FROM users WHERE id = ?',
        [userId]
    );

    if (!result?.settings_json) {
        return DEFAULT_RETENTION;
    }

    try {
        const settings = JSON.parse(result.settings_json);
        return {
            ...DEFAULT_RETENTION,
            ...settings.retention,
        };
    } catch {
        return DEFAULT_RETENTION;
    }
}

/**
 * Update retention settings
 */
export function updateRetentionSettings(userId: number, settings: Partial<RetentionSettings>): void {
    const current = queryOne<{ settings_json: string }>(
        'SELECT settings_json FROM users WHERE id = ?',
        [userId]
    );

    let currentSettings = {};
    if (current?.settings_json) {
        try {
            currentSettings = JSON.parse(current.settings_json);
        } catch {
            currentSettings = {};
        }
    }

    const newSettings = {
        ...currentSettings,
        retention: {
            ...DEFAULT_RETENTION,
            ...(currentSettings as any).retention,
            ...settings,
        },
    };

    run(
        'UPDATE users SET settings_json = ?, updated_at = datetime(\'now\') WHERE id = ?',
        [JSON.stringify(newSettings), userId]
    );
}

/**
 * Clean up old articles based on retention policy
 */
export async function cleanupOldArticles(userId: number): Promise<CleanupResult> {
    const startTime = Date.now();
    const settings = getRetentionSettings(userId);

    if (!settings.enabled) {
        return {
            articlesDeleted: 0,
            bytesReclaimed: 0,
            durationMs: Date.now() - startTime,
        };
    }

    // Get database size before cleanup
    const statsBefore = queryOne<{ page_size: number; page_count: number }>(
        'SELECT (SELECT page_size FROM pragma_page_size) as page_size, (SELECT page_count FROM pragma_page_count) as page_count'
    );
    const sizeBeforeBytes = (statsBefore?.page_size || 4096) * (statsBefore?.page_count || 0);

    // Build the DELETE query with conditions
    const conditions: string[] = [];
    const params: any[] = [];

    // Age-based cleanup
    if (settings.maxArticleAgeDays > 0) {
        conditions.push(`datetime(published_at) < datetime('now', '-' || ? || ' days')`);
        params.push(settings.maxArticleAgeDays);
    }

    // Exclude starred articles (bookmarks)
    if (settings.keepStarred) {
        conditions.push(`is_bookmarked = 0`);
    }

    // Exclude unread articles
    if (settings.keepUnread) {
        conditions.push(`id IN (
            SELECT article_id FROM read_state WHERE user_id = ?
        )`);
        params.push(userId);
    }

    // Only delete articles from this user's feeds
    conditions.push(`feed_id IN (
        SELECT id FROM feeds WHERE user_id = ? AND deleted_at IS NULL
    )`);
    params.push(userId);

    const whereClause = conditions.join(' AND ');

    // Count articles to be deleted
    const countResult = queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM articles WHERE ${whereClause}`,
        params
    );
    const articlesToDelete = countResult?.count || 0;

    if (articlesToDelete === 0) {
        return {
            articlesDeleted: 0,
            bytesReclaimed: 0,
            durationMs: Date.now() - startTime,
        };
    }

    // Delete old articles
    run(`DELETE FROM articles WHERE ${whereClause}`, params);

    // Handle per-feed limits
    if (settings.maxArticlesPerFeed > 0) {
        const feeds = queryAll<{ id: number }>(
            'SELECT id FROM feeds WHERE user_id = ? AND deleted_at IS NULL',
            [userId]
        );

        for (const feed of feeds) {
            // Keep only the N most recent articles per feed
            const deleteConditions: string[] = [];
            const deleteParams: any[] = [feed.id, feed.id, settings.maxArticlesPerFeed];

            if (settings.keepStarred) {
                deleteConditions.push('is_bookmarked = 0');
            }

            if (settings.keepUnread) {
                deleteConditions.push('id IN (SELECT article_id FROM read_state WHERE user_id = ?)');
                deleteParams.push(userId);
            }

            const whereClause = deleteConditions.length > 0 ? ` AND ${deleteConditions.join(' AND ')}` : '';

            run(
                `DELETE FROM articles 
                 WHERE feed_id = ? 
                 AND id NOT IN (
                     SELECT id FROM articles 
                     WHERE feed_id = ? 
                     ORDER BY published_at DESC 
                     LIMIT ?
                 )${whereClause}`,
                deleteParams
            );
        }
    }

    // Run VACUUM to reclaim space
    run('VACUUM');

    // Get database size after cleanup
    const statsAfter = queryOne<{ page_size: number; page_count: number }>(
        'SELECT (SELECT page_size FROM pragma_page_size) as page_size, (SELECT page_count FROM pragma_page_count) as page_count'
    );
    const sizeAfterBytes = (statsAfter?.page_size || 4096) * (statsAfter?.page_count || 0);

    const bytesReclaimed = Math.max(0, sizeBeforeBytes - sizeAfterBytes);
    const durationMs = Date.now() - startTime;

    return {
        articlesDeleted: articlesToDelete,
        bytesReclaimed,
        durationMs,
    };
}

/**
 * Get cleanup preview (what would be deleted)
 */
export function getCleanupPreview(userId: number): {
    articlesAffected: number;
    oldestArticleDate: string | null;
    estimatedSpaceSaved: number;
} {
    const settings = getRetentionSettings(userId);

    if (!settings.enabled) {
        return {
            articlesAffected: 0,
            oldestArticleDate: null,
            estimatedSpaceSaved: 0,
        };
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (settings.maxArticleAgeDays > 0) {
        conditions.push(`datetime(published_at) < datetime('now', '-' || ? || ' days')`);
        params.push(settings.maxArticleAgeDays);
    }

    if (settings.keepStarred) {
        conditions.push(`is_bookmarked = 0`);
    }

    if (settings.keepUnread) {
        conditions.push(`id IN (SELECT article_id FROM read_state WHERE user_id = ?)`);
        params.push(userId);
    }

    conditions.push(`feed_id IN (SELECT id FROM feeds WHERE user_id = ? AND deleted_at IS NULL)`);
    params.push(userId);

    const whereClause = conditions.join(' AND ');

    const result = queryOne<{ count: number; avg_size: number; oldest: string }>(
        `SELECT 
            COUNT(*) as count,
            AVG(LENGTH(content) + LENGTH(readability_content) + LENGTH(summary)) as avg_size,
            MIN(published_at) as oldest
         FROM articles 
         WHERE ${whereClause}`,
        params
    );

    return {
        articlesAffected: result?.count || 0,
        oldestArticleDate: result?.oldest || null,
        estimatedSpaceSaved: (result?.count || 0) * (result?.avg_size || 0),
    };
}
