/**
 * Type definitions for common RSS/Atom namespace extensions
 * These extend the base FeedParser types with proper typing for namespace properties
 */
import type { Item as FeedParserItem, Meta as FeedParserMeta } from 'feedparser';

// Re-export FeedParser types for convenience
export type FeedParser = {
    Item: FeedParserItem;
    Meta: FeedParserMeta;
};

/**
 * Dublin Core (dc) namespace extensions
 * @see https://web.resource.org/rss/1.0/modules/dc/
 */
export interface DublinCoreExtensions {
    'dc:creator'?: string;
    'dc:title'?: string;
    'dc:description'?: string;
    'dc:date'?: string;
    'dc:subject'?: string;
    'dc:language'?: string;
    'dc:publisher'?: string;
    'dc:format'?: string;
    'dc:identifier'?: string;
    'dc:source'?: string;
    'dc:coverage'?: string;
    'dc:rights'?: string;
}

/**
 * Content namespace extensions
 * @see http://purl.org/rss/1.0/modules/content/
 */
export interface ContentExtensions {
    'content:encoded'?: string;
}

/**
 * Media RSS namespace extensions
 * @see http://search.yahoo.com/mrss/
 */
export interface MediaThumbnail {
    url?: string;
    width?: number;
    height?: number;
    time?: string;
}

export interface MediaContent {
    url?: string;
    type?: string;
    width?: number;
    height?: number;
    medium?: 'image' | 'audio' | 'video' | 'document' | 'executable';
    isDefault?: boolean;
    expression?: 'sample' | 'full' | 'nonstop';
    bitrate?: number;
    framerate?: number;
    samplingrate?: number;
    channels?: number;
    duration?: number;
    fileSize?: number;
}

export interface MediaExtensions {
    'media:thumbnail'?: MediaThumbnail;
    'media:content'?: MediaContent | MediaContent[];
    'media:group'?: {
        'media:thumbnail'?: MediaThumbnail;
        'media:content'?: MediaContent | MediaContent[];
    };
    'media:description'?: string;
    'media:title'?: string;
}

/**
 * iTunes podcast namespace extensions
 * @see https://help.apple.com/itc/podcasts_connect/#/itcb54353390
 */
export interface iTunesExtensions {
    'itunes:author'?: string;
    'itunes:block'?: 'yes' | 'no';
    'itunes:category'?: string;
    'itunes:explicit'?: 'yes' | 'no' | 'clean';
    'itunes:image'?: string | { href?: string };
    'itunes:complete'?: 'yes' | 'no';
    'itunes:keywords'?: string;
    'itunes:duration'?: string;
    'itunes:subtitle'?: string;
    'itunes:summary'?: string;
    'itunes:new-feed-url'?: string;
    'itunes:owner'?: {
        'itunes:name'?: string;
        'itunes:email'?: string;
    };
    'itunes:type'?: 'episodic' | 'serial';
}

/**
 * Atom namespace extensions
 */
export interface AtomExtensions {
    'atom:link'?: {
        href?: string;
        rel?: string;
        type?: string;
        hreflang?: string;
        title?: string;
        length?: number;
    } | Array<{
        href?: string;
        rel?: string;
        type?: string;
        hreflang?: string;
        title?: string;
        length?: number;
    }>;
    'atom:author'?: {
        name?: string;
        email?: string;
        uri?: string;
    };
    'atom:contributor'?: {
        name?: string;
        email?: string;
        uri?: string;
    };
    'atom:published'?: string;
    'atom:updated'?: string;
}

/**
 * Syndication namespace extensions
 */
export interface SyndicationExtensions {
    'sy:updatePeriod'?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    'sy:updateFrequency'?: number;
    'sy:updateBase'?: string;
}

/**
 * Combined extensions type for FeedParser.Item
 */
export interface FeedItemExtensions extends
    DublinCoreExtensions,
    ContentExtensions,
    MediaExtensions,
    AtomExtensions {}

/**
 * Combined extensions type for FeedParser.Meta
 */
export interface FeedMetaExtensions extends
    DublinCoreExtensions,
    iTunesExtensions,
    SyndicationExtensions,
    AtomExtensions {}

/**
 * Type guard to check if a value is a MediaThumbnail
 */
export function isMediaThumbnail(value: unknown): value is MediaThumbnail {
    return (
        typeof value === 'object' &&
        value !== null &&
        ('url' in value || 'width' in value || 'height' in value)
    );
}

/**
 * Type guard to check if a value is a MediaContent
 */
export function isMediaContent(value: unknown): value is MediaContent {
    return (
        typeof value === 'object' &&
        value !== null &&
        'url' in value
    );
}

/**
 * Safely extract a string from an unknown value
 */
export function asString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    return undefined;
}

/**
 * Safely extract a number from an unknown value
 */
export function asNumber(value: unknown): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
}

/**
 * Type-safe access to extended item properties
 */
export function getExtendedItemProperty<T>(
    item: FeedParserItem & Record<string, unknown>,
    key: string,
    transformer: (value: unknown) => T | undefined
): T | undefined {
    const value = item[key];
    return transformer(value);
}
