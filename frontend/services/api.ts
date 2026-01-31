import { parseSSEStream } from '@/utils/sse';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Feed,
    FeedInfo,
    Folder,
    SmartFolder,
    Article,
    ArticleDetail,
    DiscoveredFeed,
    Settings,
    DigestSettings,
    ArticleListParams,
    MarkReadScope,
    SearchParams,
    SearchResult,
    SyncResponse,
    Digest,
    Recommendation,
    Interest,
    AuthResponse,
    AuthStatus,
    ImportStats,
    ProgressEvent,
    RefreshStats,
    RefreshFeedUpdate,
    RefreshProgressEvent,
} from './api.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '/api/v1';
const AUTH_TOKEN_KEY = '@feeds_auth_token';

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
}

class ApiClient {
    private authToken: string | null = null;

    constructor() {
        // Load token from storage on init
        this.loadAuthToken();
    }

    async loadAuthToken(): Promise<void> {
        try {
            this.authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        } catch (e) {
            console.error('Failed to load auth token:', e);
        }
    }

    async setAuthToken(token: string): Promise<void> {
        this.authToken = token;
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    }

    async clearAuthToken(): Promise<void> {
        this.authToken = null;
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }

    async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { method = 'GET', body, headers = {} } = options;

        const requestHeaders: Record<string, string> = {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        };

        // Add auth token if available
        if (this.authToken) {
            requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
        }

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

    // Auth
    async login(password: string): Promise<AuthResponse> {
        const response = await this.post<AuthResponse>('/auth/login', { password });
        await this.setAuthToken(response.token);
        return response;
    }

    async setupPassword(password: string): Promise<AuthResponse> {
        const response = await this.post<AuthResponse>('/auth/setup', { password });
        await this.setAuthToken(response.token);
        return response;
    }

    async getAuthStatus(): Promise<AuthStatus> {
        return this.get<AuthStatus>('/auth/status');
    }

    async logout(): Promise<void> {
        await this.clearAuthToken();
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

    async getYouTubeChannelUrl(id: number) {
        return this.request<{ channel_url: string }>(`/feeds/${id}/youtube-channel`);
    }

    // Database Health
    async getDatabaseStats() {
        return this.get<{
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

// Re-export all types from api.types.ts for backward compatibility
export * from './api.types';

export const api = new ApiClient();
