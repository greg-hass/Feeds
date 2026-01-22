import { run, queryOne } from '../db/index.js';
import { parseFeed, normalizeArticle, FeedType } from './feed-parser.js';
import { cacheFeedIcon } from './icon-cache.js';
import { cacheArticleThumbnail } from './thumbnail-cache.js';
import { getUserSettings } from './settings.js';
// Note: fetchAndExtractReadability is no longer used during refresh
// Content is now fetched lazily when articles are opened (see routes/articles.ts)

export interface FeedToRefresh {
    id: number;
    url: string;
    type: FeedType;
    refresh_interval_minutes: number;
}

export interface RefreshResult {
    success: boolean;
    newArticles: number;
    next_fetch_at?: string;
    error?: string;
}

function isGenericIconUrl(url: string | null): boolean {
    if (!url) return true;
    // Generic favicon patterns that should be replaced with actual feed icons
    return url.includes('google.com/s2/favicons') || 
           url.endsWith('/favicon.ico') ||
           url.includes('youtube.com/favicon') ||
           url.includes('yt3.ggpht.com/favicon'); // YouTube default avatar
}

function categorizeRefreshError(err: unknown): { category: string; message: string } {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (err instanceof Error && err.name === 'AbortError') {
        return { category: 'timeout', message };
    }
    if (err instanceof TypeError) {
        return { category: 'network', message };
    }
    if (/could not parse feed/i.test(message)) {
        return { category: 'parse', message };
    }
    if (/failed to fetch feed/i.test(message)) {
        return { category: 'fetch', message };
    }
    if (/readability/i.test(message)) {
        return { category: 'readability', message };
    }
    return { category: 'unknown', message };
}

/**
 * Cache thumbnails in the background without blocking feed refresh.
 * Uses smaller batches and no retries for speed.
 */
async function cacheThumbnailsInBackground(
    thumbnailUpdates: Array<{ id: number; url: string }>,
    updateThumbnailStmt: any
): Promise<void> {
    const BATCH_SIZE = 50; // Larger batches since we're not blocking

    for (let i = 0; i < thumbnailUpdates.length; i += BATCH_SIZE) {
        const batch = thumbnailUpdates.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(async (item) => {
            const cachedThumbnail = await cacheArticleThumbnail(item.id, item.url);
            return { id: item.id, cached: cachedThumbnail };
        }));

        // Batch database updates
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.cached) {
                updateThumbnailStmt.run(
                    result.value.cached.fileName,
                    result.value.cached.mime,
                    result.value.id
                );
            }
        }
    }
}

/**
 * Extended feed info with cached icon status for batch optimization
 */
export interface FeedToRefreshWithCache extends FeedToRefresh {
    hasValidIcon?: boolean;
    userId?: number;
}

/**
 * Refreshes a single feed and inserts new articles.
 * Used by both manual refresh (API endpoint) and scheduled refresh.
 *
 * @param feed - The feed to refresh (can include pre-fetched cache status)
 * @returns RefreshResult with success status and new article count
 */
export async function refreshFeed(feed: FeedToRefreshWithCache): Promise<RefreshResult> {
    let refreshIntervalMinutes = feed.refresh_interval_minutes;
    try {
        // Use pre-fetched icon status if available (batch optimization)
        // Otherwise fall back to individual query (single feed refresh)
        let hasValidIcon = feed.hasValidIcon;
        let existingIcon: { icon_url: string | null; icon_cached_path: string | null; icon_cached_content_type: string | null } | undefined;

        if (hasValidIcon === undefined) {
            existingIcon = queryOne<{
                icon_url: string | null;
                icon_cached_path: string | null;
                icon_cached_content_type: string | null;
            }>('SELECT icon_url, icon_cached_path, icon_cached_content_type FROM feeds WHERE id = ?', [feed.id]);
            hasValidIcon = existingIcon?.icon_url ? !isGenericIconUrl(existingIcon.icon_url) : false;
        } else {
            // When using batch optimization, we may need icon info later for caching decisions
            // Only fetch if we need it (when hasValidIcon is false - meaning we might cache a new icon)
            if (!hasValidIcon) {
                existingIcon = queryOne<{
                    icon_url: string | null;
                    icon_cached_path: string | null;
                    icon_cached_content_type: string | null;
                }>('SELECT icon_url, icon_cached_path, icon_cached_content_type FROM feeds WHERE id = ?', [feed.id]);
            }
        }

        const feedData = await parseFeed(feed.url, { skipIconFetch: !!hasValidIcon });

        let newArticles = 0;

        // Use pre-fetched userId if available (batch optimization)
        const userId = feed.userId ?? (queryOne<{ user_id: number }>('SELECT user_id FROM feeds WHERE id = ?', [feed.id])?.user_id || 1);
        const settings = getUserSettings(userId);
        // Note: fetch_full_content setting now controls lazy loading when article is opened
        // Content is no longer fetched during refresh for speed
        refreshIntervalMinutes = settings.refresh_interval_minutes ?? feed.refresh_interval_minutes;

        const insertArticle = `
            INSERT OR IGNORE INTO articles
            (feed_id, guid, title, url, author, summary, content, enclosure_url, enclosure_type, thumbnail_url, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // Detect type early if it's currently 'rss' to ensure correct normalization
        let currentType = feed.type;
        if (currentType === 'rss') {
            const { detectFeedType } = await import('./feed-parser.js');
            currentType = detectFeedType(feed.url, feedData);
        }

        const database = (await import('../db/index.js')).db();
        const insertStmt = database.prepare(insertArticle);
        const updateThumbnailStmt = database.prepare(
            `UPDATE articles SET thumbnail_cached_path = ?, thumbnail_cached_content_type = ? WHERE id = ?`
        );

        const shouldCacheThumbnails = true;

        const refreshTransaction = database.transaction((articles: any[], type: FeedType) => {
            let count = 0;
            const thumbnailUpdates: Array<{ id: number; url: string }> = [];

            for (const article of articles) {
                const normalized = normalizeArticle(article, type);
                const insertResult = insertStmt.run(
                    feed.id,
                    normalized.guid,
                    normalized.title,
                    normalized.url,
                    normalized.author,
                    normalized.summary,
                    normalized.content,
                    normalized.enclosure_url,
                    normalized.enclosure_type,
                    normalized.thumbnail_url,
                    normalized.published_at
                );

                if (insertResult.changes > 0) {
                    count++;
                    const articleId = Number(insertResult.lastInsertRowid);

                    if (normalized.thumbnail_url && shouldCacheThumbnails) {
                        thumbnailUpdates.push({ id: articleId, url: normalized.thumbnail_url });
                    }
                    // Content is now fetched lazily when article is opened (see routes/articles.ts)
                }
            }

            return { count, thumbnailUpdates };
        });

        const { count: insertedCount, thumbnailUpdates } = refreshTransaction(feedData.articles, currentType);
        newArticles = insertedCount;

        // Thumbnail caching is now FIRE-AND-FORGET (non-blocking)
        // This allows feed refresh to complete immediately while thumbnails cache in background
        if (thumbnailUpdates.length > 0) {
            // Don't await - let it run in background
            cacheThumbnailsInBackground(thumbnailUpdates, updateThumbnailStmt).catch(err => {
                console.warn(`[Thumbnails] Background caching failed:`, err);
            });
        }

        // Content fetching is now LAZY - it happens when the user opens an article
        // This dramatically speeds up feed refresh (was the main bottleneck)
        // See: backend/src/routes/articles.ts GET /:id - fetches content on-demand
        // The shouldFetchContent setting now controls whether lazy fetching is enabled,
        // not whether we fetch during refresh


        // Update feed metadata on success
        // Skip icon caching entirely if we already have a cached icon (speeds up refresh)
        const iconCandidate = feedData.favicon;
        const shouldUpdateIconUrl = !!iconCandidate && (!existingIcon?.icon_url || isGenericIconUrl(existingIcon.icon_url));
        // Only cache icon if we don't have one cached yet - this is a significant time saver
        const needsIconCache = !existingIcon?.icon_cached_path && iconCandidate;
        const cachedIcon = needsIconCache ? await cacheFeedIcon(feed.id, iconCandidate) : null;

        let typeUpdate = '';
        const params: any[] = [
            feedData.title,
            feedData.link,
            shouldUpdateIconUrl ? iconCandidate : null,
            cachedIcon?.fileName ?? null,
            cachedIcon?.mime ?? null,
            feedData.description,
        ];

        if (currentType !== feed.type) {
            typeUpdate = ', type = ?';
            params.push(currentType);
        }

        params.push(feed.id);

        const updateParams = [...params];
        updateParams.splice(updateParams.length - 1, 0, refreshIntervalMinutes, refreshIntervalMinutes);

        run(
            `UPDATE feeds SET
        title = CASE 
                    WHEN title = url OR title = 'Direct Feed' OR title = 'Discovered Feed' THEN ?
            ELSE title
        END,
            site_url = COALESCE(site_url, ?),
            icon_url = COALESCE(?, icon_url),
            icon_cached_path = COALESCE(?, icon_cached_path),
            icon_cached_content_type = COALESCE(?, icon_cached_content_type),
            description = COALESCE(description, ?),
            last_fetched_at = datetime('now'),
            next_fetch_at = datetime('now', '+' || ? || ' minutes'),
            refresh_interval_minutes = ?,
            error_count = 0,
            last_error = NULL,
            last_error_at = NULL,
            updated_at = datetime('now')
                ${typeUpdate}
             WHERE id = ? `,
            updateParams
        );

        const updatedFeed = queryOne<{ next_fetch_at: string }>(
            'SELECT next_fetch_at FROM feeds WHERE id = ?',
            [feed.id]
        );

        return { success: true, newArticles, next_fetch_at: updatedFeed?.next_fetch_at };
    } catch (err) {
        const { category, message } = categorizeRefreshError(err);
        const errorMessage = `[${category}] ${message}`;

        // Update feed with error information
        const backoffMinutes = refreshIntervalMinutes * 2;
        run(
            `UPDATE feeds SET
        error_count = error_count + 1,
            last_error = ?,
            last_error_at = datetime('now'),
            next_fetch_at = datetime('now', '+' || ? || ' minutes'),
            refresh_interval_minutes = ?,
            updated_at = datetime('now')
             WHERE id = ? `,
            [errorMessage, backoffMinutes, refreshIntervalMinutes, feed.id]
        );

        return { success: false, newArticles: 0, error: errorMessage };
    }
}
