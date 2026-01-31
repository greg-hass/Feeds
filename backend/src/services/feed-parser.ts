import FeedParser, { Item } from 'feedparser';
import { Readable } from 'stream';
import type { FeedItemExtensions, FeedMetaExtensions } from '../types/rss-extensions.js';
import { HTTP, CONTENT, STRINGS, MISC } from '../config/constants.js';
import { fetchWithRetry } from './http.js';
import { fetchYouTubeIcon, extractYouTubeChannelId, YOUTUBE_FETCH_USER_AGENT } from './youtube-parser.js';
import { fetchRedditIcon, cleanRedditContent, upgradeRedditImageUrl, normalizeRedditAuthor, extractRedditThumbnail } from './reddit-parser.js';
import { extractHeroImage, stripHtml, truncate, decodeHtmlEntities, extractFavicon } from './feed-utils.js';

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

const MAX_RETRIES = 2;
const BASE_RETRY_DELAY = 500;
const MAX_RETRY_DELAY = 2000;



async function fetchFeedWithFallback(url: string, signal?: AbortSignal): Promise<Response> {
    const baseHeaders = {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    };
    const isYouTubeFeed = url.toLowerCase().includes('youtube.com/feeds');

    const getSignal = () => {
        const timeoutSignal = AbortSignal.timeout(HTTP.REQUEST_TIMEOUT);
        return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    };

    try {
        return await fetchWithRetry(url, () => ({
            method: 'GET',
            headers: baseHeaders,
            signal: getSignal(),
        }), {
            retries: MAX_RETRIES,
            baseDelayMs: BASE_RETRY_DELAY,
            maxDelayMs: MAX_RETRY_DELAY,
        });
    } catch (err) {
        if (isYouTubeFeed) {
            console.log(`[YouTube] Retrying with YouTube user agent for: ${url}`);
            try {
                return await fetchWithRetry(url, () => ({
                    method: 'GET',
                    headers: {
                        ...baseHeaders,
                        'User-Agent': YOUTUBE_FETCH_USER_AGENT,
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    signal: getSignal(),
                }), {
                    retries: MAX_RETRIES,
                    baseDelayMs: BASE_RETRY_DELAY,
                    maxDelayMs: MAX_RETRY_DELAY,
                });
            } catch (youtubeErr) {
                const errorMessage = youtubeErr instanceof Error ? youtubeErr.message : String(youtubeErr);
                throw new Error(`YouTube fetch failed with both user agents: ${errorMessage}`);
            }
        }
        throw err;
    }
}

export async function parseFeed(url: string, options?: { skipIconFetch?: boolean, signal?: AbortSignal }): Promise<ParsedFeed> {
    validateUrl(url);
    
    const response = await fetchFeedWithFallback(url, options?.signal);

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
                youtubeChannelId: extractYouTubeChannelId(extendedMeta),
            });
        });

        // Stream the text to feedparser
        const stream = Readable.from([text]);
        stream.pipe(feedparser);
    }).then(async (feed: any) => {
        if (options?.skipIconFetch) {
            return feed;
        }

        const type = detectFeedType(url, feed);
        return await enhanceFeedWithIcon(feed, type, url);
    });
}

async function enhanceFeedWithIcon(feed: any, feedType: FeedType, url: string): Promise<any> {
    if (feedType === 'youtube') {
        const channelId = extractChannelIdFromUrl(url, feed.youtubeChannelId);
        if (channelId) {
            const icon = await fetchYouTubeIcon(channelId);
            if (icon) feed.favicon = icon;
        }
    } else if (feedType === 'reddit') {
        const subredditMatch = feed.link?.match(/\/r\/([^\/]+)/);
        if (subredditMatch) {
            const icon = await fetchRedditIcon(subredditMatch[1]);
            if (icon) feed.favicon = icon;
        }
    }
    
    return feed;
}

function extractChannelIdFromUrl(url: string, youtubeChannelId: string | null): string | null {
    let channelId = null;
    
    try {
        const urlObj = new URL(url);
        channelId = urlObj.searchParams.get('channel_id');
    } catch {}

    if (!channelId && youtubeChannelId) {
        // Handle both traditional UC... channel IDs and newer handle-based IDs (@username)
        if (youtubeChannelId.startsWith('UC') || youtubeChannelId.startsWith('@')) {
            channelId = youtubeChannelId;
        } else if (youtubeChannelId.length === 22) {
            // Legacy: 22-char ID without UC prefix
            channelId = 'UC' + youtubeChannelId;
        } else {
            channelId = youtubeChannelId;
        }
    }

    return channelId;
}

/**
 * Extracts YouTube video ID from GUID or URL
 */
function extractYouTubeVideoId(raw: RawArticle): string | null {
    const guidMatch = raw.guid?.match(STRINGS.YOUTUBE_VIDEO_ID_PATTERN);
    if (guidMatch) {
        return guidMatch[1];
    }
    
    // Fallback: Try to find video ID in the link
    if (raw.link) {
        const urlMatch = raw.link.match(/(?:v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
        if (urlMatch) {
            return urlMatch[1];
        }
    }
    
    return null;
}

/**
 * Normalizes a YouTube article with proper video URLs and thumbnails
 */
function normalizeYouTubeArticle(raw: RawArticle, baseFields: NormalizedArticle): NormalizedArticle {
    const videoId = extractYouTubeVideoId(raw);
    
    if (!videoId) {
        return baseFields;
    }
    
    // ALWAYS use the constructed watch URL for YouTube videos
    // Don't trust raw.link which might be a feed URL or malformed
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = baseFields.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    
    return {
        ...baseFields,
        url: videoUrl,
        thumbnail_url: thumbnailUrl,
    };
}

/**
 * Normalizes a Reddit article with cleaned content and author formatting
 */
function normalizeRedditArticle(raw: RawArticle, baseFields: NormalizedArticle): NormalizedArticle {
    let content = raw.description || raw.summary || null;
    let thumbnail = baseFields.thumbnail_url;
    
    if (content) {
        content = cleanRedditContent(content);
    }
    
    const summary = content ? truncate(stripHtml(content), CONTENT.PREVIEW_SUMMARY_LENGTH) : null;
    const author = normalizeRedditAuthor(raw.author);
    
    if (!thumbnail && content) {
        thumbnail = extractRedditThumbnail(content);
    } else if (thumbnail) {
        thumbnail = upgradeRedditImageUrl(decodeHtmlEntities(thumbnail));
    }
    
    return {
        ...baseFields,
        content,
        summary: decodeHtmlEntities(summary),
        author,
        thumbnail_url: thumbnail,
    };
}

/**
 * Article normalizers by feed type
 */
const articleNormalizers: Record<
    FeedType, 
    (raw: RawArticle, base: NormalizedArticle) => NormalizedArticle
> = {
    rss: (_raw, base) => base,
    podcast: (_raw, base) => base,
    youtube: normalizeYouTubeArticle,
    reddit: normalizeRedditArticle,
};

export function normalizeArticle(raw: RawArticle, feedType: FeedType): NormalizedArticle {
    const enclosure = raw.enclosures?.[0];
    
    // Build base normalized article with common fields
    const baseFields: NormalizedArticle = {
        guid: raw.guid,
        title: decodeHtmlEntities(raw.title),
        url: raw.link || null,
        author: raw.author,
        summary: decodeHtmlEntities(raw.summary),
        content: raw.description || raw.summary || null,
        enclosure_url: enclosure?.url || null,
        enclosure_type: enclosure?.type || null,
        thumbnail_url: extractHeroImage(raw.description || raw.summary || '', raw),
        published_at: raw.pubdate ? raw.pubdate.toISOString() : null,
    };
    
    // Apply feed-type specific normalization
    const normalizer = articleNormalizers[feedType];
    return normalizer(raw, baseFields);
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




function validateUrl(url: string): void {
    if (!url || typeof url !== 'string') {
        throw new Error('URL must be a non-empty string');
    }
    
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error(`Invalid protocol: ${parsed.protocol}`);
        }
        if (parsed.hostname.length > 253) {
            throw new Error('Hostname too long');
        }
    } catch (err) {
        throw new Error(`Invalid URL: ${url} - ${err}`);
    }
}
