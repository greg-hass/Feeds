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

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Feeds/1.0';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function fetchYouTubeIcon(channelId: string): Promise<string | null> {
    if (!YOUTUBE_API_KEY) return null;
    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data.items?.[0]?.snippet?.thumbnails?.default?.url || null;
    } catch {
        return null;
    }
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
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(HTTP.REQUEST_TIMEOUT),
    });

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
            });
        });

        // Stream the text to feedparser
        const stream = Readable.from([text]);
        stream.pipe(feedparser);
    }).then(async (feed: any) => {
        // Post-processing for specific feed types (async icon fetching)
        const type = detectFeedType(url, feed);

        if (type === 'youtube' && !feed.favicon) {
            // Try to extract channel ID from link
            // Link format: https://www.youtube.com/channel/UC... or https://www.youtube.com/user/...
            // The XML usually has loop for recent videos, getting channel ID is safer from the <entry><yt:channelId> if available?
            // Actually FeedParser output for 'rss' extension might help.
            // But usually the <link> is the channel URL.
            const channelIdMatch = feed.link?.match(/\/channel\/(UC[\w-]+)/);
            if (channelIdMatch) {
                const icon = await fetchYouTubeIcon(channelIdMatch[1]);
                if (icon) feed.favicon = icon;
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
    let thumbnail = raw.thumbnail || raw.image?.url || null;
    let author = raw.author;
    let content = raw.description || raw.summary || null;
    let url = raw.link || null;
    let summary = raw.summary;

    if (feedType === 'youtube') {
        const guidMatch = raw.guid?.match(STRINGS.YOUTUBE_VIDEO_ID_PATTERN);
        const videoId = guidMatch ? guidMatch[1] : null;
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

        // For preview.redd.it, remove query parameters to get full resolution
        if (urlObj.hostname === 'preview.redd.it') {
            return `${urlObj.origin}${urlObj.pathname}`;
        }

        // For external-preview.redd.it, try to get higher resolution
        if (urlObj.hostname === 'external-preview.redd.it') {
            urlObj.searchParams.delete('width');
            urlObj.searchParams.delete('height');
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
