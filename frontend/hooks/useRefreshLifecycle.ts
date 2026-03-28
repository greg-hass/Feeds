import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useArticleStore, useFeedStore, useSettingsStore } from '@/stores';
import { enableSync, fetchChanges, syncManager } from '@/lib/sync';
import { api } from '@/services/api';
import { createRefreshEventController } from '@/lib/refreshEvents';

interface UseRefreshLifecycleOptions {
    enabled: boolean;
    realtimeEnabled?: boolean;
}

export function useRefreshLifecycle({
    enabled,
    realtimeEnabled = enabled,
}: UseRefreshLifecycleOptions) {
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

        let serviceWorkerMessageHandler: ((event: MessageEvent) => void) | null = null;
        let serviceWorkerLoadHandler: (() => void) | null = null;

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
            const registerServiceWorker = async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    console.log('SW registered:', registration);
                    const activeRegistration = await navigator.serviceWorker.ready;

                    if ('sync' in activeRegistration) {
                        try {
                            await (activeRegistration as ServiceWorkerRegistration & {
                                sync: { register: (tag: string) => Promise<void> }
                            }).sync.register('feeds-background-sync');
                            console.log('Background sync registered');
                        } catch (syncError) {
                            console.log('Background sync registration failed:', syncError);
                        }
                    }

                    if ('periodicSync' in activeRegistration) {
                        try {
                            const status = await navigator.permissions.query({
                                name: 'periodic-background-sync' as PermissionName,
                            });

                            if (status.state === 'granted') {
                                await (activeRegistration as any).periodicSync.register('feeds-background-sync', {
                                    minInterval: 5 * 60 * 1000,
                                });
                                console.log('Periodic background sync registered');
                            }
                        } catch (periodicError) {
                            console.log('Periodic sync registration failed:', periodicError);
                        }
                    }

                    serviceWorkerMessageHandler = (event) => {
                        if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
                            console.log('Background sync completed:', event.data);
                        }
                    };
                    navigator.serviceWorker.addEventListener('message', serviceWorkerMessageHandler);
                } catch (error) {
                    console.log('SW registration failed: ', error);
                }
            };

            if (document.readyState === 'complete') {
                void registerServiceWorker();
            } else {
                serviceWorkerLoadHandler = registerServiceWorker;
                window.addEventListener('load', serviceWorkerLoadHandler, { once: true });
            }
        }

        return () => {
            if (serviceWorkerLoadHandler && typeof window !== 'undefined') {
                window.removeEventListener('load', serviceWorkerLoadHandler);
                serviceWorkerLoadHandler = null;
            }
            if (serviceWorkerMessageHandler && 'serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', serviceWorkerMessageHandler);
                serviceWorkerMessageHandler = null;
            }
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
        if (!enabled || !realtimeEnabled) return;

        const controller = new AbortController();
        let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
        const refreshController = createRefreshEventController({
            scope: 'background',
            requestSync: () => debouncedSync(),
            onComplete: () => {
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
            if (requiresFullArticleRefresh()) {
                await fetchArticles(true);
            }
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
                    activity: {
                        ...state.refreshState.activity,
                        isRefreshing: false,
                        isSyncing: false,
                    },
                    progress: null,
                },
            }));
        };
    }, [enabled, realtimeEnabled, fetchArticles, fetchSettings]);

    useEffect(() => {
        if (!enabled) return;

        let lastRefreshAt = Date.now();
        let backgroundedAt: number | null = null;
        const getForegroundRefreshIntervalMs = () =>
            (useSettingsStore.getState().settings?.refresh_interval_minutes ?? 15) * 60 * 1000;

        fetchSettings().catch(() => { });

        const refreshNow = async (force = false) => {
            const now = Date.now();
            if (!force && now - lastRefreshAt < getForegroundRefreshIntervalMs()) return;
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

                if (requiresFullArticleRefresh()) {
                    await fetchArticles(true);
                }
                fetchSettings().catch(() => { });
                completeRefreshCycle({ message: 'Timeline synced' });
            } catch (error) {
                failRefreshCycle(error instanceof Error ? error.message : 'Failed to sync timeline');
            }
        };

        const maybeRefreshOnResume = () => {
            if (!backgroundedAt) return;

            const backgroundedDuration = Date.now() - backgroundedAt;
            backgroundedAt = null;

            if (backgroundedDuration < getForegroundRefreshIntervalMs()) {
                return;
            }

            void refreshNow(false);
        };

        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                maybeRefreshOnResume();
            } else if (state === 'background' || state === 'inactive') {
                backgroundedAt = Date.now();
                markRefreshStale('Timeline may be out of date');
            }
        });

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                maybeRefreshOnResume();
            } else if (document.visibilityState === 'hidden') {
                backgroundedAt = Date.now();
                markRefreshStale('Timeline may be out of date');
            }
        };

        const onFocus = () => {
            maybeRefreshOnResume();
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
