import * as cheerio from 'cheerio';
import { FeedType } from './feed-parser.js';
import { fetchYouTubeIcon } from './youtube-parser.js';
import { fetchRedditIcon } from './reddit-parser.js';
import { getAiSuggestedFeeds } from './ai.js';
import iconService from './icon-service.js';
import { checkFeedActivity, checkYouTubeChannelActivity, checkRedditActivity } from './discovery/activity-check.js';
import { searchRssFeeds } from './discovery/rss.js';
import { DiscoveredFeed } from '../types/discovery.js';

export type { DiscoveredFeed } from '../types/discovery.js';

const USER_AGENT = 'Feeds/1.0 (Feed Reader; +https://github.com/feeds)';

const WELL_KNOWN_PATHS = [
    '/feed',
    '/rss',
    '/feed.xml',
    '/rss.xml',
    '/atom.xml',
    '/index.xml',
    '/feed/rss',
    '/feed/atom',
    '/.rss',
];

type PlatformType = 'youtube' | 'reddit' | 'generic';

/**
 * Detects the platform type from a URL
 */
function detectPlatform(url: string): PlatformType {
    const parsedUrl = new URL(url);
    
    if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
        return 'youtube';
    }
    
    if (parsedUrl.hostname.includes('reddit.com')) {
        return 'reddit';
    }
    
    return 'generic';
}

/**
 * Fetches and validates the page content for generic feed discovery
 * Returns null if the URL points directly to a feed
 */
async function fetchDiscoveryPage(url: string): Promise<{ html: string; isDirectFeed: false } | { isDirectFeed: true; feedInfo: DiscoveredFeed } | null> {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(15000),
            redirect: 'follow',
        });

        const contentType = response.headers.get('content-type') || '';
        const parsedUrl = new URL(url);

        // If it's already a feed, return it directly
        if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
            const isYouTubeFeed = parsedUrl.hostname.includes('youtube.com') &&
                (parsedUrl.pathname.includes('/feeds/') || parsedUrl.searchParams.has('channel_id'));

            return {
                isDirectFeed: true,
                feedInfo: {
                    type: isYouTubeFeed ? 'youtube' : 'rss',
                    title: isYouTubeFeed ? 'YouTube Feed' : 'Direct Feed',
                    feed_url: url,
                    site_url: parsedUrl.origin,
                    icon_url: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`,
                    confidence: 1.0,
                    method: 'redirect',
                }
            };
        }

        const html = await response.text();
        return { html, isDirectFeed: false };
    } catch (err) {
        console.error('Failed to fetch URL for discovery:', err);
        return null;
    }
}

/**
 * Extracts the site icon from HTML using Cheerio
 */
function extractIconFromHtml(html: string, baseUrl: string): string {
    const $ = cheerio.load(html);
    const parsedUrl = new URL(baseUrl);
    
    let iconUrl = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`;
    const linkIcon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').first().attr('href');
    
    if (linkIcon) {
        try {
            iconUrl = new URL(linkIcon, baseUrl).toString();
        } catch { 
            // Fallback to default favicon service
        }
    }
    
    return iconUrl;
}

/**
 * Discovers feeds from <link> tags in HTML
 */
function discoverFeedsFromLinkTags(html: string, siteUrl: string, iconUrl: string): DiscoveredFeed[] {
    const $ = cheerio.load(html);
    const discoveries: DiscoveredFeed[] = [];
    
    $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_: number, el: any) => {
        const href = $(el).attr('href');
        const title = $(el).attr('title') || 'RSS Feed';

        if (href) {
            const absoluteUrl = new URL(href, siteUrl).toString();
            const type = ($(el).attr('type') || '').includes('atom') ? 'rss' : 'rss';

            // Check if it looks like a podcast
            const isPodcast = title.toLowerCase().includes('podcast') ||
                absoluteUrl.toLowerCase().includes('podcast');

            discoveries.push({
                type: isPodcast ? 'podcast' : type,
                title,
                feed_url: absoluteUrl,
                site_url: siteUrl,
                icon_url: iconUrl,
                confidence: 0.95,
                method: 'link_tag',
            });
        }
    });
    
    return discoveries;
}

/**
 * Checks well-known feed paths when no link tags are found
 */
async function checkWellKnownPaths(origin: string, iconUrl: string): Promise<DiscoveredFeed | null> {
    for (const path of WELL_KNOWN_PATHS) {
        try {
            const testUrl = new URL(path, origin).toString();
            const response = await fetch(testUrl, {
                method: 'HEAD',
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(5000),
            });

            const contentType = response.headers.get('content-type') || '';
            if (response.ok && (contentType.includes('xml') || contentType.includes('rss'))) {
                return {
                    type: 'rss',
                    title: 'Discovered Feed',
                    feed_url: testUrl,
                    site_url: origin,
                    icon_url: iconUrl,
                    confidence: 0.8,
                    method: 'well_known',
                };
            }
        } catch {
            // Ignore errors, continue checking
        }
    }
    
    return null;
}

/**
 * Adds activity information to discovered feeds
 */
async function addActivityInfo(feeds: DiscoveredFeed[]): Promise<DiscoveredFeed[]> {
    const feedsWithActivity: DiscoveredFeed[] = [];
    
    for (const feed of feeds) {
        if (feed.type === 'rss' || feed.type === 'podcast') {
            try {
                const activity = await checkFeedActivity(feed.feed_url, feed.type);
                feedsWithActivity.push({
                    ...feed,
                    isActive: activity.isActive,
                    lastPostDate: activity.lastPostDate?.toISOString()
                });
            } catch {
                feedsWithActivity.push({ ...feed, isActive: true }); // Assume active on error
            }
        } else {
            feedsWithActivity.push(feed);
        }
    }
    
    return feedsWithActivity;
}

/**
 * Main entry point for feed discovery from a URL
 * Delegates to platform-specific handlers or generic discovery
 */
export async function discoverFeedsFromUrl(url: string): Promise<DiscoveredFeed[]> {
    const platform = detectPlatform(url);
    
    // Handle platform-specific discovery
    if (platform === 'youtube') {
        const ytFeed = await discoverYouTubeFeed(url);
        return ytFeed ? [ytFeed] : [];
    }
    
    if (platform === 'reddit') {
        const redditFeed = await discoverRedditFeed(url);
        return redditFeed ? [redditFeed] : [];
    }
    
    // Generic discovery flow
    const pageResult = await fetchDiscoveryPage(url);
    
    if (!pageResult) {
        return []; // Fetch failed
    }
    
    if (pageResult.isDirectFeed) {
        return [pageResult.feedInfo];
    }
    
    const { html } = pageResult;
    const iconUrl = extractIconFromHtml(html, url);
    
    // Try link tags first
    let discoveries = discoverFeedsFromLinkTags(html, url, iconUrl);
    
    // Fall back to well-known paths
    if (discoveries.length === 0) {
        const wellKnownFeed = await checkWellKnownPaths(new URL(url).origin, iconUrl);
        if (wellKnownFeed) {
            discoveries.push(wellKnownFeed);
        }
    }
    
    // Add activity information and sort
    const feedsWithActivity = await addActivityInfo(discoveries);
    feedsWithActivity.sort((a, b) => b.confidence - a.confidence);
    
    return feedsWithActivity;
}

async function discoverYouTubeFeed(url: string): Promise<DiscoveredFeed | null> {
    const parsedUrl = new URL(url);

    // Handle different YouTube URL formats
    let channelId: string | null = null;
    let playlistId: string | null = null;
    let iconUrl = 'https://www.gstatic.com/youtube/img/branding/favicon/favicon_144x144.png'; // Better fallback
    let isActive = true;
    let lastPostDate: string | undefined;

    // youtube.com/channel/UC...
    const channelMatch = parsedUrl.pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/);
    if (channelMatch) {
        channelId = channelMatch[1];
    }

    // youtube.com/@handle
    const handleMatch = parsedUrl.pathname.match(/\/@([a-zA-Z0-9_-]+)/);
    if (handleMatch) {
        // Need to fetch the page to get channel ID
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(10000),
            });
            const html = await response.text();
            const idMatch = html.match(/channel_id=([a-zA-Z0-9_-]+)/);
            if (idMatch) {
                channelId = idMatch[1];
            }
            // Try to look for avatar
            const avatarMatch = html.match(/"avatar":{"thumbnails":\[{"url":"([^"]+)"/);
            if (avatarMatch) {
                iconUrl = avatarMatch[1];
            }
        } catch {
            return null;
        }
    }

    // Extract channel title from page if we have channelId
    let channelTitle: string | null = null;
    if (channelId) {
        try {
            const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
            const html = await response.text();
            
            // Try multiple patterns for channel title
            const titlePatterns = [
                /<meta property="og:title" content="([^"]+)">/,
                /<title>([^<]+)<\/title>/,
                /"channelMetadataRenderer"[^}]*"title":"([^"]+)"/,
                /"header"[^}]*"title":"([^"]+)"/,
            ];
            
            for (const pattern of titlePatterns) {
                const match = html.match(pattern);
                if (match) {
                    channelTitle = match[1].replace(' - YouTube', '').trim();
                    if (channelTitle && channelTitle !== 'YouTube') break;
                }
            }
            
            // Try extracting icon
            const avatarMatch = html.match(/"avatar":{"thumbnails":\[{"url":"([^"]+)"/);
            if (avatarMatch) {
                iconUrl = avatarMatch[1];
            }

            // Check channel activity
            const activity = await checkYouTubeChannelActivity(channelId);
            isActive = activity.isActive;
            lastPostDate = activity.lastPostDate?.toISOString();
            
            if (!isActive) {
                console.log(`[YouTube Discovery] Channel ${channelTitle || channelId} is inactive`);
            }
        } catch { }
    }

    // youtube.com/playlist?list=PL...
    playlistId = parsedUrl.searchParams.get('list');

    if (channelId) {
        return {
            type: 'youtube',
            title: channelTitle || 'YouTube Channel',
            feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
            site_url: url,
            icon_url: (await iconService.getYouTubeIcon(channelId)) || iconUrl,
            confidence: channelTitle ? 0.98 : 0.95,
            method: 'youtube',
            isActive,
            lastPostDate,
        };
    }

    if (playlistId) {
        return {
            type: 'youtube',
            title: 'YouTube Playlist',
            feed_url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`,
            site_url: url,
            icon_url: iconUrl,
            confidence: 0.95,
            method: 'youtube',
        };
    }

    return null;
}

async function discoverRedditFeed(url: string): Promise<DiscoveredFeed | null> {
    const parsedUrl = new URL(url);
    let feedUrl: string;
    let title = 'Reddit Feed';
    let subredditName: string | null = null;

    // reddit.com/r/subreddit
    const subredditMatch = parsedUrl.pathname.match(/\/r\/([a-zA-Z0-9_]+)/);
    if (subredditMatch) {
        subredditName = subredditMatch[1];
        feedUrl = `https://www.reddit.com/r/${subredditName}/.rss`;
        title = `r/${subredditName}`;
    }
    // reddit.com/user/username
    else if (parsedUrl.pathname.includes('/user/')) {
        const userMatch = parsedUrl.pathname.match(/\/user\/([a-zA-Z0-9_-]+)/);
        if (userMatch) {
            feedUrl = `https://www.reddit.com/user/${userMatch[1]}/.rss`;
            title = `u/${userMatch[1]}`;
        } else {
            return null;
        }
    }
    else {
        return null;
    }

    // Check subreddit activity
    let isActive = true;
    let lastPostDate: string | undefined;
    
    if (subredditName) {
        const activity = await checkRedditActivity(subredditName);
        isActive = activity.isActive;
        lastPostDate = activity.lastPostDate?.toISOString();
        
        if (!isActive) {
            console.log(`[Reddit Discovery] Subreddit ${title} is inactive`);
        }
    }

    return {
        type: 'reddit',
        title,
        feed_url: feedUrl,
        site_url: url,
        icon_url: (await iconService.getRedditIcon(title.replace('r/', '').replace('u/', ''))) || 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png',
        confidence: 0.9,
        method: 'reddit',
        isActive,
        lastPostDate,
    };
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
    const errors: string[] = [];

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

    // AI suggestions as enhancement (requires Gemini, not required for search to work)
    const aiSuggestionsList = await getAiSuggestedFeeds(keyword);
    if (aiSuggestionsList.length > 0) {
        console.log(`[Discovery] AI suggests ${aiSuggestionsList.length} feeds`);
        const aiResults = await Promise.all(
            aiSuggestionsList.map(async (suggestion) => {
                try {
                    const foundFeeds = await discoverFeedsFromUrl(suggestion.url);
                    return foundFeeds.map(f => ({
                        ...f,
                        title: (f.title === 'RSS Feed' || f.title === 'Discovered Feed') ? suggestion.title : f.title,
                        confidence: 0.7 // AI suggestions have slightly lower confidence
                    }));
                } catch {
                    return [];
                }
            })
        );
        results.push(...aiResults.flat());
    }

    // Deduplicate by feed_url
    const seen = new Set<string>();
    const unique = results.filter(f => {
        if (seen.has(f.feed_url)) return false;
        seen.add(f.feed_url);
        return true;
    });

    console.log(`[Discovery] Total unique results: ${unique.length}`);

    return unique.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
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
