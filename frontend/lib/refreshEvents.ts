import { RefreshProgressEvent } from '@/services/api.types';
import { useArticleStore, useFeedStore } from '@/stores';

interface RefreshEventControllerOptions {
    scope: 'background' | 'manual';
    requestSync?: () => void;
    onComplete?: (totalNewArticles: number) => void;
}

export function createRefreshEventController(options: RefreshEventControllerOptions) {
    let totalNewArticles = 0;

    const estimateTotalFeeds = () => {
        const feedCount = useFeedStore.getState().feeds.length;
        return Math.max(feedCount, 1);
    };

    const handleEvent = (event: RefreshProgressEvent) => {
        const feedStore = useFeedStore.getState();
        const articleStore = useArticleStore.getState();

        if (event.type === 'start') {
            totalNewArticles = 0;
            feedStore.beginRefreshCycle(options.scope, 'refreshing');
            feedStore.updateRefreshProgressState({
                total: event.total_feeds,
                completed: 0,
                currentTitle: '',
            });
            return;
        }

        if (event.type === 'feed_refreshing') {
            const current = feedStore.refreshState.progress ?? {
                total: estimateTotalFeeds(),
                completed: 0,
                currentTitle: '',
            };
            feedStore.updateRefreshProgressState({
                ...current,
                currentTitle: event.title,
            });
            return;
        }

        if (event.type === 'feed_complete' || event.type === 'feed_error') {
            if (event.type === 'feed_complete' && event.new_articles > 0) {
                totalNewArticles += event.new_articles;
                options.requestSync?.();
            }

            const current = feedStore.refreshState.progress ?? {
                total: estimateTotalFeeds(),
                completed: 0,
                currentTitle: '',
            };
            const nextCompleted = current.completed + 1;
            const nextTotal = current.total > 0
                ? Math.max(current.total, nextCompleted)
                : Math.max(estimateTotalFeeds(), nextCompleted);

            feedStore.updateRefreshProgressState({
                ...current,
                total: nextTotal,
                completed: nextCompleted,
                currentTitle: event.title || current.currentTitle,
            });

            if (event.type === 'feed_complete') {
                const existing = feedStore.feeds.find((feed) => feed.id === event.id);
                const unreadCount = (existing?.unread_count ?? 0) + event.new_articles;
                feedStore.updateLocalFeed(event.id, {
                    title: event.feed ? event.feed.title : existing?.title,
                    icon_url: event.feed ? event.feed.icon_url : existing?.icon_url,
                    type: event.feed ? event.feed.type : existing?.type,
                    unread_count: unreadCount,
                    last_fetched_at: new Date().toISOString(),
                    next_fetch_at: event.next_fetch_at ?? existing?.next_fetch_at ?? null,
                });

                if (event.feed) {
                    articleStore.updateFeedMetadata(event.feed.id, {
                        feed_title: event.feed.title,
                        feed_icon_url: event.feed.icon_url,
                        feed_type: event.feed.type,
                    });
                }
            }
            return;
        }

        if (event.type === 'complete') {
            options.onComplete?.(totalNewArticles);
        }
    };

    return {
        handleEvent,
        getTotalNewArticles: () => totalNewArticles,
        reset: () => {
            totalNewArticles = 0;
        },
    };
}
