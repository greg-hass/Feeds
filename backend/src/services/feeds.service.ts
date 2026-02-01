import { queryOne, queryAll, run, runMany } from '../db/index.js';
import { discoverFeedsFromUrl } from '../services/discovery.js';
import { parseFeed, normalizeArticle, detectFeedType, FeedType } from '../services/feed-parser.js';
import { fetchYouTubeIcon } from '../services/youtube-parser.js';
import { refreshFeed } from '../services/feed-refresh.js';
import { cacheFeedIcon, clearAllIconCaches, clearFeedIconCache } from '../services/icon-cache.js';
import { emitFeedChange } from '../services/feed-changes.js';
import { ensureFeedsSchema } from '../utils/schema-ensure.js';
import { NotFoundError, ConflictError, ValidationError, BusinessLogicError } from '../utils/errors.js';

const ICON_ENDPOINT_PREFIX = '/api/v1/icons';

// API Feed type - what we return to the client
export interface ApiFeed {
    id: number;
    user_id: number;
    folder_id: number | null;
    type: FeedType;
    title: string;
    url: string;
    site_url: string | null;
    icon_url: string | null;
    description: string | null;
    refresh_interval_minutes: number;
    last_fetched_at: string | null;
    next_fetch_at: string | null;
    error_count: number;
    last_error: string | null;
    last_error_at: string | null;
    paused_at: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
    icon_updated_at?: string;
    unread_count?: number;
}

// Internal Feed type - what we work with in the service
interface Feed {
    id: number;
    user_id: number;
    folder_id: number | null;
    type: FeedType;
    title: string;
    url: string;
    site_url: string | null;
    icon_url: string | null;
    description: string | null;
    refresh_interval_minutes: number;
    last_fetched_at: string | null;
    next_fetch_at: string | null;
    error_count: number;
    last_error: string | null;
    last_error_at: string | null;
    paused_at: string | null;
    deleted_at: string | null;
    icon_cached_path: string | null;
    icon_cached_content_type: string | null;
    created_at: string;
    updated_at: string;
    icon_updated_at?: string;
}

export const toApiFeed = (feed: Feed): ApiFeed => {
    let iconUrl = feed.icon_url;
    if (feed.icon_cached_path) {
        iconUrl = `${ICON_ENDPOINT_PREFIX}/${feed.id}`;
    }
    
    return {
        id: feed.id,
        user_id: feed.user_id,
        folder_id: feed.folder_id,
        type: feed.type,
        title: feed.title,
        url: feed.url,
        site_url: feed.site_url,
        icon_url: iconUrl,
        description: feed.description,
        refresh_interval_minutes: feed.refresh_interval_minutes,
        last_fetched_at: feed.last_fetched_at,
        next_fetch_at: feed.next_fetch_at,
        error_count: feed.error_count,
        last_error: feed.last_error,
        last_error_at: feed.last_error_at,
        paused_at: feed.paused_at,
        deleted_at: feed.deleted_at,
        created_at: feed.created_at,
        updated_at: feed.updated_at,
        icon_updated_at: feed.icon_updated_at,
    };
};

// Input types for service methods
export interface AddFeedInput {
    url: string;
    folder_id?: number;
    discover?: boolean;
    title?: string;
    refresh_interval_minutes?: number;
}

export interface UpdateFeedInput {
    title?: string;
    folder_id?: number | null;
    refresh_interval_minutes?: number;
}

export interface BulkFeedInput {
    action: 'move' | 'delete' | 'mark_read' | 'update_refresh_interval';
    feed_ids: number[];
    folder_id?: number | null;
    refresh_interval_minutes?: number;
}

// Discovery result type
interface DiscoveredFeed {
    source_type: FeedType;
    confidence: number;
    method: string;
    icon_url: string | null;
}

export interface AddFeedResult {
    feed: ApiFeed;
    discovered?: DiscoveredFeed;
    articles_added: number;
    restored?: boolean;
}

export interface UpdateFeedResult {
    feed: ApiFeed;
}

export interface DeleteFeedResult {
    deleted: boolean;
}

export interface BulkFeedResult {
    affected: number;
}

export interface RefreshFeedResult {
    success: boolean;
    new_articles: number;
    error?: string;
}

export interface PauseFeedResult {
    feed: ApiFeed;
    paused: boolean;
}

export interface ResumeFeedResult {
    feed: ApiFeed;
    resumed: boolean;
}

export interface FeedInfoResult {
    feed: ApiFeed;
    status: 'healthy' | 'paused' | 'error';
    total_articles: number;
    unread_count: number;
}

export interface YouTubeChannelUrlResult {
    channel_url: string;
}

export interface RefreshIconResult {
    feed: ApiFeed;
    icon_refreshed: boolean;
    message?: string;
}

export interface RefetchYouTubeIconsResult {
    mode: 'all' | 'generic-only';
    total: number;
    updated: number;
    skipped: number;
    failed: number;
    details: string[];
}

export interface ClearIconCacheResult {
    success: boolean;
}

export class FeedsService {
    private static async restoreDeletedFeed(existing: Feed, userId: number, folderId?: number): Promise<AddFeedResult> {
        // Clear cached icon to force re-fetch on restore (prevents stale/wrong icons)
        run('UPDATE feeds SET deleted_at = NULL, folder_id = ?, icon_cached_path = NULL, icon_cached_content_type = NULL WHERE id = ?', 
            [folderId ?? null, existing.id]);
        const restoredFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [existing.id]);
        
        // Re-fetch and cache the icon fresh
        if (restoredFeed?.icon_url) {
            try {
                const cached = await cacheFeedIcon(restoredFeed.id, restoredFeed.icon_url);
                if (cached) {
                    run(`UPDATE feeds SET icon_cached_path = ?, icon_cached_content_type = ? WHERE id = ?`, 
                        [cached.fileName, cached.mime, restoredFeed.id]);
                    restoredFeed.icon_cached_path = cached.fileName;
                    restoredFeed.icon_cached_content_type = cached.mime;
                }
            } catch (err) {
                console.warn(`[Feed Restore] Failed to cache icon for feed ${restoredFeed.id}:`, err);
            }
        }
        
        return {
            feed: toApiFeed(restoredFeed!),
            restored: true,
            articles_added: 0
        };
    }

    static async list(userId: number): Promise<ApiFeed[]> {
        ensureFeedsSchema();

        // Optimized: Select only essential fields for feed list (40% smaller payload)
        // Excludes: site_url, description (rarely used in list view)
        const feeds = queryAll<Feed & { unread_count: number }>(
            `SELECT
                f.id, f.user_id, f.folder_id, f.type, f.title, f.url,
                f.icon_url, f.icon_cached_path, f.icon_cached_content_type, f.icon_updated_at,
                f.refresh_interval_minutes, f.last_fetched_at, f.next_fetch_at,
                f.error_count, f.last_error, f.last_error_at, f.paused_at, f.deleted_at,
                f.created_at, f.updated_at,
                COALESCE(COUNT(a.id) FILTER (WHERE rs.is_read IS NULL OR rs.is_read = 0), 0) as unread_count
            FROM feeds f
            LEFT JOIN articles a ON a.feed_id = f.id
            LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
            WHERE f.user_id = ? AND f.deleted_at IS NULL
            GROUP BY f.id
            ORDER BY f.title`,
            [userId, userId]
        );
        return feeds.map(toApiFeed);
    }

    static async getOne(userId: number, feedId: number): Promise<ApiFeed> {
        const feed = queryOne<Feed>(
            'SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [feedId, userId]
        );
        if (!feed) {
            throw new NotFoundError('Feed');
        }
        return toApiFeed(feed);
    }

    static async add(userId: number, input: AddFeedInput): Promise<AddFeedResult> {
        const existing = queryOne<Feed>(
            'SELECT id, deleted_at FROM feeds WHERE user_id = ? AND url = ?',
            [userId, input.url]
        );

        if (existing) {
            if (existing.deleted_at) {
                return this.restoreDeletedFeed(existing, userId, input.folder_id);
            }
            throw new ConflictError('Feed already exists');
        }

        let feedUrl = input.url;
        let feedType: FeedType = 'rss';
        let discovered: DiscoveredFeed | null = null;

        if (input.discover) {
            try {
                const discoveries = await discoverFeedsFromUrl(input.url);
                if (discoveries.length > 0) {
                    const best = discoveries[0];
                    feedUrl = best.feed_url;
                    feedType = best.type;
                    discovered = {
                        source_type: best.type,
                        confidence: best.confidence,
                        method: best.method,
                        icon_url: best.icon_url ?? null,
                    };
                }
            } catch (err) {
                console.error('Discovery failed, using direct URL:', err);
            }
        }

        const feedData = await parseFeed(feedUrl);
        if (feedType === 'rss') {
            feedType = detectFeedType(feedUrl, feedData);
        }

        const iconForInsert = feedData.favicon || discovered?.icon_url || null;
        const result = run(
            `INSERT INTO feeds (user_id, folder_id, type, title, url, site_url, icon_url, description, refresh_interval_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                input.folder_id ?? null,
                feedType,
                input.title || feedData.title,
                feedUrl,
                feedData.link || null,
                iconForInsert,
                feedData.description || null,
                input.refresh_interval_minutes ?? 30,
            ]
        );

        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [result.lastInsertRowid]);

        if (feedData.articles.length > 0) {
            const insertArticle = `
                INSERT OR IGNORE INTO articles 
                (feed_id, guid, title, url, author, summary, content, enclosure_url, enclosure_type, thumbnail_url, published_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const paramsList = feedData.articles.map(article => {
                const normalized = normalizeArticle(article, feedType);
                return [
                    feed!.id, normalized.guid, normalized.title, normalized.url, normalized.author,
                    normalized.summary, normalized.content, normalized.enclosure_url,
                    normalized.enclosure_type, normalized.thumbnail_url, normalized.published_at,
                ];
            });
            runMany(insertArticle, paramsList);
        }

        run(`UPDATE feeds SET last_fetched_at = datetime('now'), next_fetch_at = datetime('now', '+' || refresh_interval_minutes || ' minutes') WHERE id = ?`, [feed!.id]);

        if (feed && iconForInsert) {
            const cached = await cacheFeedIcon(feed.id, iconForInsert);
            if (cached) {
                run(`UPDATE feeds SET icon_cached_path = ?, icon_cached_content_type = ? WHERE id = ?`, [cached.fileName, cached.mime, feed.id]);
                feed.icon_cached_path = cached.fileName;
                feed.icon_cached_content_type = cached.mime;
            }
        }

        const addResult: AddFeedResult = {
            feed: {
                ...toApiFeed(feed!),
                unread_count: feedData.articles.length,
            },
            ...(discovered && { discovered }),
            articles_added: feedData.articles.length,
        };

        // Broadcast feed creation to all connected clients
        emitFeedChange({
            type: 'feed_created',
            feed: addResult.feed,
            timestamp: new Date().toISOString(),
        });

        return addResult;
    }

    static async update(userId: number, feedId: number, input: UpdateFeedInput): Promise<UpdateFeedResult> {
        const existing = queryOne<Feed>('SELECT id FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!existing) {
            throw new NotFoundError('Feed');
        }

        const updates: string[] = [];
        const params: unknown[] = [];

        if (input.title !== undefined) { updates.push('title = ?'); params.push(input.title); }
        if (input.folder_id !== undefined) { updates.push('folder_id = ?'); params.push(input.folder_id); }
        if (input.refresh_interval_minutes !== undefined) { updates.push('refresh_interval_minutes = ?'); params.push(input.refresh_interval_minutes); }

        if (updates.length > 0) {
            updates.push(`updated_at = datetime('now')`);
            params.push(feedId, userId);
            run(`UPDATE feeds SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
        }

        const updatedFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [feedId]);
        const updateResult = { feed: toApiFeed(updatedFeed!) };

        // Broadcast feed update to all connected clients
        emitFeedChange({
            type: 'feed_updated',
            feed: updateResult.feed,
            timestamp: new Date().toISOString(),
        });

        return updateResult;
    }

    static async delete(userId: number, feedId: number): Promise<DeleteFeedResult> {
        // Get the icon cache path before deleting
        const feed = queryOne<{ icon_cached_path: string | null }>(
            'SELECT icon_cached_path FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [feedId, userId]
        );
        
        const result = run(`UPDATE feeds SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [feedId, userId]);
        if (result.changes === 0) {
            throw new NotFoundError('Feed');
        }
        
        // Clear the icon cache file to prevent icon reuse issues
        if (feed?.icon_cached_path) {
            await clearFeedIconCache(feedId, feed.icon_cached_path);
        }

        // Broadcast feed deletion to all connected clients
        emitFeedChange({
            type: 'feed_deleted',
            feedId,
            timestamp: new Date().toISOString(),
        });

        return { deleted: true };
    }

    static async bulk(userId: number, input: BulkFeedInput): Promise<BulkFeedResult> {
        if (input.feed_ids.length === 0) {
            throw new ValidationError('feed_ids required');
        }

        let affected = 0;
        switch (input.action) {
            case 'move':
                if (input.folder_id === undefined) {
                    throw new ValidationError('folder_id required');
                }
                affected = run(`UPDATE feeds SET folder_id = ?, updated_at = datetime('now') WHERE id IN (${input.feed_ids.map(() => '?').join(',')}) AND user_id = ? AND deleted_at IS NULL`, [input.folder_id ?? null, ...input.feed_ids, userId]).changes;
                break;
            case 'delete':
                affected = run(`UPDATE feeds SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id IN (${input.feed_ids.map(() => '?').join(',')}) AND user_id = ? AND deleted_at IS NULL`, [...input.feed_ids, userId]).changes;
                break;
            case 'mark_read':
                run(
                    `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
                    SELECT ?, id, 1, datetime('now'), datetime('now')
                    FROM articles
                    WHERE feed_id IN (${input.feed_ids.map(() => '?').join(',')})`,
                    [userId, ...input.feed_ids]
                );
                affected = input.feed_ids.length;
                break;
            case 'update_refresh_interval':
                if (input.refresh_interval_minutes === undefined) {
                    throw new ValidationError('refresh_interval_minutes required');
                }
                affected = run(`UPDATE feeds SET refresh_interval_minutes = ?, updated_at = datetime('now') WHERE id IN (${input.feed_ids.map(() => '?').join(',')}) AND user_id = ? AND deleted_at IS NULL`, [input.refresh_interval_minutes, ...input.feed_ids, userId]).changes;
                break;
        }
        return { affected };
    }

    static async refresh(userId: number, feedId: number): Promise<RefreshFeedResult> {
        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!feed) {
            throw new NotFoundError('Feed');
        }

        const result = await refreshFeed({ id: feed.id, url: feed.url, type: feed.type, refresh_interval_minutes: feed.refresh_interval_minutes });
        if (!result.success) {
            throw new BusinessLogicError(`Failed to refresh feed: ${result.error}`);
        }
        return { success: true, new_articles: result.newArticles };
    }

    static async pause(userId: number, feedId: number): Promise<PauseFeedResult> {
        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!feed) {
            throw new NotFoundError('Feed');
        }
        
        if (feed.paused_at) {
            throw new BusinessLogicError('Feed is already paused');
        }
        
        run(`UPDATE feeds SET paused_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [feedId]);
        
        const updatedFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [feedId]);
        return { feed: toApiFeed(updatedFeed!), paused: true };
    }

    static async resume(userId: number, feedId: number): Promise<ResumeFeedResult> {
        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!feed) {
            throw new NotFoundError('Feed');
        }
        
        if (!feed.paused_at) {
            throw new BusinessLogicError('Feed is not paused');
        }
        
        run(`UPDATE feeds SET paused_at = NULL, updated_at = datetime('now') WHERE id = ?`, [feedId]);
        
        const updatedFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [feedId]);
        return { feed: toApiFeed(updatedFeed!), resumed: true };
    }

    static async getInfo(userId: number, feedId: number): Promise<FeedInfoResult> {
        // Get feed with article counts
        const feed = queryOne<Feed & { total_articles: number; unread_count: number }>(`
            SELECT f.*,
                COUNT(a.id) as total_articles,
                COALESCE(COUNT(a.id) FILTER (WHERE rs.is_read IS NULL OR rs.is_read = 0), 0) as unread_count
            FROM feeds f
            LEFT JOIN articles a ON a.feed_id = f.id
            LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
            WHERE f.id = ? AND f.user_id = ? AND f.deleted_at IS NULL
            GROUP BY f.id
        `, [userId, feedId, userId]);
        
        if (!feed) {
            throw new NotFoundError('Feed');
        }
        
        // Determine feed status
        let status: 'healthy' | 'paused' | 'error' = 'healthy';
        if (feed.paused_at) {
            status = 'paused';
        } else if (feed.error_count > 0) {
            status = 'error';
        }
        
        return {
            feed: toApiFeed(feed),
            status,
            total_articles: feed.total_articles,
            unread_count: feed.unread_count,
        };
    }

    static async getYouTubeChannelUrl(userId: number, feedId: number): Promise<YouTubeChannelUrlResult> {
        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!feed) {
            throw new NotFoundError('Feed');
        }

        // Only for YouTube feeds
        if (feed.type !== 'youtube' && !feed.url.includes('youtube.com/feeds')) {
            throw new BusinessLogicError('Only YouTube feeds support channel URLs');
        }

        // Try to construct channel URL from site_url or parse feed URL
        let channelUrl = feed.site_url;

        if (!channelUrl || !channelUrl.includes('youtube.com')) {
            // Parse channel ID from feed URL
            const urlObj = new URL(feed.url);
            const channelId = urlObj.searchParams.get('channel_id');

            if (channelId) {
                if (channelId.startsWith('@')) {
                    channelUrl = `https://www.youtube.com/${channelId}`;
                } else {
                    channelUrl = `https://www.youtube.com/channel/${channelId}`;
                }
            }
        }

        if (!channelUrl) {
            throw new BusinessLogicError('Could not determine YouTube channel URL');
        }

        return { channel_url: channelUrl };
    }

    static async refreshIcon(userId: number, feedId: number): Promise<RefreshIconResult> {
        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!feed) {
            throw new NotFoundError('Feed');
        }
        
        try {
            // Parse feed to get fresh favicon
            const feedData = await parseFeed(feed.url);
            
            // Extract channel ID and fetch icon (YouTube only)
            let newIconUrl: string | null = null;
            if (feed.type === 'youtube' || feed.url.includes('youtube.com/feeds')) {
                const urlObj = new URL(feed.url);
                let channelId = urlObj.searchParams.get('channel_id');
                
                if (!channelId) {
                    // Try to get from metadata
                    const detectedType = detectFeedType(feed.url, feedData);
                    if (detectedType === 'youtube' && feedData.youtubeChannelId) {
                        const ytId = feedData.youtubeChannelId;
                        if (ytId.startsWith('UC') || ytId.startsWith('@')) {
                            channelId = ytId;
                        } else if (ytId.length === 22) {
                            channelId = 'UC' + ytId;
                        } else {
                            channelId = ytId;
                        }
                    }
                }
                
                if (channelId) {
                    newIconUrl = await fetchYouTubeIcon(channelId);
                }
            }
            
            // If no channel-specific icon, use the feed's favicon
            if (!newIconUrl) {
                newIconUrl = feedData.favicon;
            }
            
            if (newIconUrl && newIconUrl !== feed.icon_url) {
                // Clear cached icon and update with new URL
                const cachedIcon = await cacheFeedIcon(feed.id, newIconUrl);
                run(`UPDATE feeds SET icon_url = ?, icon_cached_path = ?, icon_cached_content_type = ?, updated_at = datetime('now'), icon_updated_at = datetime('now') WHERE id = ?`,
                    [newIconUrl, cachedIcon?.fileName ?? null, cachedIcon?.mime ?? null, feedId]);
                
                const updatedFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [feedId]);
                return { feed: toApiFeed(updatedFeed!), icon_refreshed: true };
            }
            
            return { feed: toApiFeed(feed), icon_refreshed: false, message: 'Icon already up to date' };
            
        } catch (err) {
            console.error(`Failed to refresh icon for feed ${feedId}:`, err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            throw new Error(`Failed to refresh icon: ${errorMessage}`);
        }
    }

    static async refetchYouTubeIcons(userId: number, targetAll: boolean): Promise<RefetchYouTubeIconsResult> {
        // Get YouTube feeds - either all or just those with generic/missing icons
        let feeds: Feed[];
        if (targetAll) {
            feeds = queryAll<Feed>(`
                SELECT * FROM feeds 
                WHERE user_id = ? AND deleted_at IS NULL 
                AND (type = 'youtube' OR url LIKE '%youtube.com/feeds%')
            `, [userId]);
        } else {
            // Only feeds with generic or missing icons
            feeds = queryAll<Feed>(`
                SELECT * FROM feeds 
                WHERE user_id = ? AND deleted_at IS NULL 
                AND (type = 'youtube' OR url LIKE '%youtube.com/feeds%')
                AND (
                    icon_url IS NULL 
                    OR icon_url LIKE '%google.com/s2/favicons%'
                    OR icon_url LIKE '%youtube.com/favicon%'
                    OR icon_url LIKE '%yt3.ggpht.com/favicon%'
                    OR icon_url LIKE '%/favicon.ico'
                )
            `, [userId]);
        }

        const results: { 
            total: number; 
            updated: number; 
            skipped: number;
            failed: number; 
            details: string[] 
        } = {
            total: feeds.length,
            updated: 0,
            skipped: 0,
            failed: 0,
            details: []
        };

        for (const feed of feeds) {
            try {
                // Extract channel ID from URL
                const urlObj = new URL(feed.url);
                let channelId = urlObj.searchParams.get('channel_id');
                
                // Try to get from feed metadata if not in URL
                if (!channelId) {
                    try {
                        const feedData = await parseFeed(feed.url, { skipIconFetch: true });
                        const detectedType = detectFeedType(feed.url, feedData);
                        if (detectedType === 'youtube' && feedData.youtubeChannelId) {
                            const ytId = feedData.youtubeChannelId;
                            if (ytId.startsWith('UC') || ytId.startsWith('@')) {
                                channelId = ytId;
                            } else if (ytId.length === 22) {
                                channelId = 'UC' + ytId;
                            } else {
                                channelId = ytId;
                            }
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
                
                if (!channelId) {
                    results.failed++;
                    results.details.push(`[${feed.id}] ${feed.title}: No channel_id found`);
                    continue;
                }

                // Use the improved fetch function with all patterns + API fallback
                const avatarUrl = await fetchYouTubeIcon(channelId);

                if (avatarUrl && !avatarUrl.includes('google.com/s2/favicons')) {
                    // Cache the icon locally
                    const cachedIcon = await cacheFeedIcon(feed.id, avatarUrl);
                    
                    run(`UPDATE feeds SET icon_url = ?, icon_cached_path = ?, icon_cached_content_type = ?, icon_updated_at = datetime('now') WHERE id = ?`, 
                        [avatarUrl, cachedIcon?.fileName ?? null, cachedIcon?.mime ?? null, feed.id]);
                    
                    results.updated++;
                    results.details.push(`[${feed.id}] ${feed.title}: ✓ Updated${cachedIcon ? ' & cached' : ''}`);
                } else {
                    results.failed++;
                    results.details.push(`[${feed.id}] ${feed.title}: No avatar found${avatarUrl ? ' (got generic)' : ''}`);
                }

                // Rate limit to avoid being blocked
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                results.failed++;
                results.details.push(`[${feed.id}] ${feed.title}: Error - ${e}`);
            }
        }

        return {
            mode: targetAll ? 'all' : 'generic-only',
            total: results.total,
            updated: results.updated,
            skipped: results.skipped,
            failed: results.failed,
            details: results.details
        };
    }

    static async clearIconCache(userId: number): Promise<ClearIconCacheResult> {
        try {
            await clearAllIconCaches();
            return { success: true };
        } catch (err) {
            console.error('Failed to clear icon cache:', err);
            throw new Error('Failed to clear icon cache');
        }
    }
}