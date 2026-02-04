import { FeedType } from '../services/feed-parser.js';

export interface DiscoveredFeed {
    type: FeedType;
    title: string;
    feed_url: string;
    site_url?: string;
    icon_url?: string;
    confidence: number;
    method: 'link_tag' | 'well_known' | 'pattern' | 'redirect' | 'youtube' | 'reddit' | 'directory' | 'search';
    isActive?: boolean;
    lastPostDate?: string;
}