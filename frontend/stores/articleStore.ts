import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api, Article, ArticleDetail } from "@/services/api";
import { applySyncChanges, SyncChanges } from "@/lib/sync";
import { handleError } from "@/services/errorHandler";
import { sortArticlesByDateAndId } from "@/utils/sorting";
import { ArticleState } from "./types";
import { safeAsyncStorage } from "@/lib/safeStorage";

function areArticlesEqual(left: Article, right: Article): boolean {
  const leftKeys = Object.keys(left) as (keyof Article)[];
  const rightKeys = Object.keys(right) as (keyof Article)[];

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }

  return true;
}

function mergeArticleRecord(
  existingArticle: Article | undefined,
  incomingArticle: Article,
): Article {
  if (!existingArticle) {
    return incomingArticle;
  }

  return areArticlesEqual(existingArticle, incomingArticle)
    ? existingArticle
    : { ...existingArticle, ...incomingArticle };
}

function updateArticlesInList(
  articles: Article[],
  shouldUpdate: (article: Article) => boolean,
  updater: (article: Article) => Article,
): Article[] {
  let changed = false;

  const nextArticles = articles.map((article) => {
    if (!shouldUpdate(article)) {
      return article;
    }

    const updatedArticle = updater(article);
    if (updatedArticle !== article) {
      changed = true;
    }

    return updatedArticle;
  });

  return changed ? nextArticles : articles;
}

function mergeSortedArticles(existingArticles: Article[], incomingArticles: Article[]): Article[] {
  if (incomingArticles.length === 0) {
    return existingArticles;
  }

  const merged = new Map(existingArticles.map((article) => [article.id, article]));
  incomingArticles.forEach((article) => {
    merged.set(article.id, mergeArticleRecord(merged.get(article.id), article));
  });

  const sortedArticles = sortArticlesByDateAndId(Array.from(merged.values()));
  const hasChanged =
    sortedArticles.length !== existingArticles.length ||
    sortedArticles.some((article, index) => article !== existingArticles[index]);

  return hasChanged ? sortedArticles : existingArticles;
}

export const useArticleStore = create<ArticleState>()(
  persist(
    (set, get) => ({
      articles: [],
      bookmarkedArticles: [],
      bookmarkFolders: [],
      currentArticle: null,
      cursor: null,
      hasMore: true,
      isLoading: false,
      error: null,
      scrollPosition: 0,
      articleScrollPositions: {},
      timelineScrollSnapshots: {},
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

      setTimelineScrollSnapshot: (key, snapshot) => {
        set((state) => ({
          timelineScrollSnapshots: {
            ...state.timelineScrollSnapshots,
            [key]: snapshot,
          },
        }));
      },

      getTimelineScrollSnapshot: (key) => {
        return (
          get().timelineScrollSnapshots[key] || {
            absoluteOffset: 0,
            anchorArticleId: null,
            restoreArticleId: null,
            restoreFallbackArticleId: null,
          }
        );
      },

      clearTimelineScrollSnapshots: () => {
        set({ timelineScrollSnapshots: {} });
      },

      fetchArticles: async (
        reset = false,
        isLiveUpdate = false,
        skipLoadingSet = false,
      ) => {
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
            finalArticles = mergeSortedArticles(state.articles, articles);

            if (finalArticles.length === state.articles.length) {
              set({ isLoading: false });
              return;
            }
          } else {
            finalArticles = mergeSortedArticles(state.articles, articles);
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
            context: "fetchArticles",
            fallbackMessage: "Failed to fetch articles",
          });
          set({
            isLoading: false,
            error: parsedError.message,
          });
        }
      },

      fetchBookmarks: async (params = {}) => {
        set({ isLoading: true, error: null });
        try {
          const { articles, folders } = await api.getBookmarks(params);
          set({ bookmarkedArticles: articles, bookmarkFolders: folders, isLoading: false, error: null });
        } catch (error) {
          const parsedError = handleError(error, {
            context: "fetchBookmarks",
            fallbackMessage: "Failed to fetch bookmarks",
          });
          set({ isLoading: false, error: parsedError.userMessage });
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
            articles: updateArticlesInList(
              state.articles,
              (article) => article.id === id && !article.is_read,
              (article) => ({ ...article, is_read: true }),
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
              const keysToRemove = cacheKeys.slice(
                0,
                cacheKeys.length - MAX_CACHE_SIZE,
              );
              keysToRemove.forEach((key) => delete newCache[parseInt(key)]);
            }

            return {
              currentArticle: article,
              contentCache: newCache,
            };
          });
        } catch (error) {
          handleError(error, { context: "fetchArticle", showToast: false });
          // Try to find in existing articles list
          const found = get().articles.find((a) => a.id === id);
          if (found)
            set({
              currentArticle: {
                ...found,
                content: null,
                readability_content: null,
                enclosure_type: null,
              },
            });
        }

        // Update in list too
        set((state) => ({
          articles: updateArticlesInList(
            state.articles,
            (article) => article.id === id && !article.is_read,
            (article) => ({ ...article, is_read: true }),
          ),
        }));
      },

      prefetchArticle: async (id) => {
        const state = get();
        if (state.contentCache[id]) return; // Already cached

        try {
          const { article } = await api.getArticle(id);
          set((state) => ({
            contentCache: { ...state.contentCache, [id]: article },
          }));
        } catch {
          // Silent fail for prefetch
        }
      },

      markRead: async (id) => {
        try {
          await api.markArticleRead(id);
        } catch {
          /* ignore offline and hope for sync later */
        }
        set((state) => ({
          articles: updateArticlesInList(
            state.articles,
            (article) => article.id === id && !article.is_read,
            (article) => ({ ...article, is_read: true }),
          ),
        }));
      },

      markUnread: async (id) => {
        try {
          await api.markArticleUnread(id);
        } catch {
          /* ignore */
        }
        set((state) => ({
          articles: updateArticlesInList(
            state.articles,
            (article) => article.id === id && article.is_read,
            (article) => ({ ...article, is_read: false }),
          ),
        }));
      },

      markAllRead: async (scope, scopeId, type) => {
        await api.markArticlesRead({ scope, scope_id: scopeId, type });
        get().fetchArticles(true);
        // Dynamic import to avoid circular dependency
        const { useFeedStore } = require("./feedStore");
        useFeedStore.getState().fetchFolders();
        useFeedStore.getState().fetchFeeds();
      },

      toggleBookmark: async (id) => {
        const state = get();
        const article =
          state.articles.find((a) => a.id === id) ||
          (state.currentArticle?.id === id ? state.currentArticle : null) ||
          state.bookmarkedArticles.find((a) => a.id === id);

        if (!article) return;

        const newStatus = !article.is_bookmarked;

        const updateBookmarkState = (bookmarked: boolean) => {
          set((state) => {
            const newBookmarks = bookmarked
              ? state.bookmarkedArticles.some((b) => b.id === id)
                ? state.bookmarkedArticles
                : [
                    { ...article, is_bookmarked: true },
                    ...state.bookmarkedArticles,
                  ]
              : state.bookmarkedArticles.filter((b) => b.id !== id);

            return {
              articles: updateArticlesInList(
                state.articles,
                (existingArticle) =>
                  existingArticle.id === id &&
                  existingArticle.is_bookmarked !== bookmarked,
                (existingArticle) => ({
                  ...existingArticle,
                  is_bookmarked: bookmarked,
                }),
              ),
              currentArticle:
                state.currentArticle?.id === id
                  ? { ...state.currentArticle, is_bookmarked: bookmarked }
                  : state.currentArticle,
              bookmarkedArticles: newBookmarks,
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
        if (updates.feed_title !== undefined)
          patch.feed_title = updates.feed_title;
        if (updates.feed_icon_url !== undefined)
          patch.feed_icon_url = updates.feed_icon_url;
        if (updates.feed_type !== undefined)
          patch.feed_type = updates.feed_type;

        if (Object.keys(patch).length === 0) return;

        const updateArticle = <T extends Article>(article: T): T => {
          if (article.feed_id !== feedId) return article;
          const nextArticle = { ...article, ...patch };
          return areArticlesEqual(article, nextArticle) ? article : nextArticle;
        };

        set((state) => {
          const updatedCache: Record<number, ArticleDetail> = {};
          Object.entries(state.contentCache).forEach(([id, article]) => {
            const updated = updateArticle(article);
            updatedCache[Number(id)] = updated;
          });

          const updatedCurrent =
            state.currentArticle && state.currentArticle.feed_id === feedId
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
            newArticles = updateArticlesInList(
              newArticles,
              (article) =>
                readMap.has(article.id) &&
                article.is_read !== (readMap.get(article.id) ?? article.is_read),
              (article) => ({
                ...article,
                is_read: readMap.get(article.id) ?? article.is_read,
              }),
            );

            if (state.filter.unread_only) {
              newArticles = newArticles.filter((a) => !readMap.get(a.id));
            }
          }

          if (changes.articles?.deleted?.length) {
            const deletedIds = new Set(changes.articles.deleted);
            newArticles = newArticles.filter((article) => !deletedIds.has(article.id));
          }

          if (changes.articles?.updated?.length) {
            const updatedArticles = changes.articles.updated as Article[];
            const filteredUpdates = updatedArticles.filter((article) => {
              if (state.filter.unread_only && article.is_read) return false;
              if (state.filter.feed_id && article.feed_id !== state.filter.feed_id) return false;
              if (state.filter.type && article.feed_type !== state.filter.type) return false;

              return true;
            });

            newArticles = mergeSortedArticles(newArticles, filteredUpdates);
          }

          // Prepend newly created articles if they match filters
          if (syncData.articlesCreated.length > 0) {
            const addedArticles = (
              syncData.articlesCreated as Article[]
            ).filter((a) => {
              // Apply filters
              if (state.filter.unread_only && a.is_read) return false;
              if (state.filter.feed_id && a.feed_id !== state.filter.feed_id)
                return false;
              if (state.filter.type && a.feed_type !== state.filter.type)
                return false;
              // Note: folder filtering is harder check here because folder_id isn't on article
              // For simplicity, we skip folder check or let it be handled by next full fetch

              return true;
            });

            if (addedArticles.length > 0) {
              newArticles = mergeSortedArticles(newArticles, addedArticles);
            }
          }

          return { articles: newArticles };
        });
      },
    }),
    {
      name: "articles-cache",
      storage: createJSONStorage(() => safeAsyncStorage),
      partialize: (state: ArticleState) => ({
        articles: state.articles.slice(0, 100), // Only cache the first 100 articles
        filter: state.filter,
        bookmarkedArticles: state.bookmarkedArticles, // Cache bookmarks too
        articleScrollPositions: state.articleScrollPositions, // Persist scroll positions
        timelineScrollSnapshots: state.timelineScrollSnapshots,
        // contentCache is deliberately excluded to keep storage light and fresh
      }),
    },
  ),
);
