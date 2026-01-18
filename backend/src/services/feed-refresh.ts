import { run } from '../db/index.js';
import { parseFeed, normalizeArticle, FeedType } from './feed-parser.js';

export interface FeedToRefresh {
    id: number;
    url: string;
    type: FeedType;
    refresh_interval_minutes: number;
}

export interface RefreshResult {
    success: boolean;
    newArticles: number;
    error?: string;
}

/**
 * Refreshes a single feed and inserts new articles.
 * Used by both manual refresh (API endpoint) and scheduled refresh.
 *
 * @param feed - The feed to refresh
 * @returns RefreshResult with success status and new article count
 */
export async function refreshFeed(feed: FeedToRefresh): Promise<RefreshResult> {
    try {
        const feedData = await parseFeed(feed.url);
        let newArticles = 0;

        const insertArticle = `
            INSERT OR IGNORE INTO articles
            (feed_id, guid, title, url, author, summary, content, enclosure_url, enclosure_type, thumbnail_url, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const article of feedData.articles) {
            const normalized = normalizeArticle(article, feed.type);
            const result = run(insertArticle, [
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
                normalized.published_at,
            ]);
            if (result.changes > 0) newArticles++;
        }

        // Update feed metadata on success
        // We use COALESCE and NULLIF to ensure we don't overwrite existing data with nulls, 
        // but we DO update if current data is placeholder or missing.
        run(
            `UPDATE feeds SET
                title = CASE 
                    WHEN title = url OR title = 'Direct Feed' OR title = 'Discovered Feed' THEN ?
                    ELSE title 
                END,
                site_url = COALESCE(site_url, ?),
                icon_url = COALESCE(icon_url, ?),
                description = COALESCE(description, ?),
                last_fetched_at = datetime('now'),
                next_fetch_at = datetime('now', '+' || refresh_interval_minutes || ' minutes'),
                error_count = 0,
                last_error = NULL,
                last_error_at = NULL,
                updated_at = datetime('now')
             WHERE id = ?`,
            [
                feedData.title,
                feedData.link,
                feedData.favicon,
                feedData.description,
                feed.id
            ]
        );

        return { success: true, newArticles };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        // Update feed with error information
        run(
            `UPDATE feeds SET
                error_count = error_count + 1,
                last_error = ?,
                last_error_at = datetime('now'),
                next_fetch_at = datetime('now', '+' || (refresh_interval_minutes * 2) || ' minutes'),
                updated_at = datetime('now')
             WHERE id = ?`,
            [errorMessage, feed.id]
        );

        return { success: false, newArticles: 0, error: errorMessage };
    }
}
