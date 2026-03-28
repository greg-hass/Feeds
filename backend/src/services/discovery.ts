import iconService from './icon-service.js';
import { checkFeedActivity, checkYouTubeChannelActivity, checkRedditActivity } from './discovery/activity-check.js';
import { searchRssFeeds } from './discovery/rss.js';
import { discoverFeedsFromUrl } from './discovery/url-discovery.js';
import { buildDiscoverySearchQueries, compactDiscoveryKeyword, normalizeDiscoveryKeyword, scoreDiscoveryRelevance } from './discovery/query-utils.js';
import { DiscoveredFeed } from '../types/discovery.js';

// Re-export from url-discovery for backward compatibility
export { discoverFeedsFromUrl } from './discovery/url-discovery.js';
export type { DiscoveredFeed } from '../types/discovery.js';

const USER_AGENT = 'Feeds/1.0 (Feed Reader; +https://github.com/feeds)';

export function buildYouTubeSearchQueries(keyword: string): string[] {
    return buildDiscoverySearchQueries(keyword);
}

function scoreYouTubeDiscovery(candidate: DiscoveredFeed, keyword: string): number {
    const normalizedQuery = compactDiscoveryKeyword(keyword);
    const queryTokens = normalizeDiscoveryKeyword(keyword).split(' ').filter(Boolean);
    const candidateText = compactDiscoveryKeyword([
        candidate.title,
        candidate.site_url || '',
        candidate.feed_url,
    ].join(' '));

    let score = candidate.confidence;

    if (normalizedQuery && candidateText.includes(normalizedQuery)) {
        score += 0.3;
    }

    if (queryTokens.length > 0 && queryTokens.every(token => candidateText.includes(token))) {
        score += 0.2;
    }

    if (queryTokens.length > 1) {
        const handleLike = `${queryTokens[0]}${queryTokens.slice(1).map(token => token[0]).join('')}`;
        if (candidate.site_url?.toLowerCase().includes(`@${handleLike}`)) {
            score += 0.4;
        }
        if (candidate.title.toLowerCase().includes(queryTokens[0])) {
            score += 0.1;
        }
    }

    return score;
}

function extractYouTubeHandle(authorUrl: string | undefined | null): string | null {
    if (!authorUrl) return null;

    try {
        const url = authorUrl.startsWith('http') ? new URL(authorUrl) : new URL(`https://www.youtube.com${authorUrl.startsWith('/') ? authorUrl : `/${authorUrl}`}`);
        const handleMatch = url.pathname.match(/\/@([a-zA-Z0-9_-]+)/);
        return handleMatch ? handleMatch[1] : null;
    } catch {
        const handleMatch = authorUrl.match(/\/@([a-zA-Z0-9_-]+)/);
        return handleMatch ? handleMatch[1] : null;
    }
}

function extractYouTubeChannelId(authorUrl: string | undefined | null): string | null {
    if (!authorUrl) return null;

    try {
        const url = authorUrl.startsWith('http') ? new URL(authorUrl) : new URL(`https://www.youtube.com${authorUrl.startsWith('/') ? authorUrl : `/${authorUrl}`}`);
        const channelIdMatch = url.pathname.match(/\/channel\/([a-zA-Z0-9_-]+)/);
        return channelIdMatch ? channelIdMatch[1] : null;
    } catch {
        const channelIdMatch = authorUrl.match(/\/channel\/([a-zA-Z0-9_-]+)/);
        return channelIdMatch ? channelIdMatch[1] : null;
    }
}

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
    const discoveries: Array<DiscoveredFeed & { searchScore: number }> = [];
    const seenFeeds = new Set<string>();
    const searchQueries = buildYouTubeSearchQueries(keyword);
    const maxResultsPerQuery = Math.max(limit * 3, 10);

    const pushDiscovery = (discovery: DiscoveredFeed) => {
        if (!discovery.feed_url || seenFeeds.has(discovery.feed_url)) return;
        seenFeeds.add(discovery.feed_url);
        discoveries.push({
            ...discovery,
            searchScore: scoreYouTubeDiscovery(discovery, keyword),
        });
    };

    const addResolvedHandleDiscovery = async (authorUrl: string) => {
        try {
            const resolved = await discoverFeedsFromUrl(authorUrl);
            const ytFeed = resolved.find(feed => feed.type === 'youtube');
            if (ytFeed) {
                pushDiscovery({
                    ...ytFeed,
                    confidence: Math.max(ytFeed.confidence, 0.94),
                    method: 'youtube',
                });
            }
        } catch (err) {
            console.error(`[YouTube Discovery] Failed to resolve handle URL ${authorUrl}:`, err);
        }
    };

    // Method 1: Invidious (alternative YouTube frontend, more stable)
    const invidiousInstances = [
        'yewtu.be',
        'invidious.snopyta.org',
        'invidious.kavin.rocks',
        'invidious.jingl.xyz',
    ];

    let foundInvidiousMatch = false;

    for (const query of searchQueries) {
        if (discoveries.length >= limit) break;

        for (const instance of invidiousInstances) {
            if (discoveries.length >= limit) break;

            try {
                const encodedKeyword = encodeURIComponent(query);
                const response = await fetch(
                    `https://${instance}/api/v1/search?q=${encodedKeyword}&type=channel&max_results=${maxResultsPerQuery}`,
                    {
                        headers: { 'User-Agent': USER_AGENT },
                        signal: AbortSignal.timeout(10000),
                    }
                );

                if (!response.ok) {
                    continue;
                }

                const data = await response.json();
                const channels = data || [];

                for (const channel of channels) {
                    if (!channel.author_url) continue;

                    const authorUrl = channel.author_url.startsWith('http')
                        ? channel.author_url
                        : `https://www.youtube.com${channel.author_url.startsWith('/') ? channel.author_url : `/${channel.author_url}`}`;

                    const channelId = extractYouTubeChannelId(authorUrl);
                    if (channelId) {
                        const activity = await checkYouTubeChannelActivity(channelId);
                        pushDiscovery({
                            type: 'youtube',
                            title: channel.author || 'YouTube Channel',
                            feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
                            site_url: authorUrl,
                            icon_url: channel.author_thumbnail || `https://www.google.com/s2/favicons?domain=youtube.com&sz=64`,
                            confidence: 0.9,
                            method: 'youtube',
                            isActive: activity.isActive,
                            lastPostDate: activity.lastPostDate?.toISOString()
                        });
                        continue;
                    }

                    const handle = extractYouTubeHandle(authorUrl);
                    if (handle) {
                        await addResolvedHandleDiscovery(authorUrl);
                    }
                }

                if (discoveries.length > 0) {
                    foundInvidiousMatch = true;
                }
            } catch (err) {
                console.error(`[YouTube Discovery] Invidious ${instance} failed for query "${query}":`, err);
            }
        }
    }

    // Method 2: DuckDuckGo YouTube scraping
    if (!foundInvidiousMatch) {
        try {
            for (const query of searchQueries) {
                if (discoveries.length >= limit) break;

                const encodedKeyword = encodeURIComponent(`${query} youtube channel`);
                const response = await fetch(
                    `https://html.duckduckgo.com/html/?q=${encodedKeyword}`,
                    {
                        headers: { 'User-Agent': USER_AGENT },
                        signal: AbortSignal.timeout(10000),
                    }
                );

                if (!response.ok) continue;

                const html = await response.text();
                const channelUrls: string[] = [];

                // Extract YouTube channel URLs, including handle-based URLs
                const urlPatterns = [
                    /youtube\.com\/@([a-zA-Z0-9_-]+)/g,
                    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/g,
                    /youtu\.be\/@([a-zA-Z0-9_-]+)/g,
                ];

                for (const pattern of urlPatterns) {
                    let match;
                    while ((match = pattern.exec(html)) !== null) {
                        const channelId = match[1];
                        const channelUrl = pattern.source.includes('@')
                            ? `https://www.youtube.com/@${channelId}`
                            : `https://www.youtube.com/channel/${channelId}`;
                        if (!channelUrls.includes(channelUrl)) {
                            channelUrls.push(channelUrl);
                        }
                    }
                }

                for (const channelUrl of [...new Set(channelUrls)].slice(0, 10)) {
                    if (discoveries.length >= limit) break;

                    const channelId = extractYouTubeChannelId(channelUrl);
                    if (channelId) {
                        const activity = await checkYouTubeChannelActivity(channelId);
                        const icon = await iconService.getYouTubeIcon(channelId);

                        pushDiscovery({
                            type: 'youtube',
                            title: `YouTube Channel`,
                            feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
                            site_url: channelUrl,
                            icon_url: icon || `https://www.google.com/s2/favicons?domain=youtube.com&sz=64`,
                            confidence: 0.8,
                            method: 'youtube',
                            isActive: activity.isActive,
                            lastPostDate: activity.lastPostDate?.toISOString()
                        });
                        continue;
                    }

                    if (extractYouTubeHandle(channelUrl)) {
                        await addResolvedHandleDiscovery(channelUrl);
                    }
                }
            }
        } catch (err) {
            console.error('[YouTube Discovery] DuckDuckGo fallback failed:', err);
        }
    }

    const ranked = discoveries
        .sort((a, b) => b.searchScore - a.searchScore || b.confidence - a.confidence)
        .slice(0, limit)
        .map(({ searchScore, ...feed }) => feed);

    console.log(`[YouTube Discovery] Returning ${ranked.length} discoveries`);
    return ranked;
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
    const typeOrder: DiscoveredFeed['type'][] = ['rss', 'youtube', 'reddit', 'podcast'];
    const ranked = merged
        .slice()
        .sort((a, b) => {
            const scoreDiff = scoreDiscoveryRelevance(b, keyword) - scoreDiscoveryRelevance(a, keyword);
            if (scoreDiff !== 0) return scoreDiff;

            const confidenceDiff = b.confidence - a.confidence;
            if (confidenceDiff !== 0) return confidenceDiff;

            return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
        })
        .slice(0, limit);

    console.log(`[Discovery] Total unique results: ${ranked.length}`);

    return ranked;
}

/**
 * Search for podcasts using iTunes Search API (free, no API key required)
 */
async function searchPodcasts(keyword: string, limit: number): Promise<DiscoveredFeed[]> {
    console.log(`[Podcast Discovery] Searching for: "${keyword}"`);
    const discoveries: DiscoveredFeed[] = [];
    const queries = buildDiscoverySearchQueries(keyword, 5);

    try {
        for (const query of queries) {
            if (discoveries.length >= limit) break;

            const response = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&entity=podcast&limit=${limit * 2}`,
                {
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(10000),
                }
            );

            console.log(`[Podcast Discovery] Response status: ${response.status}`);

            if (!response.ok) continue;

            const data = await response.json();
            const podcasts = data.results || [];

            for (const podcast of podcasts) {
                // iTunes provides RSS feed URL in feedUrl field
                if (podcast.feedUrl && !discoveries.some(feed => feed.feed_url === podcast.feedUrl)) {
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
    const queries = buildDiscoverySearchQueries(keyword, 5);

    try {
        for (const query of queries) {
            if (discoveries.length >= limit) break;

            const response = await fetch(`https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=${limit * 2}`, {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(10000),
            });

            console.log(`[Reddit Discovery] Response status: ${response.status}`);

            if (!response.ok) continue;

            const data = await response.json();
            const subreddits = data.data?.children || [];
            console.log(`[Reddit Discovery] Found ${subreddits.length} subreddits`);

            // Check activity for each subreddit
            for (const sub of subreddits) {
                const info = sub.data;
                const subredditName = info.display_name;

                if (discoveries.some(feed => feed.feed_url === `https://www.reddit.com${info.url}.rss`)) {
                    continue;
                }

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
