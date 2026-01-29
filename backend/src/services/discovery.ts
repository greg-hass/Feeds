import * as cheerio from 'cheerio';
import { FeedType } from './feed-parser.js';
import { fetchYouTubeIcon } from './youtube-parser.js';
import { fetchRedditIcon } from './reddit-parser.js';
import { getAiSuggestedFeeds } from './ai.js';
import iconService from './icon-service.js';
import { checkFeedActivity, checkYouTubeChannelActivity, checkRedditActivity } from './discovery/activity-check.js';

export interface DiscoveredFeed {
    type: FeedType;
    title: string;
    feed_url: string;
    site_url?: string;
    icon_url?: string;
    confidence: number;
    method: 'link_tag' | 'well_known' | 'pattern' | 'redirect' | 'youtube' | 'reddit';
    isActive?: boolean;
    lastPostDate?: string;
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
        const redditFeed = await discoverRedditFeed(url);
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
            // Check if it's a YouTube feed URL
            const isYouTubeFeed = parsedUrl.hostname.includes('youtube.com') &&
                (parsedUrl.pathname.includes('/feeds/') || parsedUrl.searchParams.has('channel_id'));

            return [{
                type: isYouTubeFeed ? 'youtube' : 'rss',
                title: isYouTubeFeed ? 'YouTube Feed' : 'Direct Feed',
                feed_url: url,
                site_url: parsedUrl.origin,
                icon_url: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`,
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

    // Extract icon
    let iconUrl = `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`;
    const linkIcon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').first().attr('href');
    if (linkIcon) {
        try {
            iconUrl = new URL(linkIcon, url).toString();
        } catch { }
    }

    // 1. Look for <link> tags
    $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_: number, el: any) => {
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
                icon_url: iconUrl,
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
                        icon_url: iconUrl,
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

    // 3. Check activity for all RSS/Podcast feeds
    const feedsWithActivity: DiscoveredFeed[] = [];
    for (const feed of discoveries) {
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

    // Sort by confidence
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
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `https://www.youtube.com/results?search_query=${encodedKeyword}&sp=EgIQAg%3D%3D`;
    const discoveries: DiscoveredFeed[] = [];

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) return [];

        const html = await response.text();
        const jsonMatch = html.match(/var ytInitialData = (\{.*?\});/);
        if (!jsonMatch) return [];

        const data = JSON.parse(jsonMatch[1]);
        const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

        if (!Array.isArray(contents)) return [];

        for (const item of contents) {
            if (item.channelRenderer) {
                const info = item.channelRenderer;
                const channelId = info.channelId;
                const title = info.title?.simpleText || info.title?.runs?.[0]?.text || 'YouTube Channel';

                // Check channel activity
                const activity = await checkYouTubeChannelActivity(channelId);
                
                if (!activity.isActive) {
                    console.log(`[YouTube Discovery] Skipping inactive channel: ${title}`);
                    continue;
                }

                const icon = await iconService.getYouTubeIcon(channelId);

                discoveries.push({
                    type: 'youtube',
                    title,
                    feed_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
                    site_url: `https://www.youtube.com/channel/${channelId}`,
                    icon_url: icon || `https://www.google.com/s2/favicons?domain=youtube.com&sz=64`,
                    confidence: 0.9,
                    method: 'youtube',
                    isActive: true,
                    lastPostDate: activity.lastPostDate?.toISOString()
                });

                if (discoveries.length >= limit) break;
            }
        }
    } catch (err) {
        console.error('YouTube keyword discovery failed:', err);
    }

    return discoveries;
}

export async function discoverByKeyword(keyword: string, limit: number = 10, type?: string): Promise<DiscoveredFeed[]> {
    let redditDiscoveries: DiscoveredFeed[] = [];
    let youtubeDiscoveries: DiscoveredFeed[] = [];
    let aiSuggestionsList: import('./ai.js').AiSuggestedUrl[] = [];

    // 1. Fetch from sources conditionally
    if (!type || type === 'reddit') {
        redditDiscoveries = await discoverRedditByKeyword(keyword, limit);
    }

    if (!type || type === 'youtube') {
        youtubeDiscoveries = await discoverYouTubeByKeyword(keyword, limit);
    }

    // Always fetch AI suggestions as a fallback or broad search
    aiSuggestionsList = await getAiSuggestedFeeds(keyword);

    // 2. Combine formatted results
    let allDiscoveries: DiscoveredFeed[] = [...redditDiscoveries, ...youtubeDiscoveries];

    // 3. Process AI suggestions (they need to be "discovered" to find the actual feed URL)
    if (aiSuggestionsList.length > 0) {
        const aiResults = await Promise.all(
            aiSuggestionsList.map(async (suggestion) => {
                try {
                    const foundFeeds = await discoverFeedsFromUrl(suggestion.url);
                    // Add AI title context if generic
                    return foundFeeds.map(f => ({
                        ...f,
                        title: (f.title === 'RSS Feed' || f.title === 'Discovered Feed') ? suggestion.title : f.title
                    }));
                } catch (err) {
                    return [];
                }
            })
        );

        allDiscoveries.push(...aiResults.flat());
    }

    // 4. Filter results by specific type if requested
    if (type) {
        allDiscoveries = allDiscoveries.filter(f => f.type === type);
    }

    // 5. Check activity for RSS/Podcast feeds (YouTube/Reddit already checked)
    const feedsWithActivity = await Promise.all(
        allDiscoveries.map(async (feed) => {
            // Skip activity check for YouTube and Reddit (already checked)
            if (feed.type === 'youtube' || feed.type === 'reddit') {
                return feed;
            }
            
            try {
                const activity = await checkFeedActivity(feed.feed_url, feed.type);
                return {
                    ...feed,
                    isActive: activity.isActive,
                    lastPostDate: activity.lastPostDate?.toISOString()
                };
            } catch {
                return { ...feed, isActive: true }; // Assume active on error
            }
        })
    );

    // 6. Filter to only active feeds
    const activeFeeds = feedsWithActivity.filter(f => f.isActive !== false);
    
    if (activeFeeds.length < allDiscoveries.length) {
        console.log(`[Keyword Discovery] Filtered ${allDiscoveries.length - activeFeeds.length} inactive feeds`);
    }

    // 7. Deduplicate by feed_url
    const seen = new Set<string>();
    const unique = activeFeeds.filter(f => {
        if (seen.has(f.feed_url)) return false;
        seen.add(f.feed_url);
        return true;
    });

    return unique.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

async function discoverRedditByKeyword(keyword: string, limit: number): Promise<DiscoveredFeed[]> {
    const discoveries: DiscoveredFeed[] = [];
    const encodedKeyword = encodeURIComponent(keyword);

    try {
        const response = await fetch(`https://www.reddit.com/subreddits/search.json?q=${encodedKeyword}&limit=${limit * 2}`, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
            const data = await response.json();
            const subreddits = data.data?.children || [];

            // Check activity for each subreddit
            for (const sub of subreddits) {
                const info = sub.data;
                const subredditName = info.display_name;
                
                // Check if subreddit has recent activity
                const activity = await checkRedditActivity(subredditName);
                
                if (!activity.isActive) {
                    console.log(`[Reddit Discovery] Skipping inactive subreddit: r/${subredditName}`);
                    continue;
                }
                
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
        console.error('Reddit keyword discovery failed:', err);
    }

    return discoveries;
}
