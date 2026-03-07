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
    staleSince: new Date().toISOString(),
    message: 'Timeline needs refresh',
    error: null,
    newArticles: null,
    progress: null,
});

export const useFeedStore = create<FeedState>()(
    persist(
        (set, get) => ({
            feeds: [],
            folders: [],
            smartFolders: [],
            totalUnread: 0,
            isLoading: false,
            refreshState: createInitialRefreshState(),

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
                        newArticles: null,
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
                        staleSince: null,
                        message: result?.message ?? (newArticles && newArticles > 0
                            ? `${newArticles} new article${newArticles === 1 ? '' : 's'} loaded`
                            : 'Up to date'),
                        error: null,
                        newArticles,
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
                        staleSince: state.refreshState.staleSince ?? now,
                        message: 'Refresh failed',
                        error,
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
                        staleSince: state.refreshState.staleSince ?? now,
                        message: message ?? state.refreshState.message ?? 'Timeline may be out of date',
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
                const estimatedTotal = ids?.length ?? get().feeds.length;
                const requiresFullArticleRefresh = () => Boolean(useArticleStore.getState().filter.folder_id);
                const refreshController = createRefreshEventController({
                    scope: 'manual',
                    requestSync: () => debouncedSync(),
                });
                get().beginRefreshCycle('manual', 'refreshing');
                get().updateRefreshProgressState({ total: estimatedTotal, completed: 0, currentTitle: '' });

                let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
                const syncArticleChanges = async (skipCursorUpdate: boolean) => {
                    const syncResult = await fetchChanges('feeds,folders,articles,read_state', { skipCursorUpdate });
                    if (!syncResult) return;

                    get().applySyncChanges(syncResult.changes);
                    articleStore.applySyncChanges(syncResult.changes);
                };

                const debouncedSync = () => {
                    if (refreshTimeout) clearTimeout(refreshTimeout);
                    refreshTimeout = setTimeout(() => {
                        void syncArticleChanges(true);
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
                        requiresFullArticleRefresh() ? articleStore.fetchArticles(true) : Promise.resolve()
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
                            phase: isRefreshing ? 'refreshing' : state.refreshState.phase,
                        },
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
                totalUnread: state.totalUnread,
                refreshState: state.refreshState,
            }),
        }
    )
);
