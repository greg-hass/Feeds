import { useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useArticleStore, useFeedStore } from '@/stores';
import { fetchChanges } from '@/lib/sync';

interface UseRefreshOptions {
    /**
     * Minimum time between automatic foreground refreshes (ms)
     * Default: 5 minutes
     */
    staleThreshold?: number;

    /**
     * Whether to enable automatic foreground refresh
     * Default: true
     */
    enableForegroundRefresh?: boolean;

    /**
     * Whether to fetch initial data on mount
     * Default: true
     */
    fetchOnMount?: boolean;
}

/**
 * Centralized refresh hook that coordinates all data fetching
 * This ensures consistent refresh behavior across the app
 */
export function useRefresh(options: UseRefreshOptions = {}) {
    const {
        staleThreshold = 5 * 60 * 1000, // 5 minutes
        enableForegroundRefresh = true,
        fetchOnMount = true,
    } = options;

    const { fetchFeeds, fetchFolders, applySyncChanges: applyFeedSyncChanges } = useFeedStore();
    const { fetchArticles, applySyncChanges: applyArticleSyncChanges } = useArticleStore();

    const lastRefreshRef = useRef<number>(0);
    const isRefreshingRef = useRef(false);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    /**
     * Core refresh function that fetches all data and applies sync changes
     * This is the single source of truth for data refresh
     */
    const refresh = useCallback(async (options: { force?: boolean; silent?: boolean } = {}) => {
        const { force = false, silent = false } = options;
        const now = Date.now();

        // Skip if already refreshing
        if (isRefreshingRef.current) {
            console.log('[useRefresh] Already refreshing, skipping');
            return;
        }

        // Skip if data is still fresh (unless forced)
        if (!force && now - lastRefreshRef.current < staleThreshold && silent) {
            console.log('[useRefresh] Data is fresh, skipping silent refresh');
            return;
        }

        isRefreshingRef.current = true;
        console.log(`[useRefresh] Starting refresh (force: ${force}, silent: ${silent})`);

        try {
            // Fetch all data in parallel for performance
            await Promise.all([
                fetchFeeds(),
                fetchFolders(),
                fetchArticles(true), // Reset articles to get latest
            ]);

            // Fetch and apply sync changes to ensure cross-device consistency
            const syncResult = await fetchChanges();
            if (syncResult) {
                console.log('[useRefresh] Applying sync changes');
                applyFeedSyncChanges(syncResult.changes);
                applyArticleSyncChanges(syncResult.changes);
            }

            lastRefreshRef.current = now;
            console.log('[useRefresh] Refresh completed successfully');
        } catch (error) {
            console.error('[useRefresh] Refresh failed:', error);
            // Don't throw - let components handle their own error states
        } finally {
            isRefreshingRef.current = false;
        }
    }, [staleThreshold, fetchFeeds, fetchFolders, fetchArticles, applyFeedSyncChanges, applyArticleSyncChanges]);

    /**
     * Manual refresh triggered by user action (pull-to-refresh, button click)
     * Always forces a refresh regardless of staleness
     */
    const manualRefresh = useCallback(async () => {
        console.log('[useRefresh] Manual refresh triggered');
        await refresh({ force: true, silent: false });
    }, [refresh]);

    /**
     * Silent refresh for background/foreground transitions
     * Only refreshes if data is stale
     */
    const silentRefresh = useCallback(async () => {
        console.log('[useRefresh] Silent refresh triggered');
        await refresh({ force: false, silent: true });
    }, [refresh]);

    // Initial data fetch on mount
    useEffect(() => {
        if (fetchOnMount) {
            console.log('[useRefresh] Initial fetch on mount');
            refresh({ force: true, silent: false });
        }
    }, [fetchOnMount]); // Only run once on mount

    // Foreground refresh when app becomes active
    useEffect(() => {
        if (!enableForegroundRefresh) {
            return;
        }

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextAppState;

            // App came to foreground
            if (previousState !== 'active' && nextAppState === 'active') {
                console.log('[useRefresh] App returned to foreground, checking for refresh');
                silentRefresh();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [enableForegroundRefresh, silentRefresh]);

    return {
        /**
         * Refresh data (respects staleness threshold unless forced)
         */
        refresh,

        /**
         * Force refresh regardless of staleness (for user-initiated actions)
         */
        manualRefresh,

        /**
         * Silent refresh that only runs if data is stale
         */
        silentRefresh,

        /**
         * Whether a refresh is currently in progress
         */
        isRefreshing: isRefreshingRef.current,

        /**
         * Timestamp of last successful refresh
         */
        lastRefresh: lastRefreshRef.current,
    };
}
