import * as cheerio from 'cheerio';
import { FeedType } from './feed-parser.js';

export interface DiscoveredFeed {
    type: FeedType;
    title: string;
    feed_url: string;
    site_url?: string;
    confidence: number;
    method: 'link_tag' | 'well_known' | 'pattern' | 'redirect' | 'youtube' | 'reddit';
}

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

export async function discoverFeedsFromUrl(url: string): Promise<DiscoveredFeed[]> {
    const discoveries: DiscoveredFeed[] = [];
    const parsedUrl = new URL(url);

    // Check for YouTube patterns
    if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
        const ytFeed = await discoverYouTubeFeed(url);
        if (ytFeed) {
            discoveries.push(ytFeed);
        }
        return discoveries;
    }

    // Check for Reddit patterns
    if (parsedUrl.hostname.includes('reddit.com')) {
        const redditFeed = discoverRedditFeed(url);
        if (redditFeed) {
            discoveries.push(redditFeed);
        }
        return discoveries;
    }

    // Fetch the page
    let html: string;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(15000),
            redirect: 'follow',
        });

        const contentType = response.headers.get('content-type') || '';

        // If it's already a feed, return it directly
        if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
            return [{
                type: 'rss',
                title: 'Direct Feed',
                feed_url: url,
                site_url: parsedUrl.origin,
                confidence: 1.0,
                method: 'redirect',
            }];
        }

        html = await response.text();
    } catch (err) {
        console.error('Failed to fetch URL for discovery:', err);
        return discoveries;
    }

    const $ = cheerio.load(html);

    // 1. Look for <link> tags
    $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_, el) => {
        const href = $(el).attr('href');
        const title = $(el).attr('title') || 'RSS Feed';

        if (href) {
            const absoluteUrl = new URL(href, url).toString();
            const type = ($(el).attr('type') || '').includes('atom') ? 'rss' : 'rss';

            // Check if it looks like a podcast
            const isPodcast = title.toLowerCase().includes('podcast') ||
                absoluteUrl.toLowerCase().includes('podcast');

            discoveries.push({
                type: isPodcast ? 'podcast' : type,
                title,
                feed_url: absoluteUrl,
                site_url: url,
                confidence: 0.95,
                method: 'link_tag',
            });
        }
    });

    // 2. Check well-known paths
    if (discoveries.length === 0) {
        for (const path of WELL_KNOWN_PATHS) {
            try {
                const testUrl = new URL(path, parsedUrl.origin).toString();
                const response = await fetch(testUrl, {
                    method: 'HEAD',
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(5000),
                });

                const contentType = response.headers.get('content-type') || '';
                if (response.ok && (contentType.includes('xml') || contentType.includes('rss'))) {
                    discoveries.push({
                        type: 'rss',
                        title: 'Discovered Feed',
                        feed_url: testUrl,
                        site_url: url,
                        confidence: 0.8,
                        method: 'well_known',
                    });
                    break; // Found one, stop checking
                }
            } catch {
                // Ignore errors, continue checking
            }
        }
    }

    // Sort by confidence
    discoveries.sort((a, b) => b.confidence - a.confidence);

    return discoveries;
}

async function discoverYouTubeFeed(url: string): Promise<DiscoveredFeed | null> {
    const parsedUrl = new URL(url);

    // Handle different YouTube URL formats
    let channelId: string | null = null;
    let playlistId: string | null = null;

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
        } catch {
            return null;
        }
    }

    // youtube.com/playlist?list=PL...
    playlistId = parsedUrl.searchParams.get('list');

    if (channelId) {
        return {
            type: 'youtube',
            title: 'YouTube Channel',
            feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
            site_url: url,
            confidence: 0.95,
            method: 'youtube',
        };
    }

    if (playlistId) {
        return {
            type: 'youtube',
            title: 'YouTube Playlist',
            feed_url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`,
            site_url: url,
            confidence: 0.95,
            method: 'youtube',
        };
    }

    return null;
}

function discoverRedditFeed(url: string): DiscoveredFeed | null {
    const parsedUrl = new URL(url);
    let feedUrl: string;
    let title = 'Reddit Feed';

    // reddit.com/r/subreddit
    const subredditMatch = parsedUrl.pathname.match(/\/r\/([a-zA-Z0-9_]+)/);
    if (subredditMatch) {
        const subreddit = subredditMatch[1];
        feedUrl = `https://www.reddit.com/r/${subreddit}/.rss`;
        title = `r/${subreddit}`;
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

    return {
        type: 'reddit',
        title,
        feed_url: feedUrl,
        site_url: url,
        confidence: 0.9,
        method: 'reddit',
    };
}

export async function discoverByKeyword(keyword: string, limit: number = 10): Promise<DiscoveredFeed[]> {
    // For now, return empty - this would require external APIs like Feedly, Google, etc.
    // In v2, we could integrate:
    // - Feedly's discovery API
    // - DuckDuckGo/Google search with site:*.rss patterns
    // - Podcast directory APIs

    console.log(`Keyword discovery for "${keyword}" - not implemented in MVP`);
    return [];
}
