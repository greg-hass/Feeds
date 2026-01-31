import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Article, ArticleDetail } from '@/services/api';
import { applySyncChanges, SyncChanges } from '@/lib/sync';
import { handleError } from '@/services/errorHandler';
import { sortArticlesByDateAndId } from '@/utils/sorting';
import { ArticleState } from './types';


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
            articleScrollPositions: {},
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
                    isLoading: true,
                }));
                get().fetchArticles(true, false, true);
            },

            setScrollPosition: (position) => {
                set({ scrollPosition: position });
            },

            setArticleScrollPosition: (articleId, position) => {
                set((state) => ({
                    articleScrollPositions: {
                        ...state.articleScrollPositions,
                        [articleId]: position,
                    },
                }));
            },

            getArticleScrollPosition: (articleId) => {
                return get().articleScrollPositions[articleId] || 0;
            },

            fetchArticles: async (reset = false, isLiveUpdate = false, skipLoadingSet = false) => {
                const state = get();
                if (state.isLoading && !isLiveUpdate && !reset) return;
                if (!reset && !state.hasMore && !isLiveUpdate) return;

                if (!isLiveUpdate && !skipLoadingSet) {
                    set({ isLoading: true, error: null });
                }
                try {
                    const { articles, next_cursor } = await api.getArticles({
                        ...state.filter,
                        cursor: reset ? undefined : state.cursor || undefined,
                        limit: 50,
                    });

                        // Optimized: Incremental merge instead of full sort on every fetch
                    let finalArticles: Article[];

                    if (reset && !isLiveUpdate) {
                        // On reset, just use new articles (already sorted from backend)
                        finalArticles = articles;
                    } else if (isLiveUpdate) {
                        // Live update: Prepend ONLY truly new articles (those with higher IDs or newer dates than our top one)
                        // This prevents duplicating articles the user is already looking at
                        const existingIds = new Set(state.articles.map(a => a.id));
                        const trulyNew = articles.filter(a => !existingIds.has(a.id));

                        if (trulyNew.length === 0) {
                            set({ isLoading: false });
                            return;
                        }

                        // Combine and re-sort just in case, though backend usually handles it
                        finalArticles = sortArticlesByDateAndId([...trulyNew, ...state.articles]);
                    } else {
                        // Merge new articles into existing sorted list
                        // Backend returns sorted articles, so we can do efficient merge
                        const existingMap = new Map(state.articles.map(a => [a.id, a]));
                        const newMap = new Map(articles.map(a => [a.id, a]));

                        // Deduplicate: prefer new data over existing
                        for (const [id, article] of newMap) {
                            existingMap.set(id, article);
                        }

                        // Only sort if we actually have duplicates (rare case)
                        if (newMap.size < articles.length || existingMap.size !== state.articles.length + articles.length) {
                            // Had duplicates, need to sort
                            finalArticles = sortArticlesByDateAndId(Array.from(existingMap.values()));
                        } else {
                            // No duplicates, just concatenate (backend already sorted)
                            finalArticles = [...state.articles, ...articles];
                        }
                    }

                    set({
                        articles: finalArticles,
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
                } catch {
                    // Silent fail for prefetch
                }
            },

            markRead: async (id) => {
                try {
                    await api.markArticleRead(id);
                } catch { /* ignore offline and hope for sync later */ }
                set((state) => ({
                    articles: state.articles.map((a) =>
                        a.id === id ? { ...a, is_read: true } : a
                    ),
                }));
            },

            markUnread: async (id) => {
                try {
                    await api.markArticleUnread(id);
                } catch { /* ignore */ }
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

            updateFeedMetadata: (feedId, updates) => {
                const patch: Partial<Article> = {};
                if (updates.feed_title !== undefined) patch.feed_title = updates.feed_title;
                if (updates.feed_icon_url !== undefined) patch.feed_icon_url = updates.feed_icon_url;
                if (updates.feed_type !== undefined) patch.feed_type = updates.feed_type;

                if (Object.keys(patch).length === 0) return;

                const updateArticle = <T extends Article>(article: T): T => {
                    if (article.feed_id !== feedId) return article;
                    return { ...article, ...patch };
                };

                set((state) => {
                    const updatedCache: Record<number, ArticleDetail> = {};
                    Object.entries(state.contentCache).forEach(([id, article]) => {
                        const updated = updateArticle(article);
                        updatedCache[Number(id)] = updated;
                    });

                    const updatedCurrent = state.currentArticle && state.currentArticle.feed_id === feedId
                        ? { ...state.currentArticle, ...patch }
                        : state.currentArticle;

                    return {
                        articles: state.articles.map(updateArticle),
                        bookmarkedArticles: state.bookmarkedArticles.map(updateArticle),
                        currentArticle: updatedCurrent,
                        contentCache: updatedCache,
                    };
                });
            },

            clearError: () => {
                set({ error: null });
            },

            applySyncChanges: (changes: SyncChanges) => {
                const syncData = applySyncChanges(changes);
                set((state) => {
                    let newArticles = [...state.articles];
                    const readMap = new Map<number, boolean>();

                    // Build read state map from sync changes
                    syncData.readStateRead.forEach((id) => readMap.set(id, true));
                    syncData.readStateUnread.forEach((id) => readMap.set(id, false));

                    // Apply read state changes and filter out newly read articles if unread_only is on
                    if (readMap.size > 0) {
                        newArticles = newArticles.map((a) =>
                            readMap.has(a.id) ? { ...a, is_read: readMap.get(a.id) ?? a.is_read } : a
                        );

                        if (state.filter.unread_only) {
                            newArticles = newArticles.filter(a => !readMap.get(a.id));
                        }
                    }

                    // Prepend newly created articles if they match filters
                    if (syncData.articlesCreated.length > 0) {
                        const existingIds = new Set(newArticles.map((a) => a.id));
                        const addedArticles = (syncData.articlesCreated as Article[]).filter((a) => {
                            if (existingIds.has(a.id)) return false;

                            // Apply filters
                            if (state.filter.unread_only && a.is_read) return false;
                            if (state.filter.feed_id && a.feed_id !== state.filter.feed_id) return false;
                            if (state.filter.type && a.feed_type !== state.filter.type) return false;
                            // Note: folder filtering is harder check here because folder_id isn't on article
                            // For simplicity, we skip folder check or let it be handled by next full fetch

                            return true;
                        });

                        if (addedArticles.length > 0) {
                            newArticles = [...addedArticles, ...newArticles];
                            // Sort by date then ID
                            newArticles = sortArticlesByDateAndId(newArticles);
                        }
                    }

                    return { articles: newArticles };
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
                bookmarkedArticles: state.bookmarkedArticles, // Cache bookmarks too
                articleScrollPositions: state.articleScrollPositions, // Persist scroll positions
                // contentCache is deliberately excluded to keep storage light and fresh
            }),
        }
    )
);
