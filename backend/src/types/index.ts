import { FeedType } from '../services/feed-parser.js';

// Core data models
export interface Feed {
    id: number;
    user_id: number;
    folder_id: number | null;
    type: FeedType;
    title: string;
    url: string;
    site_url: string | null;
    icon_url: string | null;
    description: string | null;
    refresh_interval_minutes: number;
    last_fetched_at: string | null;
    next_fetch_at: string | null;
    error_count: number;
    last_error: string | null;
    last_error_at: string | null;
    paused_at: string | null;
    deleted_at: string | null;
    icon_cached_path: string | null;
    icon_cached_content_type: string | null;
    created_at: string;
    updated_at: string;
    icon_updated_at?: string;
}

export interface Article {
    id: number;
    feed_id: number;
    guid: string;
    title: string;
    url: string | null;
    author: string | null;
    summary: string | null;
    content: string | null;
    readability_content: string | null;
    enclosure_url: string | null;
    enclosure_type: string | null;
    enclosure_length: number | null;
    duration_seconds: number | null;
    thumbnail_url: string | null;
    thumbnail_cached_path: string | null;
    published_at: string | null;
    fetched_at: string;
}

export interface Folder {
    id: number;
    user_id: number;
    name: string;
    position: number;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface SmartFolder {
    type: string;
    name: string;
    unread_count: number;
}

// Statistics and progress tracking
export interface ImportStats {
    success: number;
    skipped: number;
    errors: number;
    failed_feeds: Array<{ id: number; title: string; error: string }>;
}

export interface RefreshStats {
    success: number;
    errors: number;
    failed_feeds: Array<{ id: number; title: string; error: string }>;
}

export interface RefreshFeedUpdate {
    id: number;
    title: string;
    icon_url: string | null;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
}

// SSE Progress Events
export type ProgressEvent =
    | { type: 'start'; total_folders: number; total_feeds: number }
    | { type: 'folder_created'; name: string; id: number }
    | { type: 'feed_created'; title: string; id: number; folder?: string; status: 'created' | 'duplicate' }
    | { type: 'feed_refreshing'; id: number; title: string }
    | { type: 'feed_complete'; id: number; title: string; new_articles: number }
    | { type: 'feed_error'; id: number; title: string; error: string }
    | { type: 'complete'; stats: ImportStats };

export type RefreshProgressEvent =
    | { type: 'start'; total_feeds: number }
    | { type: 'feed_refreshing'; id: number; title: string }
    | { type: 'feed_complete'; id: number; title: string; new_articles: number; next_fetch_at?: string; feed?: RefreshFeedUpdate }
    | { type: 'feed_error'; id: number; title: string; error: string }
    | { type: 'complete'; stats: RefreshStats };
