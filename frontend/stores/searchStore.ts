import { create } from 'zustand';
import { api } from '@/utils/api';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchFilters {
    query?: string;
    feed_ids?: number[];
    folder_ids?: number[];
    author?: string;
    tags?: string[];
    is_read?: boolean;
    is_bookmarked?: boolean;
    has_video?: boolean;
    has_audio?: boolean;
    date_from?: string; // ISO date
    date_to?: string; // ISO date
    type?: string;
}

export interface SearchResult {
    id: number;
    title: string;
    url: string | null;
    author: string | null;
    summary: string | null;
    feed_id: number;
    feed_title: string;
    published_at: string | null;
    is_read: boolean;
    is_bookmarked: boolean;
    snippet?: string;
    rank?: number;
}

export interface SavedSearch {
    id: number;
    user_id: number;
    name: string;
    query: string;
    filters: SearchFilters;
    use_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SearchHistoryEntry {
    id: number;
    user_id: number;
    query: string;
    filters: SearchFilters;
    result_count: number;
    searched_at: string;
}

interface Pagination {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
}

// ============================================================================
// STORE
// ============================================================================

interface SearchState {
    // Current search state
    results: SearchResult[];
    filters: SearchFilters;
    pagination: Pagination | null;
    loading: boolean;
    error: string | null;

    // Saved searches
    savedSearches: SavedSearch[];
    savedSearchesLoading: boolean;

    // Search history
    searchHistory: SearchHistoryEntry[];
    historyLoading: boolean;

    // Autocomplete data
    availableTags: string[];
    availableAuthors: string[];
    autocompleteLoading: boolean;

    // Actions
    search: (filters: SearchFilters, limit?: number, offset?: number) => Promise<void>;
    clearResults: () => void;
    setFilters: (filters: SearchFilters) => void;
    resetFilters: () => void;

    // Saved searches
    fetchSavedSearches: () => Promise<void>;
    createSavedSearch: (name: string, query: string, filters: SearchFilters) => Promise<SavedSearch | null>;
    updateSavedSearch: (id: number, updates: Partial<Pick<SavedSearch, 'name' | 'query' | 'filters'>>) => Promise<boolean>;
    deleteSavedSearch: (id: number) => Promise<boolean>;
    executeSavedSearch: (id: number, limit?: number, offset?: number) => Promise<void>;

    // Search history
    fetchSearchHistory: (limit?: number) => Promise<void>;
    clearSearchHistory: () => Promise<boolean>;

    // Autocomplete
    fetchAutocompleteData: () => Promise<void>;

    // Helpers
    clearError: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
    results: [],
    filters: {},
    pagination: null,
    loading: false,
    error: null,
    savedSearches: [],
    savedSearchesLoading: false,
    searchHistory: [],
    historyLoading: false,
    availableTags: [],
    availableAuthors: [],
    autocompleteLoading: false,

    // ========================================================================
    // SEARCH
    // ========================================================================

    search: async (filters, limit = 50, offset = 0) => {
        set({ loading: true, error: null });
        try {
            const response = await api.post<{
                results: SearchResult[];
                pagination: Pagination;
            }>('/search/advanced', {
                ...filters,
                limit,
                offset,
            });

            set({
                results: response.results,
                pagination: response.pagination,
                filters,
                loading: false,
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Search failed',
                loading: false,
            });
        }
    },

    clearResults: () => {
        set({ results: [], pagination: null });
    },

    setFilters: (filters) => {
        set({ filters });
    },

    resetFilters: () => {
        set({ filters: {} });
    },

    // ========================================================================
    // SAVED SEARCHES
    // ========================================================================

    fetchSavedSearches: async () => {
        set({ savedSearchesLoading: true });
        try {
            const response = await api.get<{ searches: SavedSearch[] }>('/search/saved');
            set({ savedSearches: response.searches, savedSearchesLoading: false });
        } catch {
            set({ savedSearchesLoading: false });
        }
    },

    createSavedSearch: async (name, query, filters) => {
        try {
            const response = await api.post<SavedSearch>('/search/saved', {
                name,
                query,
                filters,
            });

            set((state) => ({
                savedSearches: [...state.savedSearches, response],
            }));

            return response;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to save search' });
            return null;
        }
    },

    updateSavedSearch: async (id, updates) => {
        try {
            await api.patch(`/search/saved/${id}`, updates);

            set((state) => ({
                savedSearches: state.savedSearches.map((s) =>
                    s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s
                ),
            }));

            return true;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to update search' });
            return false;
        }
    },

    deleteSavedSearch: async (id) => {
        try {
            await api.delete(`/search/saved/${id}`);

            set((state) => ({
                savedSearches: state.savedSearches.filter((s) => s.id !== id),
            }));

            return true;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to delete search' });
            return false;
        }
    },

    executeSavedSearch: async (id, limit = 50, offset = 0) => {
        set({ loading: true, error: null });
        try {
            const response = await api.get<{
                search: SavedSearch;
                results: SearchResult[];
                pagination: Pagination;
            }>(`/search/saved/${id}/execute?limit=${limit}&offset=${offset}`);

            set({
                results: response.results,
                pagination: response.pagination,
                filters: response.search.filters,
                loading: false,
            });

            // Update local saved search with new use count
            set((state) => ({
                savedSearches: state.savedSearches.map((s) =>
                    s.id === id
                        ? {
                              ...s,
                              use_count: s.use_count + 1,
                              last_used_at: new Date().toISOString(),
                          }
                        : s
                ),
            }));
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to execute saved search',
                loading: false,
            });
        }
    },

    // ========================================================================
    // SEARCH HISTORY
    // ========================================================================

    fetchSearchHistory: async (limit = 50) => {
        set({ historyLoading: true });
        try {
            const response = await api.get<{ history: SearchHistoryEntry[] }>(
                `/search/history?limit=${limit}`
            );
            set({ searchHistory: response.history, historyLoading: false });
        } catch {
            set({ historyLoading: false });
        }
    },

    clearSearchHistory: async () => {
        try {
            await api.delete('/search/history');
            set({ searchHistory: [] });
            return true;
        } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to clear history' });
            return false;
        }
    },

    // ========================================================================
    // AUTOCOMPLETE
    // ========================================================================

    fetchAutocompleteData: async () => {
        set({ autocompleteLoading: true });
        try {
            const [tagsResponse, authorsResponse] = await Promise.all([
                api.get<{ tags: string[] }>('/search/autocomplete/tags'),
                api.get<{ authors: string[] }>('/search/autocomplete/authors'),
            ]);

            set({
                availableTags: tagsResponse.tags,
                availableAuthors: authorsResponse.authors,
                autocompleteLoading: false,
            });
        } catch {
            set({ autocompleteLoading: false });
        }
    },

    // ========================================================================
    // HELPERS
    // ========================================================================

    clearError: () => set({ error: null }),
}));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format date for display
 */
export function formatSearchDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}

/**
 * Get active filters count
 */
export function getActiveFiltersCount(filters: SearchFilters): number {
    let count = 0;
    if (filters.query) count++;
    if (filters.feed_ids && filters.feed_ids.length > 0) count++;
    if (filters.folder_ids && filters.folder_ids.length > 0) count++;
    if (filters.author) count++;
    if (filters.tags && filters.tags.length > 0) count++;
    if (filters.is_read !== undefined) count++;
    if (filters.is_bookmarked !== undefined) count++;
    if (filters.has_video !== undefined) count++;
    if (filters.has_audio !== undefined) count++;
    if (filters.date_from) count++;
    if (filters.date_to) count++;
    if (filters.type) count++;
    return count;
}

/**
 * Format filters for display
 */
export function formatFiltersDescription(filters: SearchFilters): string {
    const parts: string[] = [];

    if (filters.query) parts.push(`"${filters.query}"`);
    if (filters.feed_ids && filters.feed_ids.length > 0) {
        parts.push(`${filters.feed_ids.length} feed${filters.feed_ids.length > 1 ? 's' : ''}`);
    }
    if (filters.author) parts.push(`by ${filters.author}`);
    if (filters.tags && filters.tags.length > 0) {
        parts.push(`tagged ${filters.tags.join(', ')}`);
    }
    if (filters.is_read === true) parts.push('read');
    if (filters.is_read === false) parts.push('unread');
    if (filters.is_bookmarked) parts.push('bookmarked');
    if (filters.has_video) parts.push('with video');
    if (filters.has_audio) parts.push('with audio');
    if (filters.type) parts.push(filters.type);
    if (filters.date_from || filters.date_to) {
        const from = filters.date_from ? new Date(filters.date_from).toLocaleDateString() : 'start';
        const to = filters.date_to ? new Date(filters.date_to).toLocaleDateString() : 'now';
        parts.push(`${from} to ${to}`);
    }

    return parts.join(' • ') || 'No filters';
}
