import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Article, ArticleDetail } from '@/services/api';
import { applySyncChanges, SyncChanges } from '@/lib/sync';
import { handleError } from '@/services/errorHandler';
import { ArticleState } from './types';
import { FeedState } from './types';

export const useArticleStore = create<ArticleState>()(
    persist(
        (set, get) => ({
            articles: [],
            bookmarkedArticles: [],
            currentArticle: null,
            cursor: null,
            hasMore: true,
            isLoading: false,
            error: null,
            scrollPosition: 0,
            filter: {
                unread_only: true,
            },

            setFilter: (newFilter) => {
                set((state) => ({
                    filter: { ...state.filter, ...newFilter },
                    articles: [],
                    cursor: null,
                    hasMore: true,
                    error: null,
                    scrollPosition: 0,
                }));
                get().fetchArticles(true);
            },

            setScrollPosition: (position) => {
                set({ scrollPosition: position });
            },

            fetchArticles: async (reset = false) => {
                const state = get();
                if (state.isLoading || (!reset && !state.hasMore)) return;

                set({ isLoading: true, error: null });
                try {
                    const { articles, next_cursor } = await api.getArticles({
                        ...state.filter,
                        cursor: reset ? undefined : state.cursor || undefined,
                        limit: 50,
                    });

                    const newArticles = reset ? articles : [...state.articles, ...articles];

                    // Deduplicate and sort
                    const uniqueArticles = Array.from(new Map(newArticles.map(a => [a.id, a])).values());
                    uniqueArticles.sort((a, b) => {
                        const dateA = new Date(a.published_at || 0).getTime();
                        const dateB = new Date(b.published_at || 0).getTime();
                        if (dateA !== dateB) return dateB - dateA;
                        return b.id - a.id; // Secondary sort by ID desc
                    });

                    set({
                        articles: uniqueArticles,
                        cursor: next_cursor,
                        hasMore: next_cursor !== null,
                        isLoading: false,
                        error: null,
                    });
                } catch (error) {
                    const parsedError = handleError(error, {
                        context: 'fetchArticles',
                        fallbackMessage: 'Failed to fetch articles',
                    });
                    set({
                        isLoading: false,
                        error: parsedError.message,
                    });
                }
            },

            fetchBookmarks: async () => {
                try {
                    const { articles } = await api.getBookmarks();
                    set({ bookmarkedArticles: articles });
                } catch (error) {
                    handleError(error, { context: 'fetchBookmarks', fallbackMessage: 'Failed to fetch bookmarks' });
                }
            },

            contentCache: {},

            fetchArticle: async (id) => {
                const state = get();

                // Check cache first
                if (state.contentCache[id]) {
                    set({ currentArticle: state.contentCache[id] });
                    // Still mark as read
                    set((state) => ({
                        articles: state.articles.map((a) =>
                            a.id === id ? { ...a, is_read: true } : a
                        ),
                    }));
                    return;
                }

                try {
                    const { article } = await api.getArticle(id);

                    // LRU cache eviction: limit cache to 50 most recent articles
                    set((state) => {
                        const newCache = { ...state.contentCache, [id]: article };
                        const cacheKeys = Object.keys(newCache);

                        // Evict oldest entries if cache exceeds limit
                        const MAX_CACHE_SIZE = 50;
                        if (cacheKeys.length > MAX_CACHE_SIZE) {
                            // Remove oldest entries (keep most recent 50)
                            // In a true LRU, we'd track access time, but for simplicity we just limit size
                            const keysToRemove = cacheKeys.slice(0, cacheKeys.length - MAX_CACHE_SIZE);
                            keysToRemove.forEach(key => delete newCache[parseInt(key)]);
                        }

                        return {
                            currentArticle: article,
                            contentCache: newCache
                        };
                    });
                } catch (error) {
                    handleError(error, { context: 'fetchArticle', showToast: false });
                    // Try to find in existing articles list
                    const found = get().articles.find(a => a.id === id);
                    if (found) set({ currentArticle: { ...found, content: null, readability_content: null, enclosure_type: null } });
                }

                // Update in list too
                set((state) => ({
                    articles: state.articles.map((a) =>
                        a.id === id ? { ...a, is_read: true } : a
                    ),
                }));
            },

            prefetchArticle: async (id) => {
                const state = get();
                if (state.contentCache[id]) return; // Already cached

                try {
                    const { article } = await api.getArticle(id);
                    set((state) => ({
                        contentCache: { ...state.contentCache, [id]: article }
                    }));
                } catch (e) {
                    // Silent fail for prefetch
                }
            },

            markRead: async (id) => {
                try {
                    await api.markArticleRead(id);
                } catch (e) { /* ignore offline and hope for sync later */ }
                set((state) => ({
                    articles: state.articles.map((a) =>
                        a.id === id ? { ...a, is_read: true } : a
                    ),
                }));
            },

            markUnread: async (id) => {
                try {
                    await api.markArticleUnread(id);
                } catch (e) { /* ignore */ }
                set((state) => ({
                    articles: state.articles.map((a) =>
                        a.id === id ? { ...a, is_read: false } : a
                    ),
                }));
            },

            markAllRead: async (scope, scopeId, type) => {
                await api.markArticlesRead({ scope, scope_id: scopeId, type });
                get().fetchArticles(true);
                // Dynamic import to avoid circular dependency
                const { useFeedStore } = require('./feedStore');
                useFeedStore.getState().fetchFolders();
                useFeedStore.getState().fetchFeeds();
            },

            toggleBookmark: async (id) => {
                const state = get();
                const article = state.articles.find(a => a.id === id) ||
                    (state.currentArticle?.id === id ? state.currentArticle : null) ||
                    state.bookmarkedArticles.find(a => a.id === id);

                if (!article) return;

                const newStatus = !article.is_bookmarked;

                const updateBookmarkState = (bookmarked: boolean) => {
                    set((state) => {
                        const newBookmarks = bookmarked
                            ? (state.bookmarkedArticles.some(b => b.id === id)
                                ? state.bookmarkedArticles
                                : [{ ...article, is_bookmarked: true }, ...state.bookmarkedArticles])
                            : state.bookmarkedArticles.filter(b => b.id !== id);

                        return {
                            articles: state.articles.map(a => a.id === id ? { ...a, is_bookmarked: bookmarked } : a),
                            currentArticle: state.currentArticle?.id === id
                                ? { ...state.currentArticle, is_bookmarked: bookmarked }
                                : state.currentArticle,
                            bookmarkedArticles: newBookmarks
                        };
                    });
                };

                updateBookmarkState(newStatus);

                try {
                    await api.bookmarkArticle(id, newStatus);
                } catch {
                    updateBookmarkState(!newStatus);
                }
            },

            clearError: () => {
                set({ error: null });
            },

            applySyncChanges: (changes: SyncChanges) => {
                const syncData = applySyncChanges(changes);
                set((state) => {
                    const newArticles = [...state.articles];
                    const readMap = new Map<number, boolean>();

                    // Build read state map from sync changes
                    syncData.readStateRead.forEach((id) => readMap.set(id, true));
                    syncData.readStateUnread.forEach((id) => readMap.set(id, false));

                    // Apply read state changes to existing articles
                    if (readMap.size > 0) {
                        return {
                            articles: newArticles.map((a) =>
                                readMap.has(a.id) ? { ...a, is_read: readMap.get(a.id) ?? a.is_read } : a
                            ),
                        };
                    }

                    // Note: New articles from sync are not added to the current list
                    // to avoid duplicates and maintain pagination integrity.
                    // They will be fetched on the next refresh.
                    return state;
                });
            },
        }),
        {
            name: 'articles-cache',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: ArticleState) => ({
                articles: state.articles.slice(0, 100), // Only cache the first 100 articles
                cursor: state.cursor,
                filter: state.filter,
                bookmarkedArticles: state.bookmarkedArticles // Cache bookmarks too
                // contentCache is deliberately excluded to keep storage light and fresh
            }),
        }
    )
);
