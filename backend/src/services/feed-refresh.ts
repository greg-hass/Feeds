import { Database } from 'better-sqlite3';
import { run, queryOne, db } from '../db/index.js';
import { parseFeed, normalizeArticle, FeedType } from './feed-parser.js';
import { fetchYouTubeIcon } from './youtube-parser.js';
import { cacheFeedIcon } from './icon-cache.js';
import { cacheArticleThumbnail } from './thumbnail-cache.js';
import { getUserSettings } from './settings.js';
import { logBackgroundError } from '../utils/error-handler.js';
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

interface IconStatus {
    hasValidIcon: boolean;
    iconUrl: string | null;
    iconCachedPath: string | null;
    iconCachedContentType: string | null;
}

async function getFeedIconStatus(feedId: number, preFetchedHasValidIcon?: boolean): Promise<IconStatus> {
    const existingIcon = queryOne<{
        icon_url: string | null;
        icon_cached_path: string | null;
        icon_cached_content_type: string | null;
    }>('SELECT icon_url, icon_cached_path, icon_cached_content_type FROM feeds WHERE id = ?', [feedId]);
    
    const hasValidIcon = preFetchedHasValidIcon ?? (existingIcon?.icon_url ? !isGenericIconUrl(existingIcon.icon_url) : false);
    
    return {
        hasValidIcon,
        iconUrl: existingIcon?.icon_url ?? null,
        iconCachedPath: existingIcon?.icon_cached_path ?? null,
        iconCachedContentType: existingIcon?.icon_cached_content_type ?? null,
    };
}

interface FeedSettings {
    userId: number;
    refreshIntervalMinutes: number;
}

function getFeedSettings(feedId: number, userId?: number, baseInterval?: number): FeedSettings {
    const userIdResolved = userId ?? queryOne<{ user_id: number }>('SELECT user_id FROM feeds WHERE id = ?', [feedId])?.user_id ?? 1;
    const settings = getUserSettings(userIdResolved);
    
    return {
        userId: userIdResolved,
        refreshIntervalMinutes: settings.refresh_interval_minutes ?? baseInterval ?? 30,
    };
}

interface ArticleInsertResult {
    insertedCount: number;
    thumbnailUpdates: Array<{ id: number; url: string }>;
}

function insertArticles(
    database: Database,
    feedId: number,
    articles: any[],
    feedType: FeedType,
    shouldCacheThumbnails: boolean
): ArticleInsertResult {
    const insertArticle = `
        INSERT OR IGNORE INTO articles
        (feed_id, guid, title, url, author, summary, content, enclosure_url, enclosure_type, thumbnail_url, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const insertStmt = database.prepare(insertArticle);
    const updateThumbnailStmt = database.prepare(
        `UPDATE articles SET thumbnail_cached_path = ?, thumbnail_cached_content_type = ? WHERE id = ?`
    );
    
    const transaction = database.transaction((items: any[], type: FeedType) => {
        let count = 0;
        const thumbnailUpdates: Array<{ id: number; url: string }> = [];
        
        for (const article of items) {
            const normalized = normalizeArticle(article, type);
            const insertResult = insertStmt.run(
                feedId,
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
            }
        }
        
        return { count, thumbnailUpdates };
    });
    
    const { count, thumbnailUpdates } = transaction(articles, feedType);
    
    return { insertedCount: count, thumbnailUpdates };
}

async function updateFeedMetadata(
    feedId: number,
    feedData: any,
    newType: FeedType,
    oldType: FeedType,
    refreshIntervalMinutes: number,
    iconStatus: IconStatus,
    cachedIcon: { fileName: string | null; mime: string | null } | null,
    finalFavicon: string | null = null
): Promise<string | null> {
    const iconCandidate = finalFavicon || feedData.favicon;
    const shouldUpdateIconUrl = !!iconCandidate && (!iconStatus.iconUrl || isGenericIconUrl(iconStatus.iconUrl));
    
    // Prepare values for update
    const titleUpdate = feedData.title;
    const siteUrlUpdate = feedData.link;
    const iconUrlUpdate = shouldUpdateIconUrl ? iconCandidate : null;
    const iconPathUpdate = cachedIcon?.fileName ?? null;
    const iconMimeUpdate = cachedIcon?.mime ?? null;
    const descUpdate = feedData.description;

    const params: any[] = [
        titleUpdate,        // for title CASE
        siteUrlUpdate,      // for site_url COALESCE
        iconUrlUpdate,      // for icon_url COALESCE
        iconPathUpdate,     // for icon_cached_path COALESCE
        iconMimeUpdate,     // for icon_cached_content_type COALESCE
        descUpdate,         // for description COALESCE
        refreshIntervalMinutes, // for next_fetch_at
        refreshIntervalMinutes, // for refresh_interval_minutes
    ];

    let typeClause = '';
    if (newType !== oldType) {
        typeClause = ', type = ?';
        params.push(newType);
    }
    
    params.push(feedId);

    // SQL broken down for readability
    const sql = `
        UPDATE feeds SET
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
            next_fetch_at = datetime('now', '+' || CAST(? AS INTEGER) || ' minutes'),
            refresh_interval_minutes = ?,
            error_count = 0,
            last_error = NULL,
            last_error_at = NULL,
            updated_at = datetime('now')
            ${typeClause}
        WHERE id = ?
    `;
    
    run(sql, params);
    
    const updatedFeed = queryOne<{ next_fetch_at: string }>(
        'SELECT next_fetch_at FROM feeds WHERE id = ?',
        [feedId]
    );
    
    return updatedFeed?.next_fetch_at ?? null;
}

async function handleRefreshError(
    feedId: number,
    err: unknown,
    refreshIntervalMinutes: number
): Promise<{ success: false; newArticles: 0; error: string }> {
    const { category, message } = categorizeRefreshError(err);
    const errorMessage = `[${category}] ${message}`;
    const backoffMinutes = Math.min(refreshIntervalMinutes * 2, 300);
    
    run(
        `UPDATE feeds SET
        error_count = error_count + 1,
            last_error = ?,
            last_error_at = datetime('now'),
            next_fetch_at = datetime('now', '+' || CAST(? AS INTEGER) || ' minutes'),
            refresh_interval_minutes = ?,
            updated_at = datetime('now')
             WHERE id = ? `,
        [errorMessage, backoffMinutes, refreshIntervalMinutes, feedId]
    );
    
    return { success: false, newArticles: 0, error: errorMessage };
}

/**
 * Simple concurrency-limited queue for background tasks
 */
class TaskQueue {
    private running = 0;
    private queue: (() => Promise<void>)[] = [];
    private maxConcurrency: number;

    constructor(maxConcurrency: number) {
        this.maxConcurrency = maxConcurrency;
    }

    async add(task: () => Promise<void>) {
        if (this.running >= this.maxConcurrency) {
            this.queue.push(task);
            return;
        }

        this.running++;
        try {
            await task();
        } finally {
            this.running--;
            this.next();
        }
    }

    private async next() {
        if (this.queue.length > 0 && this.running < this.maxConcurrency) {
            const task = this.queue.shift();
            if (task) {
                this.running++;
                try {
                    await task();
                } finally {
                    this.running--;
                    this.next();
                }
            }
        }
    }
}

// Global queue for image caching to prevent saturating the connection pool
const imageCacheQueue = new TaskQueue(15);

/**
 * Cache thumbnails in the background without blocking feed refresh.
 * Uses smaller batches and no retries for speed.
 */
async function cacheThumbnailsInBackground(
    thumbnailUpdates: Array<{ id: number; url: string }>,
    updateThumbnailStmt: any
): Promise<void> {
    // Process thumbnails through the global concurrency-limited queue
    thumbnailUpdates.forEach(item => {
        imageCacheQueue.add(async () => {
            try {
                const cachedThumbnail = await cacheArticleThumbnail(item.id, item.url);
                if (cachedThumbnail) {
                    updateThumbnailStmt.run(
                        cachedThumbnail.fileName,
                        cachedThumbnail.mime,
                        item.id
                    );
                }
            } catch (err) {
                logBackgroundError('Thumbnail Cache', err, { articleId: item.id, url: item.url });
            }
        });
    });
}

/**
 * Extended feed info with cached icon status for batch optimization
 */
export interface FeedToRefreshWithCache extends FeedToRefresh {
    hasValidIcon?: boolean;
    userId?: number;
    signal?: AbortSignal;
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
    const database = db();
    
    try {
        const iconStatus = await getFeedIconStatus(feed.id, feed.hasValidIcon);
        
        // Determine if we need to fetch a fresh icon
        // For YouTube feeds with generic icons, we always try to get a better icon
        const hasGenericIcon = iconStatus.iconUrl ? isGenericIconUrl(iconStatus.iconUrl) : true;
        const isYouTubeFeed = feed.type === 'youtube' || feed.url.includes('youtube.com/feeds');
        const shouldFetchFreshIcon = isYouTubeFeed && hasGenericIcon;
        
        // Only skip icon fetch if we have a valid non-generic icon cached
        const shouldSkipIconFetch = !shouldFetchFreshIcon && iconStatus.hasValidIcon && !!iconStatus.iconCachedPath;
        const feedData = await parseFeed(feed.url, { skipIconFetch: shouldSkipIconFetch, signal: feed.signal });
        
        const { userId, refreshIntervalMinutes: updatedInterval } = getFeedSettings(
            feed.id,
            feed.userId,
            feed.refresh_interval_minutes
        );
        refreshIntervalMinutes = updatedInterval;
        
        let currentType = feed.type;
        if (currentType === 'rss') {
            const { detectFeedType } = await import('./feed-parser.js');
            currentType = detectFeedType(feed.url, feedData);
        }
        
        const { insertedCount, thumbnailUpdates } = insertArticles(
            database,
            feed.id,
            feedData.articles,
            currentType,
            true
        );
        
        if (thumbnailUpdates.length > 0) {
            const updateThumbnailStmt = database.prepare(
                `UPDATE articles SET thumbnail_cached_path = ?, thumbnail_cached_content_type = ? WHERE id = ?`
            );
            cacheThumbnailsInBackground(thumbnailUpdates, updateThumbnailStmt).catch(err => {
                console.warn(`[Thumbnails] Background caching failed:`, err);
            });
        }
        
        // For YouTube feeds with generic icons, try to fetch a proper channel icon
        let finalFavicon = feedData.favicon;
        if (isYouTubeFeed && hasGenericIcon && feedData.youtubeChannelId) {
            try {
                const youtubeIcon = await fetchYouTubeIcon(feedData.youtubeChannelId);
                if (youtubeIcon && !isGenericIconUrl(youtubeIcon)) {
                    finalFavicon = youtubeIcon;
                }
            } catch (iconErr) {
                console.warn(`[Refresh] Failed to fetch YouTube icon for ${feed.id}:`, iconErr);
            }
        }
        
        // Cache icon if: (no cached icon OR current icon is generic) AND we have a valid favicon
        const needsIconCache = (!iconStatus.iconCachedPath || hasGenericIcon) && finalFavicon && !isGenericIconUrl(finalFavicon);
        const cachedIcon = needsIconCache ? await cacheFeedIcon(feed.id, finalFavicon!) : null;
        
        const nextFetchAt = await updateFeedMetadata(
            feed.id,
            feedData,
            currentType,
            feed.type,
            refreshIntervalMinutes,
            iconStatus,
            cachedIcon,
            finalFavicon
        );
        
        return { success: true, newArticles: insertedCount, next_fetch_at: nextFetchAt ?? undefined };
    } catch (err) {
        return handleRefreshError(feed.id, err, refreshIntervalMinutes);
    }
}
