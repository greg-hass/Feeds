import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Feed, Folder, RefreshProgressEvent } from '@/services/api';
import { applySyncChanges, SyncChanges, fetchChanges } from '@/lib/sync';
import { handleError } from '@/services/errorHandler';
import { useArticleStore } from './articleStore';
import { FeedState } from './types';

const isAbortError = (error: unknown): boolean => {
    return error instanceof Error && error.name === 'AbortError';
};

const handleRefreshEvent = (
    event: RefreshProgressEvent,
    set: any,
    totalNewArticlesRef: { current: number }
) => {
    if (event.type === 'start') {
        set({ refreshProgress: { total: event.total_feeds, completed: 0, currentTitle: '' } });
    } else if (event.type === 'feed_refreshing') {
        set((prev: FeedState) => ({
            refreshProgress: prev.refreshProgress ? {
                ...prev.refreshProgress,
                completed: prev.refreshProgress.completed + 1,
                currentTitle: event.title
            } : null
        }));
    } else if (event.type === 'feed_complete') {
        totalNewArticlesRef.current += event.new_articles;
    }
};

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
            refreshAbortController: null,

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

            addFeed: async (url: string, folderId?: number, refreshInterval?: number, options: { skipDiscovery?: boolean } = {}) => {
                const { skipDiscovery = false } = options;
                const result = await api.addFeed(url, folderId, !skipDiscovery, refreshInterval);
                set((state: FeedState) => ({ feeds: [...state.feeds, result.feed] }));
                return result.feed;
            },

            deleteFeed: async (id) => {
                await api.deleteFeed(id);
                set((state) => ({ feeds: state.feeds.filter((feed) => feed.id !== id) }));
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

            setIsLoading: (loading: boolean) => set({ isLoading: loading }),

            setRefreshProgress: (progress: { total: number; completed: number; currentTitle: string } | null) =>
                set({ refreshProgress: progress }),

            setLastRefreshNewArticles: (count: number | null) =>
                set({ lastRefreshNewArticles: count }),

            updateLocalFeeds: (updater: (feeds: Feed[]) => Feed[]) =>
                set((state) => ({ feeds: updater(state.feeds) })),

            refreshAllFeeds: async (feedIds?: number[]) => {
                const totalNewArticlesRef = { current: 0 };
                const articleStore = useArticleStore.getState();

                const controller = new AbortController();
                const { refreshAbortController } = get();
                if (refreshAbortController) {
                    refreshAbortController.abort();
                }
                set({ refreshAbortController: controller, isLoading: true });

                try {
                    await api.refreshFeedsWithProgress(
                        feedIds,
                        (event) => handleRefreshEvent(event, set, totalNewArticlesRef),
                        (error) => {
                            if (!isAbortError(error)) {
                                console.error('[RefreshFeeds] SSE stream error:', error);
                            }
                        },
                        controller.signal
                    );

                    if (controller.signal.aborted) {
                        return;
                    }

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
                    // Only clear if we are still the active controller
                    if (get().refreshAbortController === controller) {
                        set({ refreshAbortController: null });
                    }
                    set({
                        isLoading: false,
                        refreshProgress: null,
                        lastRefreshNewArticles: totalNewArticlesRef.current > 0 ? totalNewArticlesRef.current : null
                    });
                }
            },

            cancelRefresh: () => {
                const { refreshAbortController } = get();
                if (refreshAbortController) {
                    refreshAbortController.abort();
                    set({ refreshAbortController: null });
                }
                set({ isLoading: false, refreshProgress: null });
            },

            updateFeed: async (id, updates) => {
                try {
                    const result = await api.updateFeed(id, updates as any);
                    set((state) => ({
                        feeds: state.feeds.map((feed) => (feed.id === id ? result.feed : feed)),
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
                        feeds: state.feeds.map((feed) => (feed.id === id ? { ...feed, paused_at: result.paused ? new Date().toISOString() : null } : feed)),
                    }));
                } catch (error) {
                    handleError(error, { context: 'pauseFeed' });
                }
            },

            resumeFeed: async (id) => {
                try {
                    const result = await api.resumeFeed(id);
                    set((state) => ({
                        feeds: state.feeds.map((feed) => (feed.id === id ? { ...feed, paused_at: null } : feed)),
                    }));
                } catch (error) {
                    handleError(error, { context: 'resumeFeed' });
                }
            },

            updateLocalFeed: (id, updates) => {
                set((state) => ({
                    feeds: state.feeds.map((feed) => (feed.id === id ? { ...feed, ...updates } : feed)),
                }));
            },

            applySyncChanges: (changes: SyncChanges, isRefreshing?: boolean) => {
                const syncData = applySyncChanges(changes);
                set((state) => {
                    let newFeeds = [...state.feeds];
                    let newFolders = [...state.folders];

                    // Apply feed changes
                    if (syncData.feedsDeleted.length > 0) {
                        newFeeds = newFeeds.filter((feed) => !syncData.feedsDeleted.includes(feed.id));
                    }
                    if (syncData.feedsCreated.length > 0) {
                        const existingIds = new Set(newFeeds.map((feed) => feed.id));
                        (syncData.feedsCreated as Feed[]).forEach((feed) => {
                            if (!existingIds.has(feed.id)) {
                                newFeeds.push(feed);
                            }
                        });
                    }
                    if (syncData.feedsUpdated.length > 0) {
                        const updatedMap = new Map((syncData.feedsUpdated as Feed[]).map((feed) => [feed.id, feed]));
                        newFeeds = newFeeds.map((feed) => updatedMap.get(feed.id) || feed);
                    }

                    // Apply folder changes
                    if (syncData.foldersDeleted.length > 0) {
                        newFolders = newFolders.filter((folder) => !syncData.foldersDeleted.includes(folder.id));
                    }
                    if (syncData.foldersCreated.length > 0) {
                        const existingIds = new Set(newFolders.map((folder) => folder.id));
                        (syncData.foldersCreated as Folder[]).forEach((folder) => {
                            if (!existingIds.has(folder.id)) {
                                newFolders.push(folder);
                            }
                        });
                    }
                    if (syncData.foldersUpdated.length > 0) {
                        const updatedMap = new Map((syncData.foldersUpdated as Folder[]).map((folder) => [folder.id, folder]));
                        newFolders = newFolders.map((folder) => updatedMap.get(folder.id) || folder);
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
