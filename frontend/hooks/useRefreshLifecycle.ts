import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useArticleStore, useFeedStore, useSettingsStore, useToastStore } from '@/stores';
import { enableSync, fetchChanges, syncManager } from '@/lib/sync';
import { api } from '@/services/api';
import { createRefreshEventController } from '@/lib/refreshEvents';

interface UseRefreshLifecycleOptions {
    enabled: boolean;
}

export function useRefreshLifecycle({ enabled }: UseRefreshLifecycleOptions) {
    const { show } = useToastStore();
    const { fetchSettings } = useSettingsStore();
    const { fetchArticles } = useArticleStore();
    const {
        beginRefreshCycle,
        completeRefreshCycle,
        failRefreshCycle,
        markRefreshStale,
    } = useFeedStore();
    const lastIsRefreshingRef = useRef(false);
    const requiresFullArticleRefresh = () => Boolean(useArticleStore.getState().filter.folder_id);

    useEffect(() => {
        if (!enabled) return;

        const cleanupSync = enableSync((changes, isRefreshing) => {
            useFeedStore.getState().applySyncChanges(changes, isRefreshing);
            useArticleStore.getState().applySyncChanges(changes);

            const articleStore = useArticleStore.getState();
            const settingsStore = useSettingsStore.getState();
            const createdCount = Array.isArray(changes.articles?.created) ? changes.articles?.created.length : 0;
            const hasFolderFilter = !!articleStore.filter.folder_id;
            const wasRefreshing = lastIsRefreshingRef.current;
            const nowRefreshing = !!isRefreshing;

            if (hasFolderFilter && createdCount > 0) {
                articleStore.fetchArticles(true, true);
            }

            if (wasRefreshing && !nowRefreshing) {
                if (requiresFullArticleRefresh()) {
                    articleStore.fetchArticles(true, true);
                }
                settingsStore.fetchSettings().catch(() => { });
            }

            lastIsRefreshingRef.current = nowRefreshing;
        });

        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    console.log('SW registered:', registration);

                    if ('sync' in registration) {
                        try {
                            await (registration as ServiceWorkerRegistration & {
                                sync: { register: (tag: string) => Promise<void> }
                            }).sync.register('feeds-background-sync');
                            console.log('Background sync registered');
                        } catch (syncError) {
                            console.log('Background sync registration failed:', syncError);
                        }
                    }

                    if ('periodicSync' in registration) {
                        try {
                            const status = await navigator.permissions.query({
                                name: 'periodic-background-sync' as PermissionName,
                            });

                            if (status.state === 'granted') {
                                await (registration as any).periodicSync.register('feeds-background-sync', {
                                    minInterval: 5 * 60 * 1000,
                                });
                                console.log('Periodic background sync registered');
                            }
                        } catch (periodicError) {
                            console.log('Periodic sync registration failed:', periodicError);
                        }
                    }

                    navigator.serviceWorker.addEventListener('message', (event) => {
                        if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
                            console.log('Background sync completed:', event.data);
                        }
                    });
                } catch (error) {
                    console.log('SW registration failed: ', error);
                }
            });
        }

        return () => {
            cleanupSync();
        };
    }, [enabled]);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                syncManager.stop();
            } else if (nextAppState === 'active') {
                syncManager.start();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const controller = new AbortController();
        let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
        const refreshController = createRefreshEventController({
            scope: 'background',
            requestSync: () => debouncedSync(),
            onComplete: (totalNewArticles) => {
                if (totalNewArticles > 0) {
                    show(
                        `${totalNewArticles} new article${totalNewArticles === 1 ? '' : 's'} loaded`,
                        'success'
                    );
                }
                void finalizeRefresh();
            },
        });

        const syncNow = async (skipCursorUpdate: boolean, isRefreshing = true) => {
            const syncResult = await fetchChanges('feeds,folders,articles,read_state', { skipCursorUpdate });
            if (syncResult) {
                useFeedStore.getState().applySyncChanges(syncResult.changes, isRefreshing);
                useArticleStore.getState().applySyncChanges(syncResult.changes);
            }
        };

        const debouncedSync = () => {
            if (refreshTimeout) clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
                void syncNow(true);
            }, 300);
        };

        const finalizeRefresh = async () => {
            if (refreshTimeout) {
                clearTimeout(refreshTimeout);
                refreshTimeout = null;
            }

            await syncNow(false, false);
            await Promise.all([
                requiresFullArticleRefresh() ? fetchArticles(true) : Promise.resolve(),
            ]);
            fetchSettings().catch(() => { });
        };

        api.listenForRefreshEvents(
            (event) => {
                refreshController.handleEvent(event);
            },
            (error) => {
                console.warn('[RefreshEvents] SSE stream error:', error);
                useFeedStore.getState().failRefreshCycle(
                    error instanceof Error ? error.message : 'Refresh stream interrupted'
                );
            },
            controller.signal
        );

        return () => {
            controller.abort();
            if (refreshTimeout) clearTimeout(refreshTimeout);
            useFeedStore.setState((state) => ({
                refreshState: {
                    ...state.refreshState,
                    progress: null,
                },
            }));
        };
    }, [enabled, fetchArticles, fetchSettings, show]);

    useEffect(() => {
        if (!enabled) return;

        let lastRefreshAt = Date.now();
        let backgroundedAt: number | null = null;
        const staleMs = 60 * 1000;
        const backgroundRefreshThresholdMs = 2 * 60 * 1000;

        fetchSettings().catch(() => { });

        const refreshNow = async (force = false) => {
            const now = Date.now();
            if (!force && now - lastRefreshAt < staleMs) return;
            lastRefreshAt = now;

            try {
                useArticleStore.setState({ isLoading: false });

                if (force) {
                    markRefreshStale('Timeline is stale. Refreshing feeds…');
                    await useFeedStore.getState().refreshAllFeeds();
                    return;
                }

                beginRefreshCycle('foreground', 'syncing');
                const syncResult = await fetchChanges();
                if (syncResult) {
                    useFeedStore.getState().applySyncChanges(syncResult.changes);
                    useArticleStore.getState().applySyncChanges(syncResult.changes);
                }

                await Promise.all([
                    requiresFullArticleRefresh() ? fetchArticles(true) : Promise.resolve()
                ]);
                fetchSettings().catch(() => { });
                completeRefreshCycle({ message: 'Timeline synced' });
            } catch (error) {
                failRefreshCycle(error instanceof Error ? error.message : 'Failed to sync timeline');
            }
        };

        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                const backgroundedDuration = backgroundedAt ? Date.now() - backgroundedAt : 0;
                const forceRefresh = backgroundedDuration > backgroundRefreshThresholdMs;
                backgroundedAt = null;
                refreshNow(forceRefresh);
            } else if (state === 'background' || state === 'inactive') {
                backgroundedAt = Date.now();
                markRefreshStale('Timeline may be out of date');
            }
        });

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                const hiddenDuration = backgroundedAt ? Date.now() - backgroundedAt : 0;
                const forceRefresh = hiddenDuration > backgroundRefreshThresholdMs;
                backgroundedAt = null;
                refreshNow(forceRefresh);
            } else if (document.visibilityState === 'hidden') {
                backgroundedAt = Date.now();
                markRefreshStale('Timeline may be out of date');
            }
        };

        const onFocus = () => {
            if (!backgroundedAt) return;
            const hiddenDuration = Date.now() - backgroundedAt;
            const forceRefresh = hiddenDuration > backgroundRefreshThresholdMs;
            backgroundedAt = null;
            refreshNow(forceRefresh);
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibility);
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('focus', onFocus);
        }

        return () => {
            appStateSub.remove();
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisibility);
            }
            if (typeof window !== 'undefined') {
                window.removeEventListener('focus', onFocus);
            }
        };
    }, [enabled, fetchArticles, fetchSettings, beginRefreshCycle, completeRefreshCycle, failRefreshCycle, markRefreshStale]);
}
