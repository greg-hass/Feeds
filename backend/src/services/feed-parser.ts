import FeedParser, { Item } from 'feedparser';
import { Readable } from 'stream';
import type { FeedItemExtensions, FeedMetaExtensions, asString } from '../types/rss-extensions.js';
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

const USER_AGENT = 'Feeds/1.0 (Feed Reader; +https://github.com/feeds)';

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

            resolve({
                title: feedMeta.title || STRINGS.DEFAULT_FEED_TITLE,
                description: feedMeta.description || null,
                link: feedMeta.link || feedMeta.xmlurl || null,
                favicon: feedMeta.favicon || feedMeta.image?.url || extractFavicon(feedMeta.link) || (feedMeta.link ? `https://www.google.com/s2/favicons?domain=${new URL(feedMeta.link).hostname}&sz=64` : null),
                articles,
                isPodcast,
            });
        });

        // Stream the text to feedparser
        const stream = Readable.from([text]);
        stream.pipe(feedparser);
    });
}

export function normalizeArticle(raw: RawArticle, feedType: FeedType): NormalizedArticle {
    const enclosure = raw.enclosures?.[0];
    let thumbnail = raw.thumbnail || raw.image?.url || null;
    let author = raw.author;
    let content = raw.description || raw.summary || null;
    let summary = raw.summary || (content ? truncate(stripHtml(content), CONTENT.PREVIEW_SUMMARY_LENGTH) : null);
    let url = raw.link || null;

    if (feedType === 'youtube') {
        const guidMatch = raw.guid?.match(STRINGS.YOUTUBE_VIDEO_ID_PATTERN);
        const videoId = guidMatch ? guidMatch[1] : null;
        if (!url && videoId) {
            url = `https://www.youtube.com/watch?v=${videoId}`;
        }
        if (!thumbnail && videoId) {
            thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
    }

    // Reddit specific normalization
    if (feedType === 'reddit') {
        // Reddit author is usually u/username
        if (author && !author.startsWith('u/')) {
            author = `u/${author}`;
        }

        // Reddit thumbnails are often in description or media:thumbnail (handled)
        // If no thumbnail, try to find one in the description HTML
        if (!thumbnail && content) {
            const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) {
                thumbnail = imgMatch[1];
            }
        }

        // Upgrade thumbnail to high-resolution version
        if (thumbnail) {
            thumbnail = upgradeRedditImageUrl(thumbnail);
        }

        // Clean up Reddit content (often contains [link] [comments] footers)
        if (content) {
            content = cleanRedditContent(content);
        }
    }

    return {
        guid: raw.guid,
        title: decodeHtmlEntities(raw.title),
        url: url,
        author: author,
        summary: summary,
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
    // Reddit images come in several formats:
    // 1. https://i.redd.it/... - direct images (already high-res)
    // 2. https://preview.redd.it/...?width=640&crop=... - preview images with size limits
    // 3. https://external-preview.redd.it/... - external previews

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
            // Set format to jpg for better quality
            urlObj.searchParams.set('format', 'jpg');
            urlObj.searchParams.set('auto', 'webp');
            return urlObj.toString();
        }

        // For i.redd.it and other formats, return as-is
        return url;
    } catch {
        // If URL parsing fails, return original
        return url;
    }
}

export function detectFeedType(url: string, feed: ParsedFeed): FeedType {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
        return 'youtube';
    }

    if (urlLower.includes('reddit.com')) {
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

function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' ',
    };
    return text.replace(/&[^;]+;/g, match => entities[match] || match);
}

function extractFavicon(siteUrl: string | null): string | null {
    if (!siteUrl) return null;
    try {
        const url = new URL(siteUrl);
        return `${url.protocol}//${url.host}/favicon.ico`;
    } catch {
        return null;
    }
}
