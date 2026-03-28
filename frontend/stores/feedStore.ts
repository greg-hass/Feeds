import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Feed, Folder } from '@/services/api';
import { applySyncChanges, SyncChanges, fetchChanges } from '@/lib/sync';
import { createRefreshEventController } from '@/lib/refreshEvents';
import { handleError } from '@/services/errorHandler';
import { useArticleStore } from './articleStore';
import { FeedState } from './types';

let refreshAbortController: AbortController | null = null;

const isAbortError = (error: unknown) =>
    error instanceof Error && error.name === 'AbortError';

const createInitialRefreshState = () => ({
    phase: 'idle' as const,
    scope: null,
    startedAt: null,
    lastAttemptAt: null,
    lastCompletedAt: null,
    message: 'Awaiting first refresh',
    error: null,
    activity: {
        isRefreshing: false,
        isSyncing: false,
    },
    freshness: {
        staleSince: null,
        status: 'fresh' as const,
        lastSuccessfulRefreshAt: null,
    },
    newContent: {
        count: 0,
    },
    progress: null,
});

function normalizeRefreshState(refreshState: any) {
    const initial = createInitialRefreshState();
    const state = refreshState || {};

    return {
        ...initial,
        ...state,
        activity: {
            ...initial.activity,
            ...(state.activity || {}),
        },
        freshness: {
            ...initial.freshness,
            ...(state.freshness || {}),
            staleSince: state.freshness?.staleSince ?? state.staleSince ?? initial.freshness.staleSince,
            lastSuccessfulRefreshAt:
                state.freshness?.lastSuccessfulRefreshAt ??
                state.lastCompletedAt ??
                initial.freshness.lastSuccessfulRefreshAt,
        },
        newContent: {
            ...initial.newContent,
            ...(state.newContent || {}),
            count: state.newContent?.count ?? state.newArticles ?? initial.newContent.count,
        },
    };
}

export const __feedStoreTestUtils = {
    createInitialRefreshState,
    normalizeRefreshState,
};

export const useFeedStore = create<FeedState>()(
    persist(
        (set, get) => ({
            feeds: [],
            folders: [],
            smartFolders: [],
            totalUnread: 0,
            isLoading: false,
            refreshState: normalizeRefreshState(null),

            beginRefreshCycle: (scope, phase) => {
                const now = new Date().toISOString();
                set((state) => ({
                    refreshState: {
                        ...state.refreshState,
                        phase,
                        scope,
                        startedAt: now,
                        lastAttemptAt: now,
                        message: phase === 'refreshing' ? 'Refreshing feeds…' : 'Checking for updates…',
                        error: null,
                        activity: {
                            isRefreshing: phase === 'refreshing',
                            isSyncing: phase === 'syncing',
                        },
                        newContent: {
                            count: 0,
                        },
                        progress: phase === 'refreshing' ? state.refreshState.progress : null,
                    },
                }));
            },

            updateRefreshProgressState: (progress) => {
                set((state) => ({
                    refreshState: {
                        ...state.refreshState,
                        phase: 'refreshing',
                        progress,
                        message: progress?.currentTitle
                            ? `Refreshing ${progress.currentTitle}`
                            : 'Refreshing feeds…',
                        error: null,
                        activity: {
                            isRefreshing: true,
                            isSyncing: false,
                        },
                    },
                }));
            },

            completeRefreshCycle: (result) => {
                const now = new Date().toISOString();
                const newArticles = result?.newArticles ?? null;
                set((state) => ({
                    refreshState: {
                        ...state.refreshState,
                        phase: 'success',
                        scope: state.refreshState.scope,
                        startedAt: null,
                        lastCompletedAt: now,
                        message: result?.message ?? (newArticles && newArticles > 0
                            ? `${newArticles} new article${newArticles === 1 ? '' : 's'} loaded`
                            : 'Up to date'),
                        error: null,
                        activity: {
                            isRefreshing: false,
                            isSyncing: false,
                        },
                        freshness: {
                            staleSince: null,
                            status: 'fresh',
                            lastSuccessfulRefreshAt: now,
                        },
                        newContent: {
                            count: newArticles ?? 0,
                        },
                        progress: null,
                    },
                }));
            },

            failRefreshCycle: (error) => {
                const now = new Date().toISOString();
                set((state) => ({
                    refreshState: {
                        ...state.refreshState,
                        phase: 'error',
                        startedAt: null,
                        message: 'Refresh failed',
                        error,
                        activity: {
                            isRefreshing: false,
                            isSyncing: false,
                        },
                        freshness: {
                            ...state.refreshState.freshness,
                            staleSince: state.refreshState.freshness.staleSince ?? now,
                            status: 'stale',
                        },
                        progress: null,
                    },
                }));
            },

            markRefreshStale: (message) => {
                const now = new Date().toISOString();
                set((state) => ({
                    refreshState: {
                        ...state.refreshState,
                        phase: state.refreshState.phase === 'refreshing' ? state.refreshState.phase : 'idle',
                        message: message ?? state.refreshState.message ?? 'Timeline may be out of date',
                        freshness: {
                            ...state.refreshState.freshness,
                            staleSince: state.refreshState.freshness.staleSince ?? now,
                            status: 'stale',
                        },
                    },
                }));
            },

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
                
                // Immediately fetch articles to show the new feed's content live
                const articleStore = useArticleStore.getState();
                await articleStore.fetchArticles(true);
                
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
                const articleStore = useArticleStore.getState();
                const needsFullArticleRefresh = Boolean(articleStore.filter.folder_id);
                const estimatedTotal = ids?.length ?? get().feeds.length;
                const refreshController = createRefreshEventController({
                    scope: 'manual',
                    requestSync: () => debouncedSync(),
                    getFeedStore: () => useFeedStore.getState(),
                    getArticleStore: () => useArticleStore.getState(),
                });
                get().beginRefreshCycle('manual', 'refreshing');
                get().updateRefreshProgressState({ total: estimatedTotal, completed: 0, currentTitle: '' });

                let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
                const syncChanges = async (include: string, skipCursorUpdate: boolean) => {
                    const syncResult = await fetchChanges(include, { skipCursorUpdate });
                    if (!syncResult) return;

                    get().applySyncChanges(syncResult.changes);
                    articleStore.applySyncChanges(syncResult.changes);
                };

                const syncArticleChanges = async (skipCursorUpdate: boolean) => {
                    await syncChanges('feeds,folders,articles,read_state', skipCursorUpdate);
                };

                const syncMetadataChanges = async (skipCursorUpdate: boolean) => {
                    await syncChanges('feeds,folders,read_state', skipCursorUpdate);
                };

                const debouncedSync = () => {
                    if (refreshTimeout) clearTimeout(refreshTimeout);
                    refreshTimeout = setTimeout(() => {
                        void syncMetadataChanges(true);
                    }, 300);
                };


                try {
                    await api.refreshFeedsWithProgress(
                        ids,
                        refreshController.handleEvent,
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

                    if (refreshTimeout) clearTimeout(refreshTimeout);
                    await syncArticleChanges(false);

                    await Promise.all([
                        get().fetchFeeds(),
                        get().fetchFolders(),
                        needsFullArticleRefresh ? articleStore.fetchArticles(true) : Promise.resolve(),
                    ]);
                } catch (error) {
                    if (!isAbortError(error)) {
                        get().failRefreshCycle(error instanceof Error ? error.message : 'Failed to refresh feeds');
                        handleError(error, { context: 'refreshAllFeeds' });
                    }
                } finally {
                    if (refreshAbortController === controller) {
                        refreshAbortController = null;
                    }
                    if (!controller.signal.aborted && get().refreshState.phase !== 'error') {
                        const totalNewArticles = refreshController.getTotalNewArticles();
                        get().completeRefreshCycle({
                            newArticles: totalNewArticles,
                            message: totalNewArticles > 0
                                ? `${totalNewArticles} new article${totalNewArticles === 1 ? '' : 's'} loaded`
                                : 'Up to date',
                        });
                    }
                    set({
                        isLoading: false,
                    });
                }
            },

            cancelRefresh: () => {
                if (refreshAbortController) {
                    refreshAbortController.abort();
                    refreshAbortController = null;
                }
                set((state) => ({
                    isLoading: false,
                    refreshState: {
                        ...state.refreshState,
                        activity: {
                            isRefreshing: false,
                            isSyncing: false,
                        },
                        phase: 'idle',
                        startedAt: null,
                        message: 'Refresh cancelled',
                        progress: null,
                    },
                }));
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
                        refreshState: {
                            ...state.refreshState,
                            activity: {
                                ...state.refreshState.activity,
                                isRefreshing: !!isRefreshing || state.refreshState.activity.isRefreshing,
                                isSyncing: false,
                            },
                            phase: isRefreshing ? 'refreshing' : state.refreshState.phase,
                        },
                    };
                });
            },

        }),
        {
            name: 'feeds-list',
            version: 2,
            storage: createJSONStorage(() => AsyncStorage),
            migrate: (persistedState: any) => {
                if (!persistedState) {
                    return persistedState;
                }

                return {
                    ...persistedState,
                    refreshState: normalizeRefreshState(persistedState.refreshState),
                };
            },
            merge: (persistedState: any, currentState) => {
                if (!persistedState) {
                    return currentState;
                }

                return {
                    ...currentState,
                    ...persistedState,
                    refreshState: normalizeRefreshState(persistedState.refreshState),
                };
            },
            partialize: (state: FeedState) => ({
                feeds: state.feeds,
                folders: state.folders,
                smartFolders: state.smartFolders,
                totalUnread: state.totalUnread,
                refreshState: state.refreshState,
            }),
        }
    )
);
