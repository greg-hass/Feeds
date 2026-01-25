import { useCallback } from 'react';
import { ProgressEvent, RefreshProgressEvent } from '@/services/api';
import { ProgressState, FailedFeed } from '@/components/ProgressDialog';
import { ProgressItemData, ItemStatus } from '@/components/ProgressItem';

type AnyProgressEvent = ProgressEvent | RefreshProgressEvent;

interface UseProgressHandlerOptions {
    onFolderCreated?: () => void;
    onFeedCreated?: () => void;
    onFeedComplete?: () => void;
}

export function useProgressHandler(
    setProgressState: React.Dispatch<React.SetStateAction<ProgressState>>,
    options: UseProgressHandlerOptions = {}
) {
    const { onFolderCreated, onFeedCreated, onFeedComplete } = options;

    const handleEvent = useCallback((event: AnyProgressEvent) => {
        // Live UI updates for OPML import events
        if (event.type === 'folder_created' && onFolderCreated) {
            onFolderCreated();
        } else if (event.type === 'feed_created' && 'status' in event && event.status === 'created' && onFeedCreated) {
            onFeedCreated();
        } else if (event.type === 'feed_complete' && onFeedComplete) {
            onFeedComplete();
        }

        setProgressState(prev => {
            switch (event.type) {
                case 'start':
                    return {
                        ...prev,
                        total: event.total_feeds,
                    };

                case 'folder_created': {
                    if (!('id' in event) || !('name' in event)) return prev;
                    const newItem: ProgressItemData = {
                        id: `folder-${event.id}`,
                        type: 'folder',
                        title: event.name,
                        status: 'success',
                    };
                    return {
                        ...prev,
                        items: [...prev.items, newItem],
                    };
                }

                case 'feed_created': {
                    if (!('id' in event) || !('title' in event) || !('status' in event)) return prev;
                    const newItem: ProgressItemData = {
                        id: `feed-${event.id}`,
                        type: 'feed',
                        title: event.title,
                        folder: 'folder' in event ? event.folder : undefined,
                        status: event.status === 'duplicate' ? 'skipped' : 'pending',
                        subtitle: event.status === 'duplicate' ? 'Already exists' : undefined,
                    };
                    const newStats = event.status === 'duplicate'
                        ? { ...prev.stats, skipped: prev.stats.skipped + 1 }
                        : prev.stats;
                    return {
                        ...prev,
                        items: [...prev.items, newItem],
                        stats: newStats,
                    };
                }

                case 'feed_refreshing': {
                    if (!('id' in event)) return prev;
                    const updatedItems = prev.items.map(item =>
                        item.id === `feed-${event.id}`
                            ? { ...item, status: 'processing' as ItemStatus }
                            : item
                    );
                    const currentItem = updatedItems.find(item => item.id === `feed-${event.id}`) || null;
                    return {
                        ...prev,
                        items: updatedItems,
                        current: currentItem,
                    };
                }

                case 'feed_complete': {
                    if (!('id' in event) || !('new_articles' in event)) return prev;
                    const updatedItems = prev.items.map(item =>
                        item.id === `feed-${event.id}`
                            ? {
                                ...item,
                                status: 'success' as ItemStatus,
                                subtitle: `${event.new_articles} new articles`,
                            }
                            : item
                    );
                    return {
                        ...prev,
                        items: updatedItems,
                        stats: { ...prev.stats, success: prev.stats.success + 1 },
                    };
                }

                case 'feed_error': {
                    if (!('id' in event) || !('title' in event) || !('error' in event)) return prev;
                    const updatedItems = prev.items.map(item =>
                        item.id === `feed-${event.id}`
                            ? {
                                ...item,
                                status: 'error' as ItemStatus,
                                subtitle: event.error,
                            }
                            : item
                    );
                    return {
                        ...prev,
                        items: updatedItems,
                        stats: { ...prev.stats, errors: prev.stats.errors + 1 },
                        failedFeeds: [...prev.failedFeeds, { id: event.id, title: event.title, error: event.error }],
                    };
                }

                case 'complete':
                    return {
                        ...prev,
                        complete: true,
                        current: null,
                    };

                default:
                    return prev;
            }
        });
    }, [setProgressState, onFolderCreated, onFeedCreated, onFeedComplete]);

    return handleEvent;
}
