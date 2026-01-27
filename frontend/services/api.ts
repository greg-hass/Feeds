import { parseSSEStream } from '@/utils/sse';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '/api/v1';

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
}

class ApiClient {
    async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { method = 'GET', body, headers = {} } = options;

        const requestHeaders: Record<string, string> = {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        };

        Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined) {
                requestHeaders[key] = value;
            }
        });

        // Don't set Content-Type for empty bodies or FormData.
        if (body !== undefined && body !== null && !(body instanceof FormData)) {
            requestHeaders['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            method,
            headers: requestHeaders,
            body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new ApiError(error.error || 'Request failed', response.status);
        }

        const contentType = response.headers.get('Content-Type');
        if (contentType && (contentType.includes('text/xml') || contentType.includes('application/xml') || contentType.includes('text/plain'))) {
            return response.text() as unknown as T;
        }

        return response.json();
    }
    async get<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    async post<T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'POST', body });
    }

    async patch<T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
    }

    async put<T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'PUT', body });
    }

    async delete<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }

    // Feeds
    async getFeeds() {
        return this.request<{ feeds: Feed[] }>('/feeds');
    }

    async addFeed(url: string, folderId?: number, discover = true, refreshInterval?: number) {
        return this.request<{ feed: Feed; discovered?: DiscoveredFeed; articles_added: number }>('/feeds', {
            method: 'POST',
            body: { url, folder_id: folderId, discover, refresh_interval_minutes: refreshInterval },
        });
    }

    async updateFeed(id: number, updates: Partial<Pick<Feed, 'title' | 'folder_id' | 'refresh_interval_minutes'>>) {
        return this.request<{ feed: Feed }>(`/feeds/${id}`, {
            method: 'PATCH',
            body: updates,
        });
    }

    async deleteFeed(id: number) {
        return this.request<{ deleted: boolean }>(`/feeds/${id}`, { method: 'DELETE' });
    }

    async refreshFeed(id: number) {
        return this.request<{ success: boolean; new_articles: number }>(`/feeds/${id}/refresh`, {
            method: 'POST',
        });
    }

    async pauseFeed(id: number) {
        return this.request<{ feed: Feed; paused: boolean }>(`/feeds/${id}/pause`, {
            method: 'POST',
        });
    }

    async resumeFeed(id: number) {
        return this.request<{ feed: Feed; resumed: boolean }>(`/feeds/${id}/resume`, {
            method: 'POST',
        });
    }

    async refreshFeedIcon(id: number) {
        return this.request<{ feed: Feed; icon_refreshed: boolean; message?: string }>(`/feeds/${id}/refresh-icon`, {
            method: 'POST',
        });
    }

    async clearIconCache() {
        return this.request<{ success: boolean }>('/feeds/clear-icon-cache', {
            method: 'POST',
        });
    }

    async getFeedInfo(id: number) {
        return this.request<FeedInfo>(`/feeds/${id}/info`);
    }

    // Database Health
    async getDatabaseStats() {
        return this.request<{
            database: {
                totalSizeMb: string;
                articleCount: number;
                feedCount: number;
                oldestArticleDate: string | null;
                ftsSizeMb: string;
            };
            tables: Array<{
                name: string;
                rows: number;
                estimatedSizeMb: string;
            }>;
            maintenance: {
                fragmentationPercent: string;
                needsVacuum: boolean;
                needsOptimize: boolean;
                recommendations: string[];
            };
        }>('/health/db-stats');
    }

    async optimizeDatabase() {
        return this.post<{
            success: boolean;
            message: string;
            durationMs: number;
        }>('/health/db-optimize');
    }

    async vacuumDatabase() {
        return this.post<{
            success: boolean;
            message: string;
            durationMs: number;
            mbReclaimed: string;
        }>('/health/db-vacuum');
    }

    async bulkFeedAction(action: 'move' | 'delete' | 'mark_read' | 'update_refresh_interval', feedIds: number[], folderId?: number | null, refreshInterval?: number) {
        return this.request<{ affected: number }>('/feeds/bulk', {
            method: 'POST',
            body: { action, feed_ids: feedIds, folder_id: folderId, refresh_interval_minutes: refreshInterval },
        });
    }

    // Folders
    async getFolders() {
        return this.request<{ folders: Folder[]; smart_folders: SmartFolder[]; totals: { all_unread: number } }>('/folders');
    }

    async createFolder(name: string) {
        return this.request<{ folder: Folder }>('/folders', {
            method: 'POST',
            body: { name },
        });
    }

    async updateFolder(id: number, name: string) {
        return this.request<{ folder: Folder }>(`/folders/${id}`, {
            method: 'PATCH',
            body: { name },
        });
    }

    async deleteFolder(id: number) {
        return this.request<{ deleted: boolean }>(`/folders/${id}`, { method: 'DELETE' });
    }

    // Articles
    async getArticles(params: ArticleListParams = {}) {
        const searchParams = new URLSearchParams();
        if (params.feed_id) searchParams.set('feed_id', String(params.feed_id));
        if (params.folder_id) searchParams.set('folder_id', String(params.folder_id));
        if (params.type) searchParams.set('type', params.type);
        if (params.unread_only) searchParams.set('unread_only', 'true');
        if (params.cursor) searchParams.set('cursor', params.cursor);
        if (params.limit) searchParams.set('limit', String(params.limit));

        const query = searchParams.toString();
        return this.request<{ articles: Article[]; next_cursor: string | null; total_unread: number }>(
            `/articles${query ? `?${query}` : ''}`
        );
    }

    async getArticle(id: number) {
        return this.request<{ article: ArticleDetail }>(`/articles/${id}`);
    }

    async markArticleRead(id: number) {
        return this.request<{ success: boolean }>(`/articles/${id}/read`, { method: 'POST' });
    }

    async markArticleUnread(id: number) {
        return this.request<{ success: boolean }>(`/articles/${id}/unread`, { method: 'POST' });
    }

    async markArticlesRead(scope: MarkReadScope) {
        return this.request<{ marked: number }>('/articles/mark-read', {
            method: 'POST',
            body: scope,
        });
    }

    async bookmarkArticle(id: number, bookmarked: boolean) {
        return this.request<{ success: boolean; is_bookmarked: boolean }>(`/articles/${id}/bookmark`, {
            method: 'PATCH',
            body: { bookmarked },
        });
    }

    async getBookmarks() {
        return this.request<{ articles: Article[] }>('/articles/bookmarks');
    }

    async fetchReadability(id: number) {
        return this.request<{ content: string }>(`/articles/${id}/readability`, {
            method: 'POST'
        });
    }

    // Search
    async search(query: string, params: SearchParams = {}) {
        const searchParams = new URLSearchParams({ q: query });
        if (params.unread_only) searchParams.set('unread_only', 'true');
        if (params.type) searchParams.set('type', params.type);
        if (params.limit) searchParams.set('limit', String(params.limit));

        return this.request<{ results: SearchResult[]; total: number; next_cursor: string | null }>(
            `/search?${searchParams.toString()}`
        );
    }

    // Discovery
    async discover(q: string, type?: string) {
        let url = `/discovery?q=${encodeURIComponent(q)}`;
        if (type) {
            url += `&type=${encodeURIComponent(type)}`;
        }
        return this.request<{ discoveries: DiscoveredFeed[] }>(url);
    }

    // OPML
    async importOpml(file: any) {
        const formData = new FormData();

        if (file.file) {
            // Web: file.file is the actual File object
            formData.append('opml', file.file);
        } else {
            // Native: construct file object
            formData.append('opml', {
                uri: file.uri,
                name: file.name || 'feeds.opml',
                type: file.mimeType || 'text/xml'
            } as any);
        }

        return this.request<{ imported: { folders: number; feeds: number } }>('/opml/import', {
            method: 'POST',
            body: formData,
            // Header is automatically set by fetch when body is FormData
            headers: {
                // Explicitly undefined to let browser/native set boundary
                'Content-Type': undefined as any
            }
        });
    }

    async exportOpml() {
        return this.request<string>('/opml/export', {
            headers: { 'Accept': 'text/xml' },
        });
    }

    async discoverFromUrl(url: string) {
        return this.request<{ discoveries: DiscoveredFeed[]; error?: string }>('/discovery/url', {
            method: 'POST',
            body: { url },
        });
    }

    // Settings
    async getSettings() {
        return this.request<{ settings: Settings }>('/settings');
    }

    async updateSettings(settings: Partial<Settings>) {
        return this.request<{ settings: Settings }>('/settings', {
            method: 'PATCH',
            body: settings,
        });
    }

    // Sync
    async sync(cursor?: string) {
        const params = cursor ? `?cursor=${cursor}` : '';
        return this.request<SyncResponse>(`/sync${params}`);
    }

    async pushSyncChanges(readState: Array<{ article_id: number; is_read: boolean }>) {
        return this.request<{ read_state: { accepted: number; rejected: number } }>('/sync/push', {
            method: 'POST',
            body: { read_state: readState },
        });
    }

    // Digest
    async getLatestDigest() {
        return this.request<{ digest: Digest | null }>('/digest');
    }

    async getPendingDigest() {
        return this.request<{ digest: Digest | null }>('/digest/pending');
    }

    async dismissDigest(id: number) {
        return this.request<{ success: boolean }>(`/digest/dismiss/${id}`, {
            method: 'POST',
        });
    }

    async generateDigest() {
        return this.request<{ success: boolean; digest: Digest }>('/digest/generate', {
            method: 'POST',
        });
    }

    async getDigestSettings() {
        return this.request<{ settings: DigestSettings }>('/digest/settings');
    }

    async updateDigestSettings(settings: Partial<DigestSettings>) {
        return this.request<{ success: boolean }>('/digest/settings', {
            method: 'PUT',
            body: settings,
        });
    }

    // AI Discovery
    async getRecommendations() {
        return this.request<{ recommendations: Recommendation[] }>('/discovery/recommendations');
    }

    async refreshRecommendations() {
        return this.request<{ recommendations: Recommendation[] }>('/discovery/refresh', {
            method: 'POST',
        });
    }

    async dismissRecommendation(id: number) {
        return this.request<{ success: boolean }>(`/discovery/${id}/dismiss`, {
            method: 'POST',
        });
    }

    async getInterests() {
        return this.request<{ interests: Interest[] }>('/discovery/interests');
    }

    async updateInterests(topics: string[]) {
        return this.request<{ success: boolean }>('/discovery/interests', {
            method: 'PUT',
            body: { topics },
        });
    }

    // SSE Progress Methods

    /**
     * Import OPML with progress tracking via SSE
     * Note: EventSource doesn't support POST, so we use fetch with ReadableStream
     */
    async importOpmlWithProgress(
        file: any,
        onEvent: (event: ProgressEvent) => void,
        onError?: (error: Error) => void
    ): Promise<void> {
        const formData = new FormData();

        if (file.file) {
            // Web: file.file is the actual File object
            formData.append('opml', file.file);
        } else {
            // Native: construct file object
            formData.append('opml', {
                uri: file.uri,
                name: file.name || 'feeds.opml',
                type: file.mimeType || 'text/xml'
            } as any);
        }

        try {
            // Note: Do NOT set Content-Type - browser will set it with proper multipart boundary
            const response = await fetch(`${API_URL}/opml-stream/import`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Import failed');
            }

            await parseSSEStream(response, onEvent);
        } catch (err) {
            onError?.(err instanceof Error ? err : new Error('Unknown error'));
        }
    }

    /**
     * Refresh multiple feeds with progress tracking via SSE
     */
    async refreshFeedsWithProgress(
        feedIds: number[] | undefined,
        onEvent: (event: RefreshProgressEvent) => void,
        onError?: (error: Error) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const idsParam = feedIds?.length ? `?ids=${feedIds.join(',')}` : '';

        try {
            const response = await fetch(`${API_URL}/feeds-stream/refresh-multiple${idsParam}`, {
                method: 'GET',
                signal,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Refresh failed');
            }

            await parseSSEStream(response, onEvent);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            if (error.name === 'AbortError') {
                return;
            }
            onError?.(error);
        }
    }

    /**
     * Listen for background refresh events via SSE
     */
    async listenForRefreshEvents(
        onEvent: (event: RefreshProgressEvent) => void,
        onError?: (error: Error) => void,
        signal?: AbortSignal
    ): Promise<void> {
        try {
            const response = await fetch(`${API_URL}/feeds-stream/refresh-events`, {
                method: 'GET',
                signal,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || 'Refresh event stream failed');
            }

            await parseSSEStream(response, onEvent);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            if (error.name === 'AbortError') {
                return;
            }
            onError?.(error);
        }
    }
}

// Error class
export class ApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
        this.name = 'ApiError';
    }
}

// Types
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
}

export interface ArticleDetail extends Article {
    content: string | null;
    readability_content: string | null;
    enclosure_type: string | null;
}

export interface DiscoveredFeed {
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
    title: string;
    feed_url: string;
    site_url?: string;
    icon_url?: string;
    confidence: number;
    method: string;
}

export interface Settings {
    refresh_interval_minutes: number;
    retention_days: number;
    fetch_full_content: boolean;
    readability_enabled: boolean;
    theme: 'light' | 'dark' | 'auto';
    font_size: 'small' | 'medium' | 'large';
    show_images: boolean;
    font_family?: 'sans' | 'serif';
    reader_theme?: 'default' | 'sepia' | 'paper' | 'dark';
    reader_line_height?: number;
    accent_color?: 'emerald' | 'blue' | 'indigo' | 'violet' | 'rose' | 'amber' | 'cyan' | 'yellow';
    view_density?: 'compact' | 'comfortable' | 'spacious';
}

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
    limit?: number;
}

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

// SSE Progress Event Types
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

export interface DigestSettings {
    enabled: boolean;
    schedule: string;
    schedule_morning: string;
    schedule_evening: string;
    included_feeds: number[] | null;
    style: 'bullets' | 'paragraphs';
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

export const api = new ApiClient();
