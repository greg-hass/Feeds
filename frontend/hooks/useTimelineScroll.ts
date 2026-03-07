import { useRef, useState, useEffect, useCallback } from 'react';
import { FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useArticleStore } from '@/stores';

type TimelineArticle = { id: number };

type ScrollSnapshot = {
    absoluteOffset: number;
    anchorArticleId: number | null;
    anchorOffset: number;
};

const scrollSnapshots: Record<string, ScrollSnapshot> = {};

function getScrollKey(filter: any): string {
    const parts: string[] = ['timeline'];

    if (filter.unread_only) parts.push('unread');
    if (filter.type) parts.push(`type:${filter.type}`);
    if (filter.feed_id) parts.push(`feed:${filter.feed_id}`);
    if (filter.folder_id) parts.push(`folder:${filter.folder_id}`);

    if (parts.length === 1) {
        return 'timeline:all';
    }

    return parts.join(':');
}

function getSnapshot(scrollKey: string): ScrollSnapshot {
    return scrollSnapshots[scrollKey] || {
        absoluteOffset: 0,
        anchorArticleId: null,
        anchorOffset: 0,
    };
}

export const __timelineScrollTestUtils = {
    getScrollKey,
    getSnapshot,
    setSnapshot: (key: string, snapshot: ScrollSnapshot) => {
        scrollSnapshots[key] = snapshot;
    },
    clearSnapshots: () => {
        Object.keys(scrollSnapshots).forEach((key) => {
            delete scrollSnapshots[key];
        });
    },
};

export const useTimelineScroll = (articles: TimelineArticle[], filter: any) => {
    const { prefetchArticle } = useArticleStore();
    const [restoreAttempt, setRestoreAttempt] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const currentScrollKey = useRef('');
    const hasRestoredScroll = useRef(false);
    const isRestoring = useRef(false);
    const isPrependCompensating = useRef(false);
    const pendingNewArticlesCount = useRef(0);
    const prependCompensationSnapshot = useRef<ScrollSnapshot | null>(null);
    const currentScrollOffset = useRef(0);
    const currentAnchorId = useRef<number | null>(null);
    const currentAnchorIndex = useRef(0);
    const currentAnchorOffset = useRef(0);

    const scrollKey = getScrollKey(filter);

    useEffect(() => {
        if (currentScrollKey.current !== scrollKey) {
            hasRestoredScroll.current = false;
            isRestoring.current = false;
            isPrependCompensating.current = false;
            pendingNewArticlesCount.current = 0;
            prependCompensationSnapshot.current = null;
            currentScrollKey.current = scrollKey;
            currentScrollOffset.current = getSnapshot(scrollKey).absoluteOffset;
        }
    }, [scrollKey]);

    useFocusEffect(
        useCallback(() => {
            const snapshot = getSnapshot(scrollKey);
            if (snapshot.absoluteOffset > 0 && hasRestoredScroll.current) {
                hasRestoredScroll.current = false;
                setRestoreAttempt((attempt) => attempt + 1);
            }
        }, [scrollKey])
    );

    const completeRestore = useCallback(() => {
        setTimeout(() => {
            hasRestoredScroll.current = true;
            isRestoring.current = false;
        }, 80);
    }, []);

    useEffect(() => {
        if (hasRestoredScroll.current || articles.length === 0 || !flatListRef.current) {
            return;
        }

        const snapshot = getSnapshot(scrollKey);
        if (snapshot.absoluteOffset <= 0) {
            hasRestoredScroll.current = true;
            currentScrollOffset.current = 0;
            return;
        }

        isRestoring.current = true;

        const anchorIndex = snapshot.anchorArticleId
            ? articles.findIndex((article) => article.id === snapshot.anchorArticleId)
            : -1;

        const timeoutId = setTimeout(() => {
            if (!flatListRef.current) {
                return;
            }

            if (anchorIndex >= 0) {
                flatListRef.current.scrollToIndex({
                    index: anchorIndex,
                    animated: false,
                    viewOffset: snapshot.anchorOffset,
                });

                requestAnimationFrame(() => {
                    if (!flatListRef.current) return;
                    flatListRef.current.scrollToOffset({
                        offset: snapshot.absoluteOffset,
                        animated: false,
                    });
                    currentScrollOffset.current = snapshot.absoluteOffset;
                    completeRestore();
                });
                return;
            }

            flatListRef.current.scrollToOffset({
                offset: snapshot.absoluteOffset,
                animated: false,
            });
            currentScrollOffset.current = snapshot.absoluteOffset;
            completeRestore();
        }, 120);

        return () => clearTimeout(timeoutId);
    }, [articles, scrollKey, restoreAttempt, completeRestore]);

    const updateSnapshot = useCallback((nextOffset: number) => {
        scrollSnapshots[scrollKey] = {
            absoluteOffset: nextOffset,
            anchorArticleId: currentAnchorId.current,
            anchorOffset: currentAnchorOffset.current,
        };
    }, [scrollKey]);

    const saveScrollPosition = useCallback(() => {
        updateSnapshot(currentScrollOffset.current);
    }, [updateSnapshot]);

    const handleScroll = useCallback((e: any) => {
        if (!hasRestoredScroll.current || isRestoring.current || isPrependCompensating.current) {
            return;
        }

        const offset = e.nativeEvent.contentOffset.y;
        currentScrollOffset.current = offset;

        if (offset >= 0) {
            updateSnapshot(offset);
        }
    }, [updateSnapshot]);

    const articlesRef = useRef(articles);
    useEffect(() => {
        articlesRef.current = articles;
    }, [articles]);

    const [onViewableItemsChanged] = useState(() => ({ viewableItems }: any) => {
        const currentArticles = articlesRef.current;
        const visibleItems = viewableItems
            .filter((item: any) => item.isViewable && item.item?.id != null);

        if (visibleItems.length > 0) {
            const firstVisible = visibleItems[0];
            currentAnchorId.current = firstVisible.item.id;
            currentAnchorIndex.current = firstVisible.index ?? 0;
            currentAnchorOffset.current = Math.max(0, currentScrollOffset.current);

            const lastIndex = visibleItems[visibleItems.length - 1].index;
            if (currentArticles && currentArticles.length > lastIndex + 1) {
                const nextArticles = currentArticles.slice(lastIndex + 1, lastIndex + 4);
                nextArticles.forEach((article) => prefetchArticle(article.id));
            }
        }
    });

    const prepareForNewArticles = useCallback((newArticlesCount: number) => {
        if (newArticlesCount <= 0) return;

        const snapshot = getSnapshot(scrollKey);
        if (snapshot.absoluteOffset <= 50 || isRestoring.current) {
            pendingNewArticlesCount.current = 0;
            prependCompensationSnapshot.current = null;
            isPrependCompensating.current = false;
            return;
        }

        currentScrollOffset.current = snapshot.absoluteOffset;
        pendingNewArticlesCount.current = newArticlesCount;
        prependCompensationSnapshot.current = snapshot;
        isPrependCompensating.current = true;
    }, [scrollKey]);

    useEffect(() => {
        if (!isPrependCompensating.current || pendingNewArticlesCount.current <= 0 || !flatListRef.current) {
            return;
        }

        const compensationSnapshot = prependCompensationSnapshot.current;
        const previousAnchorId = compensationSnapshot?.anchorArticleId;
        if (!previousAnchorId) {
            isPrependCompensating.current = false;
            pendingNewArticlesCount.current = 0;
            prependCompensationSnapshot.current = null;
            return;
        }

        const timeoutId = setTimeout(() => {
            const targetIndex = articles.findIndex((article) => article.id === previousAnchorId);
            if (targetIndex >= 0 && flatListRef.current) {
                flatListRef.current.scrollToIndex({
                    index: targetIndex,
                    animated: false,
                    viewOffset: compensationSnapshot?.anchorOffset ?? 0,
                });
            }

            setTimeout(() => {
                isPrependCompensating.current = false;
                pendingNewArticlesCount.current = 0;
                prependCompensationSnapshot.current = null;
            }, 60);
        }, 80);

        return () => clearTimeout(timeoutId);
    }, [articles, scrollKey]);

    const scrollToTop = useCallback((animated = true) => {
        if (!flatListRef.current) return;

        flatListRef.current.scrollToOffset({ offset: 0, animated });
        currentScrollOffset.current = 0;
        currentAnchorId.current = articles[0]?.id ?? null;
        currentAnchorOffset.current = 0;
        updateSnapshot(0);
    }, [articles, updateSnapshot]);

    const isAtTop = useCallback(() => {
        return getSnapshot(scrollKey).absoluteOffset < 50;
    }, [scrollKey]);

    const shouldMaintainVisibleContentPosition = useCallback(() => {
        if (!hasRestoredScroll.current || isRestoring.current || isPrependCompensating.current) {
            return false;
        }

        return getSnapshot(scrollKey).absoluteOffset < 50;
    }, [scrollKey]);

    const handleScrollToIndexFailed = useCallback((info: {
        index: number;
        averageItemLength: number;
    }) => {
        if (!flatListRef.current) return;

        flatListRef.current.scrollToOffset({
            offset: info.index * Math.max(info.averageItemLength, 120),
            animated: false,
        });
    }, []);

    return {
        flatListRef,
        onViewableItemsChanged,
        handleScroll,
        handleScrollToIndexFailed,
        saveScrollPosition,
        scrollToTop,
        isAtTop,
        shouldMaintainVisibleContentPosition,
        prepareForNewArticles,
    };
};
