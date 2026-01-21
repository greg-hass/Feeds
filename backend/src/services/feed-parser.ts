import FeedParser, { Item } from 'feedparser';
import { Readable } from 'stream';
import type { FeedItemExtensions, FeedMetaExtensions } from '../types/rss-extensions.js';
import { HTTP, CONTENT, STRINGS, MISC } from '../config/constants.js';

export type FeedType = 'rss' | 'youtube' | 'reddit' | 'podcast';

// Type extensions for FeedParser
type ExtendedItem = FeedParser.Item & FeedItemExtensions;
type ExtendedMeta = FeedParser.Meta & FeedMetaExtensions;

export interface RawArticle {
    guid: string;
    title: string;
    link: string;
    author: string | null;
    summary: string | null;
    description: string | null;
    pubdate: Date | null;
    enclosures: Array<{
        url: string;
        type?: string;
        length?: string;
    }>;
    image?: { url: string };
    thumbnail?: string;
}

export interface Feed {
    title: string;
    description: string;
    link: string;
    image?: string;
    icon_url?: string;
    items: Item[];
}

export interface ParsedFeed {
    title: string;
    description: string | null;
    link: string | null;
    favicon: string | null;
    articles: RawArticle[];
    isPodcast: boolean;
    youtubeChannelId?: string | null;
}

export interface NormalizedArticle {
    guid: string;
    title: string;
    url: string | null;
    author: string | null;
    summary: string | null;
    content: string | null;
    enclosure_url: string | null;
    enclosure_type: string | null;
    thumbnail_url: string | null;
    published_at: string | null;
}

const USER_AGENT = 'Feeds/1.0 (Feed Reader; +https://github.com/greg-hass/Feeds) Mozilla/5.0 (compatible)';
const YOUTUBE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (YOUTUBE_API_KEY) {
    console.log('[Config] YouTube API Key loaded: ' + YOUTUBE_API_KEY.substring(0, 4) + '...');
} else {
    console.warn('[Config] YouTube API Key NOT found. Falling back to scraping.');
}

export async function fetchYouTubeIcon(channelId: string): Promise<string | null> {
    // Validate channel ID format (should start with UC and be 24 chars)
    if (!channelId || !channelId.startsWith('UC') || channelId.length !== 24) {
        console.log(`[YouTube Icon] Invalid channel ID format: "${channelId}" (expected UC + 22 chars)`);
        return null;
    }
    
    console.log(`[YouTube Icon] Fetching icon for channel: ${channelId}`);
    
    // Scrape the channel page (proven working approach)
    try {
        const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        
        if (!response.ok) {
            console.log(`[YouTube Icon] Failed to fetch channel page: ${response.status}`);
            return null;
        }
        
        const html = await response.text();

        // Try 4 regex patterns in order (proven working)
        const avatarPatterns = [
            /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/,      // JSON data
            /"channelMetadataRenderer".*?"avatar".*?"url":"([^"]+)"/,  // Extended metadata
            /yt-img-shadow.*?src="(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/,  // HTML img tag
            /<meta property="og:image" content="([^"]+)"/       // OpenGraph fallback
        ];

        for (const pattern of avatarPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let avatarUrl = match[1];
                
                // Decode escaped characters
                avatarUrl = avatarUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
                
                // Force high-res avatar (s176 is standard)
                if (avatarUrl.includes('=s')) {
                    avatarUrl = avatarUrl.replace(/=s\d+.*/, '=s176-c-k-c0x00ffffff-no-rj-mo');
                }
                
                console.log(`[YouTube Icon] Found icon for ${channelId}`);
                return avatarUrl;
            }
        }
        
        console.log(`[YouTube Icon] No patterns matched for ${channelId}`);
    } catch (e) {
        console.error(`[YouTube Icon] Error fetching: ${e}`);
    }

    // Fallback - return null so the frontend can show default icon
    return null;
}

export function extractHeroImage(content: string, meta: any = {}): string | null {
    // 1. Check meta tags
    if (meta.image?.url) return meta.image.url;
    if (meta['media:thumbnail']?.url) return meta['media:thumbnail'].url;
    if (meta['og:image']) return meta['og:image'];
    if (meta['twitter:image']) return meta['twitter:image'];

    // 2. Scrape first usable img from content
    if (content) {
        // Skip common icons/small images
        const imgRegex = /<img[^>]+src="([^">]+)"[^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(content)) !== null) {
            const src = match[1];
            // Skip data URLs, icons, avatars, etc.
            if (src.startsWith('data:')) continue;
            if (src.includes('icon') || src.includes('avatar') || src.includes('logo') || src.includes('spinner')) continue;
            return src;
        }
    }

    return null;
}

export async function fetchRedditIcon(subreddit: string): Promise<string | null> {
    try {
        const response = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`, {
            headers: { 'User-Agent': USER_AGENT }
        });
        if (!response.ok) return null;
        const data = await response.json();
        const icon = data.data?.community_icon || data.data?.icon_img;
        if (icon) {
            // Reddit icons often have escaped unicode like \u0026 -> &
            const url = icon.split('?')[0]; // Remove query params which often expire
            return url.replace(/&amp;/g, '&');
        }
        return null;
    } catch {
        return null;
    }
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
    const baseHeaders = {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    };
    const isYouTubeFeed = url.toLowerCase().includes('youtube.com/feeds');

    let response = await fetch(url, {
        headers: baseHeaders,
        signal: AbortSignal.timeout(HTTP.REQUEST_TIMEOUT),
    });

    if (!response.ok && isYouTubeFeed) {
        response = await fetch(url, {
            headers: {
                ...baseHeaders,
                'User-Agent': YOUTUBE_USER_AGENT,
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(HTTP.REQUEST_TIMEOUT),
        });
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();

    return new Promise((resolve, reject) => {
        const feedparser = new FeedParser({ feedurl: url });
        const articles: RawArticle[] = [];
        let feedMeta: FeedParser.Meta | null = null;
        let isPodcast = false;

        feedparser.on('error', reject);

        feedparser.on('readable', function (this: FeedParser) {
            let item: FeedParser.Item | null;
            while ((item = this.read())) {
                const extendedItem = item as ExtendedItem;

                // Check for podcast indicators
                if (item.enclosures?.some((e) => e.type?.startsWith('audio/'))) {
                    isPodcast = true;
                }

                articles.push({
                    guid: item.guid || item.link || generateGuid(item),
                    title: item.title || STRINGS.DEFAULT_ARTICLE_TITLE,
                    link: item.link || item.origlink || '',
                    author: item.author || extendedItem['dc:creator'] || null,
                    summary: truncate(stripHtml(item.summary || item.description || ''), CONTENT.MAX_SUMMARY_LENGTH),
                    description: item.description || extendedItem['content:encoded'] || item.summary || null,
                    pubdate: item.pubdate || item.date || null,
                    enclosures: item.enclosures || [],
                    image: item.image,
                    thumbnail: extendedItem['media:thumbnail']?.url,
                });
            }
        });

        feedparser.on('meta', function (this: FeedParser, meta: FeedParser.Meta) {
            const extendedMeta = meta as ExtendedMeta;
            feedMeta = meta;
            // Check for iTunes namespace (podcast indicator)
            if (extendedMeta['itunes:author'] || extendedMeta['itunes:summary']) {
                isPodcast = true;
            }
        });

        feedparser.on('end', () => {
            if (!feedMeta) {
                reject(new Error('Could not parse feed metadata'));
                return;
            }

            const extendedMeta = feedMeta as any;
            let favicon = feedMeta.favicon ||
                feedMeta.image?.url ||
                extendedMeta['itunes:image']?.href ||
                extendedMeta['itunes:image'] ||
                extendedMeta['media:thumbnail']?.url ||
                extendedMeta['media:content']?.url;

            if (!favicon && feedMeta.link) {
                const linkUrl = feedMeta.link;
                if (linkUrl.includes('reddit.com')) {
                    favicon = 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png';
                } else {
                    favicon = extractFavicon(linkUrl);
                    if (!favicon) {
                        try {
                            favicon = `https://www.google.com/s2/favicons?domain=${new URL(linkUrl).hostname}&sz=64`;
                        } catch {
                            favicon = null;
                        }
                    }
                }
            }

            resolve({
                title: feedMeta.title || STRINGS.DEFAULT_FEED_TITLE,
                description: feedMeta.description || null,
                link: feedMeta.link || feedMeta.xmlurl || null,
                favicon: favicon,
                articles,
                isPodcast,
                youtubeChannelId: (extendedMeta as any)['yt:channelid'] || (extendedMeta as any)['yt:channelId'] || null,
            });
        });

        // Stream the text to feedparser
        const stream = Readable.from([text]);
        stream.pipe(feedparser);
    }).then(async (feed: any) => {
        // Post-processing for specific feed types (async icon fetching)
        const type = detectFeedType(url, feed);

        if (type === 'youtube') {
            // Always fetch YouTube channel icon (don't use generic YouTube favicon)
            // 1. Try to get channel ID from metadata first (most reliable)
            let channelId = feed.youtubeChannelId;

            // 2. Fallback: Extract from feed URL parameter
            if (!channelId) {
                try {
                    const urlObj = new URL(url);
                    channelId = urlObj.searchParams.get('channel_id');
                } catch { }
            }

            if (channelId) {
                const icon = await fetchYouTubeIcon(channelId);
                if (icon) {
                    feed.favicon = icon;
                }
            }
        } else if (type === 'reddit') {
            // Link format: https://www.reddit.com/r/subreddit/
            const subredditMatch = feed.link?.match(/\/r\/([^\/]+)/);
            if (subredditMatch) {
                const icon = await fetchRedditIcon(subredditMatch[1]);
                if (icon) feed.favicon = icon;
            }
        }

        return feed;
    });
}

export function normalizeArticle(raw: RawArticle, feedType: FeedType): NormalizedArticle {
    const enclosure = raw.enclosures?.[0];
    let thumbnail = extractHeroImage(raw.description || raw.summary || '', raw);
    let author = raw.author;
    let content = raw.description || raw.summary || null;
    let url = raw.link || null;
    let summary = raw.summary;

    if (feedType === 'youtube') {
        const guidMatch = raw.guid?.match(STRINGS.YOUTUBE_VIDEO_ID_PATTERN);
        let videoId = guidMatch ? guidMatch[1] : null;

        // Fallback: Try to find video ID in the link if not in GUID
        if (!videoId && raw.link) {
            const urlMatch = raw.link.match(/(?:v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
            if (urlMatch) {
                videoId = urlMatch[1];
            }
        }

        if (!url && videoId) {
            url = `https://www.youtube.com/watch?v=${videoId}`;
        }
        if (!thumbnail && videoId) {
            thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
    }

    // Reddit specific normalization
    if (feedType === 'reddit') {
        // Clean up Reddit content (often contains [link] [comments] footers)
        if (content) {
            content = cleanRedditContent(content);
        }

        // Regenerate summary from cleaned content to avoid Reddit footers
        summary = content ? truncate(stripHtml(content), CONTENT.PREVIEW_SUMMARY_LENGTH) : null;

        // Reddit author is usually u/username
        if (author && !author.startsWith('u/')) {
            author = `u/${author}`;
        }

        // Reddit thumbnails
        if (!thumbnail && content) {
            // Support both src and preview patterns
            const imgMatch = content.match(/<img[^>]+src="([^">]+)"/) || content.match(/<a[^>]+href="([^">]+\.(?:jpg|jpeg|png|gif|webp)[^">]*)"/i);
            if (imgMatch) {
                thumbnail = imgMatch[1];
            }
        }

        if (thumbnail) {
            // First decode any &amp; entities often found in Reddit thumbnails
            thumbnail = decodeHtmlEntities(thumbnail);
            thumbnail = upgradeRedditImageUrl(thumbnail);
        }
    }

    return {
        guid: raw.guid,
        title: decodeHtmlEntities(raw.title),
        url: url,
        author: author,
        summary: decodeHtmlEntities(summary),
        content: content,
        enclosure_url: enclosure?.url || null,
        enclosure_type: enclosure?.type || null,
        thumbnail_url: thumbnail,
        published_at: raw.pubdate ? raw.pubdate.toISOString() : null,
    };
}

function cleanRedditContent(html: string): string {
    // Remove the "submitted by /u/... to /r/..." footer that Reddit RSS adds
    // which consists of a table with common links
    return html.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '').trim();
}

function upgradeRedditImageUrl(url: string): string {
    try {
        const urlObj = new URL(url);

        // For preview.redd.it, optimize for thumbnails (640px width)
        if (urlObj.hostname === 'preview.redd.it') {
            urlObj.searchParams.set('width', '640');
            urlObj.searchParams.set('crop', 'smart');
            urlObj.searchParams.set('auto', 'webp');
            urlObj.searchParams.set('s', ''); // Keep the signature if present
            return urlObj.toString();
        }

        // For external-preview.redd.it, optimize for thumbnails
        if (urlObj.hostname === 'external-preview.redd.it') {
            urlObj.searchParams.set('width', '640');
            urlObj.searchParams.set('format', 'jpg');
            urlObj.searchParams.set('auto', 'webp');
            return urlObj.toString();
        }

        return url;
    } catch {
        return url;
    }
}

export function detectFeedType(url: string, feed: ParsedFeed): FeedType {
    const urlLower = url.toLowerCase();
    const siteUrlLower = (feed.link || '').toLowerCase();

    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || siteUrlLower.includes('youtube.com')) {
        return 'youtube';
    }

    if (urlLower.includes('reddit.com') || siteUrlLower.includes('reddit.com')) {
        return 'reddit';
    }

    if (feed.isPodcast) {
        return 'podcast';
    }

    return 'rss';
}

function generateGuid(item: FeedParser.Item): string {
    const content = `${item.title || ''}${item.link || ''}${item.pubdate || ''}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `${STRINGS.GENERATED_GUID_PREFIX}${Math.abs(hash).toString(MISC.HASH_RADIX)}`;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.substring(0, length).replace(/\s+\S*$/, '') + CONTENT.TRUNCATION_SUFFIX;
}

function decodeHtmlEntities(text: string | null): string {
    if (!text) return '';
    return text.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity) => {
        const entities: Record<string, string> = {
            'amp': '&',
            'lt': '<',
            'gt': '>',
            'quot': '"',
            'apos': "'",
            'nbsp': ' ',
        };
        if (entity.startsWith('#')) {
            const isHex = entity.charAt(1).toLowerCase() === 'x';
            try {
                const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
                return isNaN(code) ? match : String.fromCharCode(code);
            } catch {
                return match;
            }
        }
        const lowerEntity = entity.toLowerCase();
        return entities[lowerEntity] || match;
    });
}

function extractFavicon(siteUrl: string | null): string | null {
    if (!siteUrl) return null;
    try {
        const url = new URL(siteUrl);
        return `${url.origin}/favicon.ico`;
    } catch {
        return null;
    }
}
