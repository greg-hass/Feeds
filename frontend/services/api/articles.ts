import type {
    Article,
    ArticleDetail,
    ArticleListParams,
    BookmarkFolder,
    BookmarksResponse,
    MarkReadScope,
    SavedSearch,
    SavedSearchExecutionResponse,
    SavedSearchFilters,
    SearchParams,
    SearchResult,
    SearchSuggestions,
} from '../api.types';
import type { ApiClientCore } from './client';

export function createArticlesApi(client: ApiClientCore) {
    return {
        async getArticles(params: ArticleListParams = {}) {
            const searchParams = new URLSearchParams();
            if (params.feed_id) searchParams.set('feed_id', String(params.feed_id));
            if (params.folder_id) searchParams.set('folder_id', String(params.folder_id));
            if (params.type) searchParams.set('type', params.type);
            if (params.unread_only) searchParams.set('unread_only', 'true');
            if (params.cursor) searchParams.set('cursor', params.cursor);
            if (params.limit) searchParams.set('limit', String(params.limit));

            const query = searchParams.toString();
            return client.request<{ articles: Article[]; next_cursor: string | null; total_unread: number }>(
                `/articles${query ? `?${query}` : ''}`
            );
        },

        async getArticle(id: number) {
            return client.request<{ article: ArticleDetail }>(`/articles/${id}`);
        },

        async markArticleRead(id: number) {
            return client.request<{ success: boolean }>(`/articles/${id}/read`, { method: 'POST' });
        },

        async markArticleUnread(id: number) {
            return client.request<{ success: boolean }>(`/articles/${id}/unread`, { method: 'POST' });
        },

        async markArticlesRead(scope: MarkReadScope) {
            return client.request<{ marked: number }>('/articles/mark-read', {
                method: 'POST',
                body: scope,
            });
        },

        async bookmarkArticle(
            id: number,
            bookmarked: boolean,
            options: { folder_id?: number | null; archived?: boolean | null } = {}
        ) {
            return client.request<{ success: boolean; is_bookmarked: boolean }>(`/articles/${id}/bookmark`, {
                method: 'PATCH',
                body: { bookmarked, ...options },
            });
        },

        async getBookmarks(params: { folderId?: number; archived?: boolean; query?: string; limit?: number } = {}) {
            const searchParams = new URLSearchParams();
            if (params.folderId !== undefined) searchParams.set('folder_id', String(params.folderId));
            if (params.archived !== undefined) searchParams.set('archived', params.archived ? 'true' : 'false');
            if (params.query?.trim()) searchParams.set('query', params.query.trim());
            if (params.limit) searchParams.set('limit', String(params.limit));

            const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
            return client.request<BookmarksResponse>(`/articles/bookmarks${suffix}`);
        },

        async getBookmarkFolders() {
            return client.request<{ folders: BookmarkFolder[] }>('/articles/bookmarks/folders');
        },

        async createBookmarkFolder(name: string) {
            return client.request<BookmarkFolder>('/articles/bookmarks/folders', {
                method: 'POST',
                body: { name },
            });
        },

        async fetchReadability(id: number) {
            return client.request<{ content: string }>(`/articles/${id}/readability`, {
                method: 'POST',
            });
        },

        async search(query: string, params: SearchParams = {}) {
            const searchParams = new URLSearchParams({ q: query });
            if (params.unread_only) searchParams.set('unread_only', 'true');
            if (params.type) searchParams.set('type', params.type);
            if (params.feedId) searchParams.set('feed_id', String(params.feedId));
            if (params.folderId) searchParams.set('folder_id', String(params.folderId));
            if (params.author) searchParams.set('author', params.author);
            if (params.tags?.length) {
                params.tags.forEach((tag) => searchParams.append('tags', tag));
            }
            if (params.limit) searchParams.set('limit', String(params.limit));
            if (params.includeTotal === false) searchParams.set('include_total', 'false');

            return client.request<{ results: SearchResult[]; total?: number; next_cursor: string | null }>(
                `/search?${searchParams.toString()}`
            );
        },

        async searchSuggestions(query: string, limit = 8) {
            const searchParams = new URLSearchParams();
            if (query.trim()) {
                searchParams.set('q', query.trim());
            }
            searchParams.set('limit', String(limit));

            return client.request<SearchSuggestions>(`/search/suggestions?${searchParams.toString()}`);
        },

        async getSavedSearches() {
            return client.request<{ searches: SavedSearch[] }>('/search/saved');
        },

        async createSavedSearch(name: string, query: string, filters: SavedSearchFilters) {
            return client.request<SavedSearch>('/search/saved', {
                method: 'POST',
                body: { name, query, filters },
            });
        },

        async executeSavedSearch(id: number, options: { limit?: number; offset?: number; includeTotal?: boolean } = {}) {
            const searchParams = new URLSearchParams();
            if (options.limit) searchParams.set('limit', String(options.limit));
            if (options.offset) searchParams.set('offset', String(options.offset));
            if (options.includeTotal === false) searchParams.set('include_total', 'false');

            return client.request<SavedSearchExecutionResponse>(
                `/search/saved/${id}/execute${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
            );
        },

        async deleteSavedSearch(id: number) {
            return client.request<{ success: boolean }>(`/search/saved/${id}`, {
                method: 'DELETE',
            });
        },
    };
}
