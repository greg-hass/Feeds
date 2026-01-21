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
                set({ isLoading: true });
                const controller = new AbortController();
                refreshAbortController = controller;
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

                let lastProgressUpdate = 0;
                const PROGRESS_THROTTLE_MS = 100;

                try {
                    await api.refreshFeedsWithProgress(
                        ids,
                        (event) => {
                            const now = Date.now();
                            if (event.type === 'start') {
                                set({ refreshProgress: { total: event.total_feeds, completed: 0, currentTitle: '' } });
                            } else if (event.type === 'feed_refreshing') {
                                // Only update title if throttled or it's the first update
                                if (now - lastProgressUpdate > PROGRESS_THROTTLE_MS) {
                                    set((state) => ({
                                        refreshProgress: state.refreshProgress ? { ...state.refreshProgress, currentTitle: event.title } : null
                                    }));
                                    lastProgressUpdate = now;
                                }
                            } else if (event.type === 'feed_complete' || event.type === 'feed_error') {
                                if (event.type === 'feed_complete' && event.new_articles > 0) {
                                    hasNewArticles = true;
                                    debouncedRefresh();
                                }

                                // For completion, we always update but maybe still throttle the state set if many feeds complete rapidly
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
                            if (!isAbortError(error)) {
                                handleError(error, { context: 'refreshFeedsProgress', showToast: true });
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
                    set({ isLoading: false, refreshProgress: null });
                }
            },

            cancelRefresh: () => {
                if (refreshAbortController) {
                    refreshAbortController.abort();
                    refreshAbortController = null;
                }
                set({ isLoading: false, refreshProgress: null });
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
