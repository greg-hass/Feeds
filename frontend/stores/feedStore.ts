import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Feed, Folder } from '@/services/api';
import { applySyncChanges, SyncChanges, fetchChanges } from '@/lib/sync';
import { handleError } from '@/services/errorHandler';
import { useArticleStore } from './articleStore';
import { FeedState } from './types';

let refreshAbortController: AbortController | null = null;

const isAbortError = (error: unknown) =>
    error instanceof Error && error.name === 'AbortError';

export const useFeedStore = create<FeedState>()(
    persist(
        (set, get) => ({
            feeds: [],
            folders: [],
            smartFolders: [],
            totalUnread: 0,
            isLoading: false,
            isBackgroundRefreshing: false,
            refreshProgress: null,
            lastRefreshNewArticles: null,

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

            addFeed: async (url: string, folderId?: number, refreshInterval?: number, discover: boolean = true) => {
                const result = await api.addFeed(url, folderId, discover, refreshInterval);
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
                    const syncResult = await fetchChanges();
                    if (syncResult) {
                        get().applySyncChanges(syncResult.changes);
                        useArticleStore.getState().applySyncChanges(syncResult.changes);
                    }
                    return result.new_articles;
                } catch (error) {
                    handleError(error, { context: 'refreshFeed', fallbackMessage: 'Failed to refresh feed' });
                    throw error;
                }
            },

            refreshAllFeeds: async (ids) => {
                set({ isLoading: true, lastRefreshNewArticles: null });
                const controller = new AbortController();
                refreshAbortController = controller;
                let totalNewArticles = 0;
                const articleStore = useArticleStore.getState();
                const estimatedTotal = ids?.length ?? get().feeds.length;
                set({
                    refreshProgress: {
                        total: estimatedTotal,
                        completed: 0,
                        currentTitle: '',
                    }
                });

                // Optimized debounce: fetch immediately on first new article, then debounce subsequent
                let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
                let hasRefreshedOnce = false;
                const debouncedRefresh = () => {
                    if (!hasRefreshedOnce) {
                        // First new article: refresh immediately for instant feedback
                        hasRefreshedOnce = true;
                        articleStore.fetchArticles(true, true);
                    } else {
                        // Subsequent updates: debounce to avoid hammering the server
                        if (refreshTimeout) clearTimeout(refreshTimeout);
                        refreshTimeout = setTimeout(() => {
                            articleStore.fetchArticles(true, true);
                        }, 800);
                    }
                };


                try {
                    await api.refreshFeedsWithProgress(
                        ids,
                        (event) => {
                            if (event.type === 'start') {
                                set({ refreshProgress: { total: event.total_feeds, completed: 0, currentTitle: '' } });
                            } else if (event.type === 'feed_refreshing') {
                                // Show every feed name as it starts
                                set((state) => ({
                                    refreshProgress: state.refreshProgress ? { ...state.refreshProgress, currentTitle: event.title } : null
                                }));
                            } else if (event.type === 'feed_complete' || event.type === 'feed_error') {
                                if (event.type === 'feed_complete' && event.new_articles > 0) {
                                    totalNewArticles += event.new_articles;
                                    debouncedRefresh();
                                }

                                // Update progress and feed list
                                set((state) => ({
                                    refreshProgress: state.refreshProgress ? {
                                        ...state.refreshProgress,
                                        completed: state.refreshProgress.completed + 1,
                                        currentTitle: event.title // Show name on completion too
                                    } : null,
                                    feeds: state.feeds.map(f =>
                                        f.id === (event as any).id
                                            ? {
                                                ...f,
                                                title: event.type === 'feed_complete' && event.feed ? event.feed.title : f.title,
                                                icon_url: event.type === 'feed_complete' && event.feed?.icon_url !== undefined ? event.feed.icon_url : f.icon_url,
                                                type: event.type === 'feed_complete' && event.feed ? event.feed.type : f.type,
                                                unread_count: event.type === 'feed_complete' ? (f.unread_count || 0) + event.new_articles : f.unread_count,
                                                last_fetched_at: new Date().toISOString(),
                                                next_fetch_at: event.type === 'feed_complete' ? event.next_fetch_at || f.next_fetch_at : f.next_fetch_at
                                            }
                                            : f
                                    )
                                }));

                                if (event.type === 'feed_complete' && event.feed) {
                                    const articleStore = useArticleStore.getState();
                                    articleStore.updateFeedMetadata(event.feed.id, {
                                        feed_title: event.feed.title,
                                        feed_icon_url: event.feed.icon_url,
                                        feed_type: event.feed.type,
                                    });
                                }
                            }
                        },
                        (error) => {
                            // Don't show error toast for SSE stream interruptions (e.g., phone lock, app background)
                            // The final fetches will still get the updated data
                            if (!isAbortError(error)) {
                                console.error('[RefreshFeeds] SSE stream error:', error);
                            }
                        },
                        controller.signal
                    );

                    if (controller.signal.aborted) {
                        return;
                    }

                    // Final fetch to ensure everything is in sync
                    if (refreshTimeout) clearTimeout(refreshTimeout);
                    await Promise.all([
                        get().fetchFeeds(),
                        get().fetchFolders(),
                        articleStore.fetchArticles(true)
                    ]);

                    const syncResult = await fetchChanges();
                    if (syncResult) {
                        get().applySyncChanges(syncResult.changes);
                        articleStore.applySyncChanges(syncResult.changes);
                    }
                } catch (error) {
                    if (!isAbortError(error)) {
                        handleError(error, { context: 'refreshAllFeeds' });
                    }
                } finally {
                    if (refreshAbortController === controller) {
                        refreshAbortController = null;
                    }
                    set({
                        isLoading: false,
                        refreshProgress: null,
                        lastRefreshNewArticles: totalNewArticles > 0 ? totalNewArticles : null
                    });
                }
            },

            cancelRefresh: () => {
                if (refreshAbortController) {
                    refreshAbortController.abort();
                    refreshAbortController = null;
                }
                set({ isLoading: false, refreshProgress: null });
            },

            updateFeed: async (id, updates) => {
                try {
                    const result = await api.updateFeed(id, updates as any);
                    set((state) => ({
                        feeds: state.feeds.map((f) => (f.id === id ? result.feed : f)),
                    }));
                } catch (error) {
                    handleError(error, { context: 'updateFeed' });
                    throw error;
                }
            },

            pauseFeed: async (id) => {
                try {
                    const result = await api.pauseFeed(id);
                    set((state) => ({
                        feeds: state.feeds.map((f) => (f.id === id ? { ...f, paused_at: result.paused ? new Date().toISOString() : null } : f)),
                    }));
                } catch (error) {
                    handleError(error, { context: 'pauseFeed' });
                }
            },

            resumeFeed: async (id) => {
                try {
                    await api.resumeFeed(id);
                    set((state) => ({
                        feeds: state.feeds.map((f) => (f.id === id ? { ...f, paused_at: null } : f)),
                    }));
                } catch (error) {
                    handleError(error, { context: 'resumeFeed' });
                }
            },

            updateLocalFeed: (id, updates) => {
                set((state) => ({
                    feeds: state.feeds.map((f) => (f.id === id ? { ...f, ...updates } : f)),
                }));
            },

            applySyncChanges: (changes: SyncChanges, isRefreshing?: boolean) => {
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
                        (syncData.feedsCreated as Feed[]).forEach((feed) => {
                            if (!existingIds.has(feed.id)) {
                                newFeeds.push(feed);
                            }
                        });
                    }
                    if (syncData.feedsUpdated.length > 0) {
                        const updatedMap = new Map((syncData.feedsUpdated as Feed[]).map((f) => [f.id, f]));
                        newFeeds = newFeeds.map((f) => updatedMap.get(f.id) || f);
                    }

                    // Apply folder changes
                    if (syncData.foldersDeleted.length > 0) {
                        newFolders = newFolders.filter((f) => !syncData.foldersDeleted.includes(f.id));
                    }
                    if (syncData.foldersCreated.length > 0) {
                        const existingIds = new Set(newFolders.map((f) => f.id));
                        (syncData.foldersCreated as Folder[]).forEach((folder) => {
                            if (!existingIds.has(folder.id)) {
                                newFolders.push(folder);
                            }
                        });
                    }
                    if (syncData.foldersUpdated.length > 0) {
                        const updatedMap = new Map((syncData.foldersUpdated as Folder[]).map((f) => [f.id, f]));
                        newFolders = newFolders.map((f) => updatedMap.get(f.id) || f);
                    }

                    return {
                        feeds: newFeeds,
                        folders: newFolders,
                        isBackgroundRefreshing: isRefreshing ?? state.isBackgroundRefreshing
                    };
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
