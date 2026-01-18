import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Feed, Folder, SmartFolder, Article, ArticleDetail, Settings } from '@/services/api';
import { enableSync, applySyncChanges, SyncChanges } from '@/lib/sync';
import { handleError } from '@/services/errorHandler';

// Feed Store
interface FeedState {
    feeds: Feed[];
    folders: Folder[];
    smartFolders: SmartFolder[];
    totalUnread: number;
    isLoading: boolean;
    refreshProgress: { total: number; completed: number; currentTitle: string } | null;

    fetchFeeds: () => Promise<void>;
    fetchFolders: () => Promise<void>;
    addFeed: (url: string, folderId?: number, refreshInterval?: number) => Promise<Feed>;
    deleteFeed: (id: number) => Promise<void>;
    deleteFolder: (id: number) => Promise<void>;
    refreshFeed: (id: number) => Promise<number>;
    refreshAllFeeds: (ids?: number[]) => Promise<void>;
    updateLocalFeed: (id: number, updates: Partial<Feed>) => void;
    applySyncChanges: (changes: SyncChanges) => void;
}

export const useFeedStore = create<FeedState>()(
    persist(
        (set, get) => ({
            feeds: [],
            folders: [],
            smartFolders: [],
            totalUnread: 0,
            isLoading: false,
            refreshProgress: null,

            fetchFeeds: async () => {
                set({ isLoading: true });
                try {
                    const { feeds } = await api.getFeeds();
                    set({ feeds, isLoading: false });
                } catch (error) {
                    handleError(error, { context: 'fetchFeeds', showToast: false });
                    set({ isLoading: false });
                }
            },

            fetchFolders: async () => {
                set({ isLoading: true });
                try {
                    const { folders, smart_folders, totals } = await api.getFolders();
                    set({ folders, smartFolders: smart_folders, totalUnread: totals.all_unread, isLoading: false });
                } catch (error) {
                    handleError(error, { context: 'fetchFolders', showToast: false });
                    set({ isLoading: false });
                }
            },

            addFeed: async (url: string, folderId?: number, refreshInterval?: number) => {
                const result = await api.addFeed(url, folderId, true, refreshInterval);
                set((state: FeedState) => ({ feeds: [...state.feeds, result.feed] }));
                return result.feed;
            },

            deleteFeed: async (id) => {
                await api.deleteFeed(id);
                set((state) => ({ feeds: state.feeds.filter((f) => f.id !== id) }));
                // Refresh folders to update counts
                get().fetchFolders();
            },

            deleteFolder: async (id) => {
                try {
                    await api.deleteFolder(id);
                    // Refetch both feeds and folders after deletion
                    await get().fetchFolders();
                    await get().fetchFeeds();
                } catch (error) {
                    handleError(error, { context: 'deleteFolder', fallbackMessage: 'Failed to delete folder' });
                }
            },

            refreshFeed: async (id) => {
                try {
                    const result = await api.refreshFeed(id);
                    get().fetchFeeds();
                    return result.new_articles;
                } catch (error) {
                    handleError(error, { context: 'refreshFeed', fallbackMessage: 'Failed to refresh feed' });
                    throw error;
                }
            },

            refreshAllFeeds: async (ids) => {
                set({ isLoading: true });
                let hasNewArticles = false;
                const articleStore = useArticleStore.getState();

                // Debounced article fetch to avoid hammering the server during rapid updates
                let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
                const debouncedRefresh = () => {
                    if (refreshTimeout) clearTimeout(refreshTimeout);
                    refreshTimeout = setTimeout(() => {
                        articleStore.fetchArticles(true);
                    }, 1000); // Wait at least 1s between refreshes
                };

                try {
                    await api.refreshFeedsWithProgress(
                        ids,
                        (event) => {
                            if (event.type === 'start') {
                                set({ refreshProgress: { total: event.total_feeds, completed: 0, currentTitle: '' } });
                            } else if (event.type === 'feed_refreshing') {
                                set((state) => ({
                                    refreshProgress: state.refreshProgress ? { ...state.refreshProgress, currentTitle: event.title } : null
                                }));
                            } else if (event.type === 'feed_complete' || event.type === 'feed_error') {
                                if (event.type === 'feed_complete' && event.new_articles > 0) {
                                    hasNewArticles = true;
                                    debouncedRefresh();
                                }

                                set((state) => ({
                                    refreshProgress: state.refreshProgress ? {
                                        ...state.refreshProgress,
                                        completed: state.refreshProgress.completed + 1
                                    } : null,
                                    feeds: state.feeds.map(f =>
                                        f.id === (event as any).id
                                            ? {
                                                ...f,
                                                unread_count: event.type === 'feed_complete' ? (f.unread_count || 0) + event.new_articles : f.unread_count,
                                                last_fetched_at: new Date().toISOString(),
                                                next_fetch_at: event.type === 'feed_complete' ? event.next_fetch_at || f.next_fetch_at : f.next_fetch_at
                                            }
                                            : f
                                    )
                                }));
                            }
                        },
                        (error) => {
                            handleError(error, { context: 'refreshFeedsProgress', showToast: true });
                        }
                    );

                    // Final fetch to ensure everything is in sync
                    if (refreshTimeout) clearTimeout(refreshTimeout);
                    await Promise.all([
                        get().fetchFeeds(),
                        get().fetchFolders(),
                        articleStore.fetchArticles(true)
                    ]);
                } catch (error) {
                    handleError(error, { context: 'refreshAllFeeds' });
                } finally {
                    set({ isLoading: false, refreshProgress: null });
                }
            },

            updateLocalFeed: (id, updates) => {
                set((state) => ({
                    feeds: state.feeds.map((f) => (f.id === id ? { ...f, ...updates } : f)),
                }));
            },

            applySyncChanges: (changes: SyncChanges) => {
                const syncData = applySyncChanges(changes);
                set((state) => {
                    let newFeeds = [...state.feeds];
                    let newFolders = [...state.folders];

                    // Apply feed changes
                    if (syncData.feedsDeleted.length > 0) {
                        newFeeds = newFeeds.filter((f) => !syncData.feedsDeleted.includes(f.id));
                    }
                    if (syncData.feedsCreated.length > 0) {
                        const existingIds = new Set(newFeeds.map((f) => f.id));
                        syncData.feedsCreated.forEach((feed: Feed) => {
                            if (!existingIds.has(feed.id)) {
                                newFeeds.push(feed);
                            }
                        });
                    }
                    if (syncData.feedsUpdated.length > 0) {
                        const updatedMap = new Map(syncData.feedsUpdated.map((f: Feed) => [f.id, f]));
                        newFeeds = newFeeds.map((f) => updatedMap.get(f.id) || f);
                    }

                    // Apply folder changes
                    if (syncData.foldersDeleted.length > 0) {
                        newFolders = newFolders.filter((f) => !syncData.foldersDeleted.includes(f.id));
                    }
                    if (syncData.foldersCreated.length > 0) {
                        const existingIds = new Set(newFolders.map((f) => f.id));
                        syncData.foldersCreated.forEach((folder: Folder) => {
                            if (!existingIds.has(folder.id)) {
                                newFolders.push(folder);
                            }
                        });
                    }
                    if (syncData.foldersUpdated.length > 0) {
                        const updatedMap = new Map(syncData.foldersUpdated.map((f: Folder) => [f.id, f]));
                        newFolders = newFolders.map((f) => updatedMap.get(f.id) || f);
                    }

                    return { feeds: newFeeds, folders: newFolders };
                });
            },
        }),
        {
            name: 'feeds-list',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: FeedState) => ({
                feeds: state.feeds,
                folders: state.folders,
                smartFolders: state.smartFolders,
                totalUnread: state.totalUnread
            }),
        }
    )
);

// Article Store
interface ArticleState {
    articles: Article[];
    bookmarkedArticles: Article[];
    currentArticle: ArticleDetail | null;
    cursor: string | null;
    hasMore: boolean;
    isLoading: boolean;
    error: string | null;
    filter: {
        feed_id?: number;
        folder_id?: number;
        type?: string;
        unread_only: boolean;
    };

    setFilter: (filter: Partial<ArticleState['filter']>) => void;
    fetchArticles: (reset?: boolean) => Promise<void>;
    fetchBookmarks: () => Promise<void>;
    fetchArticle: (id: number) => Promise<void>;
    markRead: (id: number) => Promise<void>;
    markUnread: (id: number) => Promise<void>;
    markAllRead: (scope: 'feed' | 'folder' | 'type' | 'all', scopeId?: number, type?: string) => Promise<void>;
    toggleBookmark: (id: number) => Promise<void>;
    clearError: () => void;
    applySyncChanges: (changes: SyncChanges) => void;
}

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
                }));
                get().fetchArticles(true);
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

            fetchArticle: async (id) => {
                try {
                    const { article } = await api.getArticle(id);
                    set({ currentArticle: article });
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
            }),
        }
    )
);

// Settings Store
interface SettingsState {
    settings: Settings | null;
    isLoading: boolean;

    fetchSettings: () => Promise<void>;
    updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            settings: null,
            isLoading: false,

            fetchSettings: async () => {
                set({ isLoading: true });
                try {
                    const { settings } = await api.getSettings();
                    set({ settings, isLoading: false });
                } catch (error) {
                    // For mobile PWA: network issues are common, use fallback settings
                    // but show error so user knows sync failed
                    const fallbackSettings: Settings = {
                        refresh_interval_minutes: 30,
                        retention_days: 90,
                        fetch_full_content: false,
                        readability_enabled: false,
                        theme: 'auto',
                        font_size: 'medium',
                        show_images: true,
                    };
                    set({ settings: fallbackSettings, isLoading: false });
                    handleError(error, { context: 'fetchSettings', fallbackMessage: 'Using offline settings' });
                }
            },

            updateSettings: async (updates: Partial<Settings>) => {
                const { settings } = await api.updateSettings(updates);
                set({ settings });
            },
        }),
        {
            name: 'feeds-settings',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: SettingsState) => ({
                settings: state.settings,
            }),
        }
    )
);

// Digest Store
interface DigestStore {
    latestDigest: any | null;
    settings: any | null;
    isLoading: boolean;
    error: string | null;

    fetchLatestDigest: () => Promise<void>;
    generateDigest: () => Promise<void>;
    fetchSettings: () => Promise<void>;
    updateSettings: (updates: any) => Promise<void>;
}

export const useDigestStore = create<DigestStore>()(
    persist(
        (set, get) => ({
            latestDigest: null,
            settings: null,
            isLoading: false,
            error: null,

            fetchLatestDigest: async () => {
                set({ isLoading: true, error: null });
                try {
                    const { digest } = await api.getLatestDigest();
                    set({ latestDigest: digest, isLoading: false });
                } catch (error) {
                    handleError(error, { context: 'fetchLatestDigest', showToast: false });
                    set({ isLoading: false });
                }
            },

            generateDigest: async () => {
                set({ isLoading: true, error: null });
                try {
                    const { digest } = await api.generateDigest();
                    set({ latestDigest: digest, isLoading: false });
                    useToastStore.getState().show('Digest generated successfully!', 'success');
                } catch (error) {
                    const parsed = handleError(error, { context: 'generateDigest' });
                    set({ isLoading: false, error: parsed.message });
                }
            },

            fetchSettings: async () => {
                try {
                    const { settings } = await api.getDigestSettings();
                    set({ settings });
                } catch (error) {
                    handleError(error, { context: 'fetchDigestSettings', showToast: false });
                }
            },

            updateSettings: async (updates) => {
                try {
                    await api.updateDigestSettings(updates);
                    set((state) => ({ settings: { ...state.settings, ...updates } }));
                    useToastStore.getState().show('Settings saved', 'success');
                } catch (error) {
                    handleError(error, { context: 'updateDigestSettings' });
                }
            },
        }),
        {
            name: 'feeds-digest',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

// Toast Store
interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ToastState {
    toasts: ToastMessage[];
    show: (message: string, type?: ToastMessage['type']) => void;
    hide: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    show: (message: string, type: ToastMessage['type'] = 'info') => {
        const id = Math.random().toString(36).substring(7);
        set((state: ToastState) => ({
            toasts: [...state.toasts, { id, message, type }],
        }));
        setTimeout(() => {
            set((state: ToastState) => ({
                toasts: state.toasts.filter((t: ToastMessage) => t.id !== id),
            }));
        }, 3000);
    },
    hide: (id: string) => {
        set((state: ToastState) => ({
            toasts: state.toasts.filter((t: ToastMessage) => t.id !== id),
        }));
    },
}));

/**
 * Initialize background sync for all stores.
 * Call this on app start to enable periodic sync.
 */
let syncCleanup: (() => void) | null = null;

export function initializeSync(): void {
    if (syncCleanup) {
        return; // Already initialized
    }

    syncCleanup = enableSync((changes: SyncChanges) => {
        // Apply sync changes to all stores
        useFeedStore.getState().applySyncChanges(changes);
        useArticleStore.getState().applySyncChanges(changes);
    });
}

/**
 * Stop background sync.
 */
export function stopSync(): void {
    if (syncCleanup) {
        syncCleanup();
        syncCleanup = null;
    }
}

