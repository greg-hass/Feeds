import { run, queryOne } from '../db/index.js';
import { parseFeed, normalizeArticle, FeedType } from './feed-parser.js';
import { cacheFeedIcon } from './icon-cache.js';
import { cacheArticleThumbnail } from './thumbnail-cache.js';
import { getUserSettings } from './settings.js';
import { fetchAndExtractReadability } from './readability.js';

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
 * Refreshes a single feed and inserts new articles.
 * Used by both manual refresh (API endpoint) and scheduled refresh.
 *
 * @param feed - The feed to refresh
 * @returns RefreshResult with success status and new article count
 */
export async function refreshFeed(feed: FeedToRefresh): Promise<RefreshResult> {
    let refreshIntervalMinutes = feed.refresh_interval_minutes;
    try {
        const feedData = await parseFeed(feed.url);
        let newArticles = 0;

        // Get user settings for this feed
        const feedUser = queryOne<{ user_id: number }>('SELECT user_id FROM feeds WHERE id = ?', [feed.id]);
        const userId = feedUser?.user_id || 1; // Default to 1 if not found
        const settings = getUserSettings(userId);
        const shouldFetchContent = settings.fetch_full_content;
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
            const contentUpdates: Array<{ id: number; url: string }> = [];

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

                    if (normalized.url && shouldFetchContent) {
                        contentUpdates.push({ id: articleId, url: normalized.url });
                    }
                }
            }

            return { count, contentUpdates, thumbnailUpdates };
        });

        const { count: insertedCount, contentUpdates, thumbnailUpdates } = refreshTransaction(feedData.articles, currentType);
        newArticles = insertedCount;

        if (thumbnailUpdates.length > 0) {
            const THUMBNAIL_BATCH_SIZE = 8;
            for (let i = 0; i < thumbnailUpdates.length; i += THUMBNAIL_BATCH_SIZE) {
                const batch = thumbnailUpdates.slice(i, i + THUMBNAIL_BATCH_SIZE);
                await Promise.all(batch.map(async (item) => {
                    try {
                        const cachedThumbnail = await cacheArticleThumbnail(item.id, item.url);
                        if (cachedThumbnail) {
                            updateThumbnailStmt.run(cachedThumbnail.fileName, cachedThumbnail.mime, item.id);
                        }
                    } catch (err) {
                        console.warn(`Failed to cache thumbnail for article ${item.id}:`, err);
                    }
                }));
            }
        }

        // Fetch full content if enabled (outside of main transaction)
        if (shouldFetchContent && contentUpdates.length > 0) {
            const updateContentStmt = database.prepare('UPDATE articles SET readability_content = ? WHERE id = ?');
            const CONTENT_BATCH_SIZE = 5; // Smaller batch for heavier content fetching

            for (let i = 0; i < contentUpdates.length; i += CONTENT_BATCH_SIZE) {
                const batch = contentUpdates.slice(i, i + CONTENT_BATCH_SIZE);
                await Promise.all(batch.map(async (item) => {
                    try {
                        const { content } = await fetchAndExtractReadability(item.url);
                        if (content) {
                            // Use a separate transaction for content updates
                            database.transaction(() => {
                                updateContentStmt.run(content, item.id);
                            })();
                        }
                    } catch (err) {
                        console.error(`Failed to fetch content for article ${item.id}: `, err);
                    }
                }));
            }
        }


        // Update feed metadata on success
        const existingIcon = queryOne<{
            icon_url: string | null;
            icon_cached_path: string | null;
            icon_cached_content_type: string | null;
        }>('SELECT icon_url, icon_cached_path, icon_cached_content_type FROM feeds WHERE id = ?', [feed.id]);

        const iconCandidate = feedData.favicon;
        const shouldUpdateIconUrl = !!iconCandidate && (!existingIcon?.icon_url || isGenericIconUrl(existingIcon.icon_url));
        const iconForCache = iconCandidate && (shouldUpdateIconUrl || !existingIcon?.icon_cached_path) ? iconCandidate : null;
        const cachedIcon = iconForCache ? await cacheFeedIcon(feed.id, iconForCache) : null;

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
