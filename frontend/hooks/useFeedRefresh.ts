import { useCallback, useRef } from 'react';
import { useFeedStore } from '@/stores/feedStore';
import { useArticleStore } from '@/stores/articleStore';
import { api, Feed } from '@/services/api';
import { applySyncChanges, fetchChanges } from '@/lib/sync';

const isAbortError = (error: unknown) =>
    error instanceof Error && error.name === 'AbortError';

export function useFeedRefresh() {
    const feedStore = useFeedStore();
    const articleStore = useArticleStore();
    const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasRefreshedOnceRef = useRef(false);

    const debouncedRefresh = useCallback((totalNewArticles: number) => {
        if (!hasRefreshedOnceRef.current) {
            hasRefreshedOnceRef.current = true;
            articleStore.fetchArticles(true, true);
        } else {
            if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
            refreshTimeoutRef.current = setTimeout(() => {
                articleStore.fetchArticles(true, true);
            }, 800);
        }
    }, [articleStore]);

    const refreshAllFeeds = useCallback(async (feedIds?: number[]) => {
        feedStore.setIsLoading(true);
        feedStore.setLastRefreshNewArticles(null);

        const controller = new AbortController();
        let totalNewArticles = 0;
        const estimatedTotal = feedIds?.length ?? feedStore.feeds.length;

        feedStore.setRefreshProgress({
            total: estimatedTotal,
            completed: 0,
            currentTitle: '',
        });

        try {
            await api.refreshFeedsWithProgress(
                feedIds,
                (event) => {
                    if (event.type === 'start') {
                        feedStore.setRefreshProgress({
                            total: event.total_feeds,
                            completed: 0,
                            currentTitle: '',
                        });
                    } else if (event.type === 'feed_refreshing') {
                        feedStore.setRefreshProgress((prev) => prev ? { ...prev, currentTitle: event.title } : null);
                    } else if (event.type === 'feed_complete' || event.type === 'feed_error') {
                        if (event.type === 'feed_complete' && event.new_articles > 0) {
                            totalNewArticles += event.new_articles;
                            debouncedRefresh(totalNewArticles);
                        }

                        feedStore.setRefreshProgress((prev) => prev ? {
                            ...prev,
                            completed: prev.completed + 1,
                            currentTitle: event.title,
                        } : null);

                        feedStore.updateLocalFeeds((feeds) =>
                            feeds.map((f) =>
                                f.id === (event as any).id
                                    ? {
                                        ...f,
                                        title: event.type === 'feed_complete' && event.feed ? event.feed.title : f.title,
                                        icon_url: event.type === 'feed_complete' && event.feed?.icon_url !== undefined ? event.feed.icon_url : f.icon_url,
                                        type: event.type === 'feed_complete' && event.feed ? event.feed.type : f.type,
                                        unread_count: event.type === 'feed_complete' ? (f.unread_count || 0) + event.new_articles : f.unread_count,
                                        last_fetched_at: new Date().toISOString(),
                                        next_fetch_at: event.type === 'feed_complete' ? event.next_fetch_at || f.next_fetch_at : f.next_fetch_at,
                                    }
                                    : f
                            )
                        );

                        if (event.type === 'feed_complete' && event.feed) {
                            articleStore.updateFeedMetadata(event.feed.id, {
                                feed_title: event.feed.title,
                                feed_icon_url: event.feed.icon_url,
                                feed_type: event.feed.type,
                            });
                        }
                    }
                },
                (error) => {
                    if (!isAbortError(error)) {
                        console.error('[RefreshFeeds] SSE stream error:', error);
                    }
                },
                controller.signal
            );

            if (controller.signal.aborted) {
                return;
            }

            if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
            await Promise.all([
                feedStore.fetchFeeds(),
                feedStore.fetchFolders(),
                articleStore.fetchArticles(true),
            ]);

            const syncResult = await fetchChanges();
            if (syncResult) {
                feedStore.applySyncChanges(syncResult.changes);
                articleStore.applySyncChanges(syncResult.changes);
            }
        } catch (error) {
            if (!isAbortError(error)) {
                console.error('[RefreshFeeds] Error:', error);
            }
        } finally {
            feedStore.setIsLoading(false);
            feedStore.setRefreshProgress(null);
            feedStore.setLastRefreshNewArticles(totalNewArticles > 0 ? totalNewArticles : null);
        }
    }, [feedStore, articleStore, debouncedRefresh]);

    return { refreshAllFeeds };
}
