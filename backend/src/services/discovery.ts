import iconService from './icon-service.js';
import { checkFeedActivity, checkYouTubeChannelActivity, checkRedditActivity } from './discovery/activity-check.js';
import { searchRssFeeds } from './discovery/rss.js';
import { discoverFeedsFromUrl } from './discovery/url-discovery.js';
import { DiscoveredFeed } from '../types/discovery.js';

// Re-export from url-discovery for backward compatibility
export { discoverFeedsFromUrl } from './discovery/url-discovery.js';
export type { DiscoveredFeed } from '../types/discovery.js';

const USER_AGENT = 'Feeds/1.0 (Feed Reader; +https://github.com/feeds)';

export function mergeDiscoveryResults(results: DiscoveredFeed[], limit: number, type?: string): DiscoveredFeed[] {
    const seen = new Set<string>();
    const unique = results.filter((feed) => {
        if (seen.has(feed.feed_url)) return false;
        seen.add(feed.feed_url);
        return true;
    });

    if (type) {
        return unique
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, limit);
    }

    const grouped = new Map<DiscoveredFeed['type'], DiscoveredFeed[]>();
    for (const feed of unique) {
        const current = grouped.get(feed.type) ?? [];
        current.push(feed);
        grouped.set(feed.type, current);
    }

    for (const feeds of grouped.values()) {
        feeds.sort((a, b) => b.confidence - a.confidence);
    }

    const typeOrder: DiscoveredFeed['type'][] = ['rss', 'youtube', 'reddit', 'podcast'];
    const merged: DiscoveredFeed[] = [];

    while (merged.length < limit) {
        let added = false;

        for (const feedType of typeOrder) {
            const feeds = grouped.get(feedType);
            if (!feeds || feeds.length === 0) continue;

            const next = feeds.shift();
            if (!next) continue;

            merged.push(next);
            added = true;

            if (merged.length >= limit) {
                break;
            }
        }

        if (!added) {
            break;
        }
    }

    return merged;
}

async function discoverYouTubeByKeyword(keyword: string, limit: number): Promise<DiscoveredFeed[]> {
    console.log(`[YouTube Discovery] Searching for: "${keyword}"`);
    const discoveries: DiscoveredFeed[] = [];

    // Method 1: Invidious (alternative YouTube frontend, more stable)
    const invidiousInstances = [
        'yewtu.be',
        'invidious.snopyta.org',
        'invidious.kavin.rocks',
        'invidious.jingl.xyz',
    ];

    for (const instance of invidiousInstances) {
        if (discoveries.length >= limit) break;

        try {
            const encodedKeyword = encodeURIComponent(keyword);
            const response = await fetch(
                `https://${instance}/api/v1/search?q=${encodedKeyword}&type=channel&max_results=${limit}`,
                {
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(10000),
                }
            );

            if (response.ok) {
                const data = await response.json();
                const channels = data || [];

                for (const channel of channels) {
                    if (channel.author && channel.author_url) {
                        // Extract channel ID from URL
                        const channelIdMatch = channel.author_url.match(/channel\/([a-zA-Z0-9_-]+)/);
                        const channelId = channelIdMatch ? channelIdMatch[1] : null;

                        if (channelId) {
                            // Check activity
                            const activity = await checkYouTubeChannelActivity(channelId);

                            discoveries.push({
                                type: 'youtube',
                                title: channel.author,
                                feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
                                site_url: channel.author_url,
                                icon_url: channel.author_thumbnail || `https://www.google.com/s2/favicons?domain=youtube.com&sz=64`,
                                confidence: 0.9,
                                method: 'youtube',
                                isActive: activity.isActive,
                                lastPostDate: activity.lastPostDate?.toISOString()
                            });
                        }
                    }
                    if (discoveries.length >= limit) break;
                }

                if (discoveries.length > 0) {
                    console.log(`[YouTube Discovery] Found ${discoveries.length} channels via Invidious (${instance})`);
                    return discoveries.slice(0, limit);
                }
            }
        } catch (err) {
            console.error(`[YouTube Discovery] Invidious ${instance} failed:`, err);
        }
    }

    // Method 2: DuckDuckGo YouTube scraping
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetch(
            `https://html.duckduckgo.com/html/?q=${encodedKeyword}+youtube+channel`,
            {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(10000),
            }
        );

        if (response.ok) {
            const html = await response.text();
            const channelUrls: string[] = [];

            // Extract YouTube channel URLs
            const urlPatterns = [
                /youtube\.com\/@([a-zA-Z0-9_-]+)/g,
                /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/g,
                /youtu\.be\/@([a-zA-Z0-9_-]+)/g,
            ];

            for (const pattern of urlPatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    const channelId = match[1];
                    if (!channelUrls.some(u => u.includes(channelId))) {
                        channelUrls.push(`https://www.youtube.com/channel/${channelId}`);
                    }
                }
            }

            // Deduplicate and limit
            const uniqueUrls = [...new Set(channelUrls)].slice(0, 10);

            for (const channelUrl of uniqueUrls) {
                if (discoveries.length >= limit) break;

                try {
                    const channelIdMatch = channelUrl.match(/channel\/([a-zA-Z0-9_-]+)/);
                    const channelId = channelIdMatch ? channelIdMatch[1] : null;

                    if (channelId) {
                        const activity = await checkYouTubeChannelActivity(channelId);
                        const icon = await iconService.getYouTubeIcon(channelId);

                        discoveries.push({
                            type: 'youtube',
                            title: `YouTube Channel`, // Would need to fetch to get actual name
                            feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
                            site_url: channelUrl,
                            icon_url: icon || `https://www.google.com/s2/favicons?domain=youtube.com&sz=64`,
                            confidence: 0.8,
                            method: 'youtube',
                            isActive: activity.isActive,
                            lastPostDate: activity.lastPostDate?.toISOString()
                        });
                    }
                } catch {
                    // Continue on error
                }
            }

            console.log(`[YouTube Discovery] DuckDuckGo found ${discoveries.length} channels`);
        }
    } catch (err) {
        console.error('[YouTube Discovery] DuckDuckGo fallback failed:', err);
    }

    return discoveries.slice(0, limit);
}

export async function discoverByKeyword(keyword: string, limit: number = 10, type?: string): Promise<DiscoveredFeed[]> {
    console.log(`[Discovery] Searching for keyword: "${keyword}", type: ${type || 'all'}`);

    const results: DiscoveredFeed[] = [];

    // Run all searches in parallel
    const searchPromises: Promise<DiscoveredFeed[]>[] = [];

    // RSS Feed Search (uses Google Custom Search API)
    if (!type || type === 'rss') {
        searchPromises.push(
            (async () => {
                try {
                    const rssResults = await searchRssFeeds(keyword, limit);
                    console.log(`[Discovery] RSS found ${rssResults.length} feeds`);
                    return rssResults;
                } catch (err) {
                    console.error('[Discovery] RSS search failed:', err);
                    return [];
                }
            })()
        );
    }

    // Podcast Search (uses iTunes API)
    if (!type || type === 'podcast') {
        searchPromises.push(
            (async () => {
                try {
                    const podcastResults = await searchPodcasts(keyword, limit);
                    console.log(`[Discovery] Podcasts found ${podcastResults.length}`);
                    return podcastResults;
                } catch (err) {
                    console.error('[Discovery] Podcast search failed:', err);
                    return [];
                }
            })()
        );
    }

    // YouTube Search (web scraping with fallback)
    if (!type || type === 'youtube') {
        searchPromises.push(
            (async () => {
                try {
                    const ytResults = await discoverYouTubeByKeyword(keyword, limit);
                    console.log(`[Discovery] YouTube found ${ytResults.length} channels`);
                    return ytResults;
                } catch (err) {
                    console.error('[Discovery] YouTube search failed:', err);
                    return [];
                }
            })()
        );
    }

    // Reddit Search (uses Reddit API)
    if (!type || type === 'reddit') {
        searchPromises.push(
            (async () => {
                try {
                    const redditResults = await discoverRedditByKeyword(keyword, limit);
                    console.log(`[Discovery] Reddit found ${redditResults.length} subreddits`);
                    return redditResults;
                } catch (err) {
                    console.error('[Discovery] Reddit search failed:', err);
                    return [];
                }
            })()
        );
    }

    // Wait for all searches to complete
    const searchResults = await Promise.allSettled(searchPromises);

    // Combine all results
    for (const result of searchResults) {
        if (result.status === 'fulfilled') {
            results.push(...result.value);
        }
    }

    const merged = mergeDiscoveryResults(results, limit, type);

    console.log(`[Discovery] Total unique results: ${merged.length}`);

    return merged;
}

/**
 * Search for podcasts using iTunes Search API (free, no API key required)
 */
async function searchPodcasts(keyword: string, limit: number): Promise<DiscoveredFeed[]> {
    console.log(`[Podcast Discovery] Searching for: "${keyword}"`);
    const discoveries: DiscoveredFeed[] = [];

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const response = await fetch(
            `https://itunes.apple.com/search?term=${encodedKeyword}&media=podcast&entity=podcast&limit=${limit * 2}`,
            {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(10000),
            }
        );

        console.log(`[Podcast Discovery] Response status: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            const podcasts = data.results || [];

            for (const podcast of podcasts) {
                // iTunes provides RSS feed URL in feedUrl field
                if (podcast.feedUrl) {
                    const activity = await checkFeedActivity(podcast.feedUrl, 'podcast');

                    discoveries.push({
                        type: 'podcast' as const,
                        title: podcast.collectionName || podcast.artistName || 'Podcast',
                        feed_url: podcast.feedUrl,
                        site_url: podcast.collectionViewUrl || podcast.artistViewUrl,
                        icon_url: podcast.artworkUrl600 || podcast.artworkUrl100,
                        confidence: 0.9,
                        method: 'directory',
                        isActive: activity.isActive,
                        lastPostDate: activity.lastPostDate?.toISOString()
                    });
                }

                if (discoveries.length >= limit) break;
            }
        }
    } catch (err) {
        console.error('[Podcast Discovery] Failed:', err);
    }

    console.log(`[Podcast Discovery] Returning ${discoveries.length} podcasts`);
    return discoveries;
}

async function discoverRedditByKeyword(keyword: string, limit: number): Promise<DiscoveredFeed[]> {
    console.log(`[Reddit Discovery] Searching for: "${keyword}"`);
    const discoveries: DiscoveredFeed[] = [];
    const encodedKeyword = encodeURIComponent(keyword);

    try {
        const response = await fetch(`https://www.reddit.com/subreddits/search.json?q=${encodedKeyword}&limit=${limit * 2}`, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(10000),
        });

        console.log(`[Reddit Discovery] Response status: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            const subreddits = data.data?.children || [];
            console.log(`[Reddit Discovery] Found ${subreddits.length} subreddits`);

            // Check activity for each subreddit
            for (const sub of subreddits) {
                const info = sub.data;
                const subredditName = info.display_name;
                
                // Check if subreddit has recent activity
                console.log(`[Reddit Discovery] Checking activity for r/${subredditName}`);
                const activity = await checkRedditActivity(subredditName);
                
                if (!activity.isActive) {
                    console.log(`[Reddit Discovery] Skipping inactive subreddit: r/${subredditName} (last post: ${activity.lastPostDate})`);
                    continue;
                }
                console.log(`[Reddit Discovery] r/${subredditName} is active`);
                
                const icon = await iconService.getRedditIcon(subredditName);

                discoveries.push({
                    type: 'reddit',
                    title: info.display_name_prefixed,
                    feed_url: `https://www.reddit.com${info.url}.rss`,
                    site_url: `https://www.reddit.com${info.url}`,
                    icon_url: icon || info.community_icon || info.icon_img || 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png',
                    confidence: 0.9,
                    method: 'reddit',
                    isActive: true,
                    lastPostDate: activity.lastPostDate?.toISOString()
                });

                if (discoveries.length >= limit) break;
            }
        }
    } catch (err) {
        console.error('[Reddit Discovery] Failed:', err);
    }

    console.log(`[Reddit Discovery] Returning ${discoveries.length} discoveries`);
    return discoveries;
}
