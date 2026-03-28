/**
 * API Type Definitions
 * 
 * This file contains all TypeScript interfaces and types used by the API client.
 * Keeping types separate from implementation improves maintainability and
 * allows importing types without pulling in the full API client.
 */

// ============================================================================
// Core Entity Types
// ============================================================================

export interface Feed {
    id: number;
    folder_id: number | null;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
    title: string;
    url: string;
    site_url: string | null;
    icon_url: string | null;
    description: string | null;
    unread_count: number;
    refresh_interval_minutes: number;
    last_fetched_at: string | null;
    next_fetch_at: string | null;
    error_count: number;
    last_error: string | null;
    last_error_at: string | null;
    paused_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface FeedInfo {
    feed: Feed;
    status: 'healthy' | 'paused' | 'error';
    total_articles: number;
    unread_count: number;
}

export interface Folder {
    id: number;
    name: string;
    position: number;
    feed_count: number;
    unread_count: number;
}

export interface SmartFolder {
    type: string;
    name: string;
    unread_count: number;
}

export interface Article {
    id: number;
    feed_id: number;
    feed_title: string;
    feed_icon_url: string | null;
    feed_type: string;
    title: string;
    url: string | null;
    author: string | null;
    summary: string | null;
    published_at: string | null;
    is_read: boolean;
    is_bookmarked: boolean;
    has_audio: boolean;
    enclosure_url: string | null;
    thumbnail_url?: string | null;
    site_name?: string | null;
    byline?: string | null;
    hero_image?: string | null;
    bookmark_folder_id?: number | null;
    bookmark_folder_name?: string | null;
    bookmark_archived_at?: string | null;
    bookmark_note?: string | null;
}

export interface ArticleDetail extends Article {
    content: string | null;
    readability_content: string | null;
    enclosure_type: string | null;
}

export interface BookmarkFolder {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
    bookmark_count?: number;
}

export interface BookmarksResponse {
    articles: Article[];
    folders: BookmarkFolder[];
}

export interface DiscoveredFeed {
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
    title: string;
    description?: string;
    feed_url: string;
    site_url?: string;
    icon_url?: string;
    confidence: number;
    method: string;
    isActive?: boolean;
    lastPostDate?: string;
}

export interface FeedPreview {
    title: string;
    url: string;
    thumbnail?: string;
    published_at?: string;
    summary?: string;
}

export interface SettingsExport {
    exported_at: string;
    settings: Settings;
    global_last_refresh_at: string | null;
    global_next_refresh_at: string | null;
}

export interface BookmarksExport {
    exported_at: string;
    articles: Article[];
}

export interface BackupExport {
    exported_at: string;
    settings: Settings;
    global_last_refresh_at: string | null;
    global_next_refresh_at: string | null;
    bookmarks: {
        guid: string;
        url: string | null;
        title: string;
        published_at: string | null;
        feed_title: string;
        feed_type: string;
    }[];
}

export interface BackupRestoreResult {
    success: boolean;
    restored: {
        settings: boolean;
        bookmarks: number;
    };
}

// ============================================================================
// Settings & Configuration
// ============================================================================

export interface FeedFetchLimits {
    rss_days: number;
    youtube_count: number;
    youtube_days: number;
    reddit_days: number;
    podcast_count: number;
}

export interface Settings {
    refresh_interval_minutes: number;
    retention_days: number;
    fetch_full_content: boolean;
    readability_enabled: boolean;
    theme: 'light' | 'dark' | 'auto';
    font_size: 'small' | 'medium' | 'large';
    show_images: boolean;
    keep_screen_awake?: boolean;
    reader_width?: 'narrow' | 'comfortable' | 'wide';
    font_family?: 'sans' | 'serif';
    reader_theme?: 'default' | 'sepia' | 'paper' | 'dark';
    reader_line_height?: number;
    accent_color?: 'emerald' | 'sky' | 'indigo' | 'purple' | 'rose' | 'orange' | 'amber' | 'lime' | 'cyan' | 'teal' | 'slate';
    feed_fetch_limits?: FeedFetchLimits;
}

export interface DigestSettings {
    enabled: boolean;
    schedule: string;
    schedule_morning: string;
    schedule_evening: string;
    included_feeds: number[] | null;
    style: 'bullets' | 'paragraphs';
}

// ============================================================================
// Request Parameters
// ============================================================================

export interface ArticleListParams {
    feed_id?: number;
    folder_id?: number;
    type?: string;
    unread_only?: boolean;
    cursor?: string;
    limit?: number;
}

export interface MarkReadScope {
    scope: 'feed' | 'folder' | 'type' | 'all' | 'ids';
    scope_id?: number;
    type?: string;
    article_ids?: number[];
    before?: string;
}

export interface SearchParams {
    unread_only?: boolean;
    type?: string;
    feedId?: number;
    folderId?: number;
    author?: string;
    tags?: string[];
    limit?: number;
    includeTotal?: boolean;
}

export interface SearchSuggestions {
    query: string;
    recent_searches: SearchHistoryEntry[];
    popular_searches: { query: string; count: number }[];
    saved_searches: SavedSearch[];
    tags: string[];
    authors: string[];
    feeds: { id: number; title: string; type: string }[];
    folders: { id: number; name: string }[];
    articles: SearchResult[];
}

export interface SavedSearchFilters {
    query?: string;
    unread_only?: boolean;
    feed_id?: number;
    folder_id?: number;
    feed_ids?: number[];
    folder_ids?: number[];
    author?: string;
    tags?: string[];
    is_read?: boolean;
    is_bookmarked?: boolean;
    has_video?: boolean;
    has_audio?: boolean;
    date_from?: string;
    date_to?: string;
    type?: string;
}

export interface SavedSearch {
    id: number;
    user_id: number;
    name: string;
    query: string;
    filters: SavedSearchFilters;
    use_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SavedSearchExecutionResponse {
    search: SavedSearch;
    results: SearchResult[];
    pagination: {
        total?: number;
        limit: number;
        offset: number;
        has_more: boolean;
    };
}

export interface SearchHistoryEntry {
    id: number;
    user_id: number;
    query: string;
    filters: SavedSearchFilters;
    result_count: number;
    searched_at: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface SearchResult {
    id: number;
    feed_id: number;
    feed_title: string;
    title: string;
    snippet: string;
    published_at: string | null;
    is_read: boolean;
    score: number;
}

export interface SyncResponse {
    changes: {
        feeds?: { created: Feed[]; updated: Feed[]; deleted: number[] };
        folders?: { created: Folder[]; updated: Folder[]; deleted: number[] };
        articles?: { created: Article[]; updated: Article[]; deleted: number[] };
        read_state?: { read: number[]; unread: number[] };
    };
    next_cursor: string;
    server_time: string;
}

export interface Digest {
    id: number;
    generated_at: string;
    content: string;
    article_count: number;
    feed_count: number;
    edition?: 'morning' | 'evening';
    title?: string;
    topics?: string[];
}

export interface Recommendation {
    id: number;
    feed_url: string;
    feed_type: 'rss' | 'youtube' | 'reddit' | 'podcast';
    title: string;
    description: string;
    relevance_score: number;
    reason: string;
    metadata: string;
    status: 'pending' | 'subscribed' | 'dismissed';
    discovered_at: string;
}

export interface Interest {
    topic: string;
    source: 'explicit' | 'derived' | 'content_analysis';
    confidence: number;
}

// ============================================================================
// Authentication
// ============================================================================

export interface AuthResponse {
    token: string;
    user: {
        id: number;
        username: string;
    };
}

export interface AuthStatus {
    authEnabled: boolean;
    needsSetup: boolean;
    hasEnvPassword: boolean;
    build?: {
        version: string;
        sha: string;
    };
}

// ============================================================================
// SSE Progress Events
// ============================================================================

export interface ImportStats {
    success: number;
    skipped: number;
    errors: number;
    failed_feeds: { id: number; title: string; error: string }[];
}

export type ProgressEvent =
    | { type: 'start'; total_folders: number; total_feeds: number }
    | { type: 'folder_created'; name: string; id: number }
    | { type: 'feed_created'; title: string; id: number; folder?: string; status: 'created' | 'duplicate' }
    | { type: 'feed_refreshing'; id: number; title: string }
    | { type: 'feed_complete'; id: number; title: string; new_articles: number }
    | { type: 'feed_error'; id: number; title: string; error: string }
    | { type: 'complete'; stats: ImportStats };

export interface RefreshStats {
    success: number;
    errors: number;
    failed_feeds: { id: number; title: string; error: string }[];
}

export interface RefreshFeedUpdate {
    id: number;
    title: string;
    icon_url: string | null;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
}

export type RefreshProgressEvent =
    | { type: 'start'; total_feeds: number }
    | { type: 'feed_refreshing'; id: number; title: string }
    | { type: 'feed_complete'; id: number; title: string; new_articles: number; next_fetch_at?: string; feed?: RefreshFeedUpdate }
    | { type: 'feed_error'; id: number; title: string; error: string }
    | { type: 'complete'; stats: RefreshStats };
