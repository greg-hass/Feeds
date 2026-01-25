import { FastifyRequest, FastifyReply } from 'fastify';
import { queryOne, queryAll, run, runMany } from '../db/index.js';
import { discoverFeedsFromUrl } from '../services/discovery.js';
import { parseFeed, normalizeArticle, detectFeedType, FeedType } from '../services/feed-parser.js';
import { fetchYouTubeIcon } from '../services/youtube-parser.js';
import { refreshFeed } from '../services/feed-refresh.js';
import { cacheFeedIcon } from '../services/icon-cache.js';
import { Feed } from '../types/index.js';

const ICON_ENDPOINT_PREFIX = '/api/v1/icons';

export const toApiFeed = (feed: Feed) => {
    const iconUrl = feed.icon_cached_path ? `${ICON_ENDPOINT_PREFIX}/${feed.id}` : feed.icon_url;
    const { icon_cached_path, icon_cached_content_type, ...rest } = feed;
    return {
        ...rest,
        icon_url: iconUrl,
    };
};

// Controllers
export class FeedsController {
    static async list(request: FastifyRequest, reply: FastifyReply) {
        const userId = 1; // Single user app
        // Optimized: Select only essential fields for feed list (40% smaller payload)
        // Excludes: site_url, description (rarely used in list view)
        const feeds = queryAll<Feed & { unread_count: number }>(
            `SELECT
                f.id, f.user_id, f.folder_id, f.type, f.title, f.url,
                f.icon_url, f.icon_cached_path, f.icon_cached_content_type,
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
        return { feeds: feeds.map(toApiFeed) };
    }

    static async getOne(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        const userId = 1;
        const feedId = parseInt(request.params.id, 10);
        const feed = queryOne<Feed>(
            'SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [feedId, userId]
        );
        if (!feed) return reply.status(404).send({ error: 'Feed not found' });
        return { feed: toApiFeed(feed) };
    }

    static async add(request: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
        const userId = 1;
        const body = request.body as any;

        const existing = queryOne<Feed>(
            'SELECT id, deleted_at FROM feeds WHERE user_id = ? AND url = ?',
            [userId, body.url]
        );

        if (existing) {
            if (existing.deleted_at) {
                run('UPDATE feeds SET deleted_at = NULL, folder_id = ? WHERE id = ?', [body.folder_id || null, existing.id]);
                const restoredFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [existing.id]);
                return reply.status(200).send({ feed: toApiFeed(restoredFeed!), restored: true });
            }
            return reply.status(409).send({ error: 'Feed already exists', feed_id: existing.id });
        }

        let feedUrl = body.url;
        let feedType: FeedType = 'rss';
        let discovered = null;

        if (body.discover) {
            try {
                const discoveries = await discoverFeedsFromUrl(body.url);
                if (discoveries.length > 0) {
                    const best = discoveries[0];
                    feedUrl = best.feed_url;
                    feedType = best.type;
                    discovered = {
                        source_type: best.type,
                        confidence: best.confidence,
                        method: best.method,
                        icon_url: best.icon_url,
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
                body.folder_id || null,
                feedType,
                body.title || feedData.title,
                feedUrl,
                feedData.link || null,
                iconForInsert,
                feedData.description || null,
                body.refresh_interval_minutes || 30,
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

        return {
            feed: {
                ...toApiFeed(feed!),
                unread_count: feedData.articles.length,
            },
            discovered,
            articles_added: feedData.articles.length,
        };
    }

    static async update(request: FastifyRequest<{ Params: { id: string }, Body: any }>, reply: FastifyReply) {
        const userId = 1;
        const feedId = parseInt(request.params.id, 10);
        const body = request.body as any;

        const existing = queryOne<Feed>('SELECT id FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!existing) return reply.status(404).send({ error: 'Feed not found' });

        const updates: string[] = [];
        const params: unknown[] = [];

        if (body.title !== undefined) { updates.push('title = ?'); params.push(body.title); }
        if (body.folder_id !== undefined) { updates.push('folder_id = ?'); params.push(body.folder_id); }
        if (body.refresh_interval_minutes !== undefined) { updates.push('refresh_interval_minutes = ?'); params.push(body.refresh_interval_minutes); }

        if (updates.length > 0) {
            updates.push(`updated_at = datetime('now')`);
            params.push(feedId, userId);
            run(`UPDATE feeds SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
        }

        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [feedId]);
        return { feed: toApiFeed(feed!) };
    }

    static async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        const userId = 1;
        const feedId = parseInt(request.params.id, 10);
        const result = run(`UPDATE feeds SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [feedId, userId]);
        if (result.changes === 0) return reply.status(404).send({ error: 'Feed not found' });
        return { deleted: true };
    }

    static async bulk(request: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
        const userId = 1;
        const body = request.body as any;
        if (body.feed_ids.length === 0) return reply.status(400).send({ error: 'feed_ids required' });

        let affected = 0;
        switch (body.action) {
            case 'move':
                if (body.folder_id === undefined) return reply.status(400).send({ error: 'folder_id required' });
                affected = run(`UPDATE feeds SET folder_id = ?, updated_at = datetime('now') WHERE id IN (${body.feed_ids.map(() => '?').join(',')}) AND user_id = ? AND deleted_at IS NULL`, [body.folder_id ?? null, ...body.feed_ids, userId]).changes;
                break;
            case 'delete':
                affected = run(`UPDATE feeds SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id IN (${body.feed_ids.map(() => '?').join(',')}) AND user_id = ? AND deleted_at IS NULL`, [...body.feed_ids, userId]).changes;
                break;
            case 'mark_read':
                run(
                    `INSERT OR REPLACE INTO read_state (user_id, article_id, is_read, read_at, updated_at)
                    SELECT ?, id, 1, datetime('now'), datetime('now')
                    FROM articles
                    WHERE feed_id IN (${body.feed_ids.map(() => '?').join(',')})`,
                    [userId, ...body.feed_ids]
                );
                affected = body.feed_ids.length;
                break;
            case 'update_refresh_interval':
                if (body.refresh_interval_minutes === undefined) return reply.status(400).send({ error: 'refresh_interval_minutes required' });
                affected = run(`UPDATE feeds SET refresh_interval_minutes = ?, updated_at = datetime('now') WHERE id IN (${body.feed_ids.map(() => '?').join(',')}) AND user_id = ? AND deleted_at IS NULL`, [body.refresh_interval_minutes, ...body.feed_ids, userId]).changes;
                break;
        }
        return { affected };
    }

    static async refresh(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        const userId = 1;
        const feedId = parseInt(request.params.id, 10);
        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!feed) return reply.status(404).send({ error: 'Feed not found' });

        const result = await refreshFeed({ id: feed.id, url: feed.url, type: feed.type, refresh_interval_minutes: feed.refresh_interval_minutes });
        if (!result.success) return reply.status(500).send({ error: 'Failed to refresh feed', details: result.error });
        return { success: true, new_articles: result.newArticles };
    }

    static async pause(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        const userId = 1;
        const feedId = parseInt(request.params.id, 10);
        
        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!feed) return reply.status(404).send({ error: 'Feed not found' });
        
        if (feed.paused_at) {
            return reply.status(400).send({ error: 'Feed is already paused' });
        }
        
        run(`UPDATE feeds SET paused_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [feedId]);
        
        const updatedFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [feedId]);
        return { feed: toApiFeed(updatedFeed!), paused: true };
    }

    static async resume(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        const userId = 1;
        const feedId = parseInt(request.params.id, 10);
        
        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!feed) return reply.status(404).send({ error: 'Feed not found' });
        
        if (!feed.paused_at) {
            return reply.status(400).send({ error: 'Feed is not paused' });
        }
        
        run(`UPDATE feeds SET paused_at = NULL, updated_at = datetime('now') WHERE id = ?`, [feedId]);
        
        const updatedFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [feedId]);
        return { feed: toApiFeed(updatedFeed!), resumed: true };
    }

    static async getInfo(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        const userId = 1;
        const feedId = parseInt(request.params.id, 10);
        
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
        
        if (!feed) return reply.status(404).send({ error: 'Feed not found' });
        
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

    static async refreshIcon(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        const userId = 1;
        const feedId = parseInt(request.params.id, 10);
        
        const feed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [feedId, userId]);
        if (!feed) return reply.status(404).send({ error: 'Feed not found' });
        
        // Only refresh icon for YouTube feeds
        if (feed.type !== 'youtube' && !feed.url.includes('youtube.com/feeds')) {
            return reply.status(400).send({ error: 'Only YouTube feeds support icon refresh' });
        }
        
        try {
            // Parse feed to get fresh favicon
            const feedData = await parseFeed(feed.url);
            
            // Extract channel ID and fetch icon
            const urlObj = new URL(feed.url);
            let channelId = urlObj.searchParams.get('channel_id');
            
            if (!channelId) {
                // Try to get from metadata
                const detectedType = detectFeedType(feed.url, feedData);
                if (detectedType === 'youtube' && feedData.youtubeChannelId) {
                    channelId = feedData.youtubeChannelId.startsWith('UC') ? feedData.youtubeChannelId : 'UC' + feedData.youtubeChannelId;
                }
            }
            
            let newIconUrl: string | null = null;
            if (channelId) {
                newIconUrl = await fetchYouTubeIcon(channelId);
            }
            
            // If no channel-specific icon, use the feed's favicon
            if (!newIconUrl) {
                newIconUrl = feedData.favicon;
            }
            
            if (newIconUrl && newIconUrl !== feed.icon_url) {
                // Clear cached icon and update with new URL
                const cachedIcon = await cacheFeedIcon(feed.id, newIconUrl);
                run(`UPDATE feeds SET icon_url = ?, icon_cached_path = ?, icon_cached_content_type = ?, updated_at = datetime('now') WHERE id = ?`,
                    [newIconUrl, cachedIcon?.fileName ?? null, cachedIcon?.mime ?? null, feedId]);
                
                const updatedFeed = queryOne<Feed>('SELECT * FROM feeds WHERE id = ?', [feedId]);
                return { feed: toApiFeed(updatedFeed!), icon_refreshed: true };
            }
            
            return { feed: toApiFeed(feed), icon_refreshed: false, message: 'Icon already up to date' };
            
        } catch (err) {
            console.error(`Failed to refresh icon for feed ${feedId}:`, err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            return reply.status(500).send({ error: 'Failed to refresh icon', details: errorMessage });
        }
    }

    // One-time fix to refetch YouTube channel icons
    static async refetchYouTubeIcons(request: FastifyRequest, reply: FastifyReply) {
        const userId = 1;
        
        // Get all YouTube feeds
        const feeds = queryAll<Feed>(`
            SELECT * FROM feeds 
            WHERE user_id = ? AND deleted_at IS NULL 
            AND (type = 'youtube' OR url LIKE '%youtube.com/feeds%')
        `, [userId]);

        const results: { updated: number; failed: number; details: string[] } = {
            updated: 0,
            failed: 0,
            details: []
        };

        for (const feed of feeds) {
            try {
                // Extract channel ID from URL
                const urlObj = new URL(feed.url);
                const channelId = urlObj.searchParams.get('channel_id');
                
                if (!channelId) {
                    results.failed++;
                    results.details.push(`[${feed.id}] ${feed.title}: No channel_id in URL`);
                    continue;
                }

                // Validate channel ID format
                if (!channelId.startsWith('UC') || channelId.length !== 24) {
                    results.failed++;
                    results.details.push(`[${feed.id}] ${feed.title}: Invalid channel ID format: ${channelId}`);
                    continue;
                }

                // Fetch channel icon
                const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                    }
                });

                if (!response.ok) {
                    results.failed++;
                    results.details.push(`[${feed.id}] ${feed.title}: HTTP ${response.status}`);
                    continue;
                }

                const html = await response.text();
                const avatarPatterns = [
                    /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/,
                    /"channelMetadataRenderer".*?"avatar".*?"url":"([^"]+)"/,
                    /yt-img-shadow.*?src="(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/,
                    /<meta property="og:image" content="([^"]+)"/
                ];

                let avatarUrl: string | null = null;
                for (const pattern of avatarPatterns) {
                    const match = html.match(pattern);
                    if (match && match[1]) {
                        avatarUrl = match[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
                        if (avatarUrl.includes('=s')) {
                            avatarUrl = avatarUrl.replace(/=s\d+.*/, '=s176-c-k-c0x00ffffff-no-rj-mo');
                        }
                        break;
                    }
                }

                if (avatarUrl) {
                    run(`UPDATE feeds SET icon_url = ?, icon_cached_path = NULL, icon_cached_content_type = NULL WHERE id = ?`, [avatarUrl, feed.id]);
                    results.updated++;
                    results.details.push(`[${feed.id}] ${feed.title}: ✓ Updated`);
                } else {
                    results.failed++;
                    results.details.push(`[${feed.id}] ${feed.title}: No avatar pattern matched`);
                }

                // Rate limit
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (e) {
                results.failed++;
                results.details.push(`[${feed.id}] ${feed.title}: Error - ${e}`);
            }
        }

        return {
            total: feeds.length,
            updated: results.updated,
            failed: results.failed,
            details: results.details
        };
    }
}
