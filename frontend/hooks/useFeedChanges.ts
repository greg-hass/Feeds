import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api } from '@/services/api';
import { useFeedStore } from '@/stores';

export function useFeedChanges() {
    const abortControllerRef = useRef<AbortController | null>(null);
    const appStateRef = useRef<AppStateStatus>('active');

    const handleFeedChange = useCallback((event: { 
        type: string; 
        feed?: any; 
        folder?: any; 
        feedId?: number; 
        folderId?: number;
        timestamp: string;
    }) => {
        console.log('[Feed Changes] Received event:', event.type);

        // Use getState() to always get fresh state instead of capturing from closure
        switch (event.type) {
            case 'feed_created':
                // Add new feed if not already present
                if (event.feed) {
                    useFeedStore.setState((state) => {
                        const exists = state.feeds.some(f => f.id === event.feed!.id);
                        if (!exists) {
                            return { feeds: [...state.feeds, event.feed!] };
                        }
                        return state;
                    });
                }
                break;

            case 'feed_updated':
                // Update existing feed
                if (event.feed) {
                    useFeedStore.setState((state) => ({
                        feeds: state.feeds.map(f => 
                            f.id === event.feed!.id ? event.feed! : f
                        ),
                    }));
                }
                break;

            case 'feed_deleted':
                // Remove deleted feed
                if (event.feedId) {
                    useFeedStore.setState((state) => ({
                        feeds: state.feeds.filter(f => f.id !== event.feedId),
                    }));
                }
                break;

            case 'folder_created':
                // Add new folder if not already present
                if (event.folder) {
                    useFeedStore.setState((state) => {
                        const exists = state.folders.some(f => f.id === event.folder!.id);
                        if (!exists) {
                            return { folders: [...state.folders, event.folder!] };
                        }
                        return state;
                    });
                }
                break;

            case 'folder_updated':
                // Update existing folder
                if (event.folder) {
                    useFeedStore.setState((state) => ({
                        folders: state.folders.map(f => 
                            f.id === event.folder!.id ? event.folder! : f
                        ),
                    }));
                }
                break;

            case 'folder_deleted':
                // Remove deleted folder and uncategorize feeds
                if (event.folderId) {
                    useFeedStore.setState((state) => ({
                        folders: state.folders.filter(f => f.id !== event.folderId),
                        feeds: state.feeds.map(f => 
                            f.folder_id === event.folderId ? { ...f, folder_id: null } : f
                        ),
                    }));
                }
                break;
        }
    }, []);

    const handleError = useCallback((error: Error) => {
        console.error('[Feed Changes] Stream error:', error);
        // Clear controller on error so it can be restarted
        abortControllerRef.current = null;
    }, []);

    // Start SSE connection
    const startFeedChangesSSE = useCallback(() => {
        // Don't start if already running or app is not active
        if (abortControllerRef.current || appStateRef.current !== 'active') {
            return;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;
        api.listenForFeedChanges(handleFeedChange, handleError, controller.signal);
    }, [handleFeedChange, handleError]);

    // Stop SSE connection
    const stopFeedChangesSSE = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextAppState;

            if (nextAppState === 'active' && previousState !== 'active') {
                // App came to foreground - restart SSE connection
                startFeedChangesSSE();
            } else if (nextAppState !== 'active' && previousState === 'active') {
                // App went to background - stop SSE connection to save battery
                stopFeedChangesSSE();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Start SSE on mount if app is active
        if (appStateRef.current === 'active') {
            startFeedChangesSSE();
        }

        return () => {
            subscription.remove();
            stopFeedChangesSSE();
        };
    }, [startFeedChangesSSE, stopFeedChangesSSE]);
}
