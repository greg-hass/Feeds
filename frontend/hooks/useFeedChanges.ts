import { useEffect, useRef } from 'react';
import { api } from '@/services/api';
import { useFeedStore } from '@/stores';

export function useFeedChanges() {
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Create abort controller for this session
        abortControllerRef.current = new AbortController();

        const handleFeedChange = (event: { 
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
                                f.folder_id === event.folderId ? { ...f, folder_id: undefined } : f
                            ),
                        }));
                    }
                    break;
            }
        };

        const handleError = (error: Error) => {
            console.error('[Feed Changes] Stream error:', error);
            // Don't show toast for connection errors to avoid spam
        };

        // Start listening for feed changes
        api.listenForFeedChanges(handleFeedChange, handleError, abortControllerRef.current.signal);

        // Cleanup on unmount
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);
}
