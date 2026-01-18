const API_URL = process.env.EXPO_PUBLIC_API_URL || '/api/v1';

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
}

class ApiClient {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
    }

    async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { method = 'GET', body, headers = {} } = options;

        const requestHeaders: Record<string, string> = { ...headers };

        // Don't set Content-Type for FormData, browser will set it with boundary
        if (!(body instanceof FormData)) {
            requestHeaders['Content-Type'] = 'application/json';
        }

        if (this.token) {
            requestHeaders['Authorization'] = `Bearer ${this.token}`;
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

    // Auth
    async getAuthStatus() {
        return this.request<{ setup_required: boolean; version: string }>('/auth/status');
    }

    async setup(username: string, password: string, baseUrl?: string) {
        return this.request<{ user: User; token: string }>('/auth/setup', {
            method: 'POST',
            body: { username, password, base_url: baseUrl },
        });
    }

    async login(username: string, password: string) {
        return this.request<{ user: User; token: string }>('/auth/login', {
            method: 'POST',
            body: { username, password },
        });
    }

    async getCurrentUser() {
        return this.request<{ user: User }>('/auth/me');
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

    async bulkFeedAction(action: 'move' | 'delete' | 'mark_read', feedIds: number[], folderId?: number) {
        return this.request<{ affected: number }>('/feeds/bulk', {
            method: 'POST',
            body: { action, feed_ids: feedIds, folder_id: folderId },
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
    async discover(q: string) {
        return this.request<{ discoveries: DiscoveredFeed[] }>(`/discover?q=${encodeURIComponent(q)}`);
    }

    // OPML
    async importOpml(opml: string) {
        const formData = new FormData();
        const blob = new Blob([opml], { type: 'text/xml' });
        formData.append('file', blob, 'import.opml');

        return this.request<{ imported: { feeds: number; folders: number } }>('/opml/import', {
            method: 'POST',
            body: formData,
        });
    }

    async exportOpml() {
        return this.request<string>('/opml/export', {
            headers: { 'Accept': 'text/xml' },
        });
    }

    async discoverFromUrl(url: string) {
        return this.request<{ discoveries: DiscoveredFeed[]; error?: string }>('/discover/url', {
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
}

// Error class
export class ApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
        this.name = 'ApiError';
    }
}

// Types
export interface User {
    id: number;
    username: string;
    is_admin: boolean;
}

export interface Feed {
    id: number;
    folder_id: number | null;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
    title: string;
    url: string;
    site_url: string | null;
    icon_url: string | null;
    unread_count: number;
    refresh_interval_minutes: number;
    last_fetched_at: string | null;
    error_count: number;
    last_error: string | null;
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

export const api = new ApiClient();
