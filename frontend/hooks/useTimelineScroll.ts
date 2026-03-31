import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useArticleStore } from '@/stores/articleStore';

type TimelineArticle = { id: number };

type TimelineFilter = {
    unread_only?: boolean;
    type?: string;
    feed_id?: number;
    folder_id?: number;
};

type ScrollSnapshot = {
    absoluteOffset: number;
    anchorArticleId: number | null;
    restoreArticleId: number | null;
};

const EMPTY_SNAPSHOT: ScrollSnapshot = {
    absoluteOffset: 0,
    anchorArticleId: null,
    restoreArticleId: null,
};

function getScrollKey(filter: TimelineFilter): string {
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
    return useArticleStore.getState().getTimelineScrollSnapshot(scrollKey);
}

function setSnapshot(scrollKey: string, snapshot: ScrollSnapshot) {
    useArticleStore.getState().setTimelineScrollSnapshot(scrollKey, snapshot);
}

export const __timelineScrollTestUtils = {
    getScrollKey,
    getSnapshot,
    setSnapshot,
    clearSnapshots: () => {
        useArticleStore.getState().clearTimelineScrollSnapshots();
    },
};

export const useTimelineScroll = (articles: TimelineArticle[], filter: TimelineFilter) => {
    const prefetchArticle = useArticleStore((state) => state.prefetchArticle);
    const [restoreAttempt, setRestoreAttempt] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const [isFlatListReady, setIsFlatListReady] = useState(false);
    const articlesRef = useRef(articles);
    const prefetchArticleRef = useRef(prefetchArticle);
    const currentScrollKey = useRef('');
    const hasRestoredScroll = useRef(false);
    const isRestoring = useRef(false);
    const isPrependCompensating = useRef(false);
    const prependCompensationSnapshot = useRef<ScrollSnapshot | null>(null);
    const currentScrollOffset = useRef(0);
    const currentAnchorId = useRef<number | null>(null);

    const attachFlatListRef = useCallback((node: FlatList | null) => {
        flatListRef.current = node;
        setIsFlatListReady(Boolean(node));
    }, []);

    useEffect(() => {
        articlesRef.current = articles;
    }, [articles]);

    useEffect(() => {
        prefetchArticleRef.current = prefetchArticle;
    }, [prefetchArticle]);

    const scrollKey = getScrollKey(filter);

    useEffect(() => {
        if (currentScrollKey.current === scrollKey) {
            return;
        }

        const snapshot = getSnapshot(scrollKey);
        currentScrollKey.current = scrollKey;
        currentScrollOffset.current = snapshot.absoluteOffset;
        currentAnchorId.current = snapshot.anchorArticleId;
        hasRestoredScroll.current = false;
        isRestoring.current = false;
        isPrependCompensating.current = false;
        prependCompensationSnapshot.current = null;
    }, [scrollKey]);

    const updateSnapshot = useCallback((
        nextOffset: number,
        overrides: Partial<ScrollSnapshot> = {},
    ) => {
        const safeOffset = Math.max(nextOffset, 0);
        const currentSnapshot = getSnapshot(scrollKey);
        setSnapshot(scrollKey, {
            absoluteOffset: safeOffset,
            anchorArticleId: overrides.anchorArticleId ?? currentAnchorId.current,
            restoreArticleId: overrides.restoreArticleId ?? currentSnapshot.restoreArticleId,
        });
    }, [scrollKey]);

    const updateCurrentSnapshot = useCallback((offset: number) => {
        currentScrollOffset.current = offset;
        updateSnapshot(offset);
    }, [updateSnapshot]);

    const markRestoreComplete = useCallback(() => {
        hasRestoredScroll.current = true;
        isRestoring.current = false;
    }, []);

    const restoreFromSnapshot = useCallback((snapshot: ScrollSnapshot) => {
        const list = flatListRef.current;
        if (!list) {
            return false;
        }

        if (snapshot.restoreArticleId != null) {
            const restoreIndex = articlesRef.current.findIndex((article) => article.id === snapshot.restoreArticleId);
            if (restoreIndex >= 0) {
                list.scrollToIndex({
                    index: restoreIndex,
                    animated: false,
                    viewPosition: 0,
                });
                currentAnchorId.current = snapshot.restoreArticleId;
                setSnapshot(scrollKey, {
                    ...snapshot,
                    restoreArticleId: null,
                });
                markRestoreComplete();
                return true;
            }
        }

        if (snapshot.absoluteOffset <= 0) {
            currentScrollOffset.current = 0;
            markRestoreComplete();
            return true;
        }

        list.scrollToOffset({
            offset: snapshot.absoluteOffset,
            animated: false,
        });
        currentScrollOffset.current = snapshot.absoluteOffset;
        markRestoreComplete();
        return true;
    }, [markRestoreComplete, scrollKey]);

    useFocusEffect(
        useCallback(() => {
            const snapshot = getSnapshot(scrollKey);
            if (snapshot.absoluteOffset > 0) {
                hasRestoredScroll.current = false;
                setRestoreAttempt((attempt) => attempt + 1);
            }
        }, [scrollKey])
    );

    useLayoutEffect(() => {
        if (!isFlatListReady || articles.length === 0 || hasRestoredScroll.current) {
            return;
        }

        isRestoring.current = true;
        const restored = restoreFromSnapshot(getSnapshot(scrollKey));
        if (!restored) {
            markRestoreComplete();
        }
    }, [articles.length, isFlatListReady, restoreAttempt, restoreFromSnapshot, scrollKey, markRestoreComplete]);

    const saveScrollPosition = useCallback((restoreArticleId?: number | null) => {
        updateSnapshot(currentScrollOffset.current, {
            restoreArticleId: restoreArticleId ?? null,
        });
    }, [updateSnapshot]);

    const handleScroll = useCallback((e: any) => {
        if (!hasRestoredScroll.current || isRestoring.current || isPrependCompensating.current) {
            return;
        }

        updateCurrentSnapshot(e.nativeEvent.contentOffset.y);
    }, [updateCurrentSnapshot]);

    const handleScrollEnd = useCallback((e: any) => {
        if (!hasRestoredScroll.current || isRestoring.current || isPrependCompensating.current) {
            return;
        }

        updateCurrentSnapshot(e.nativeEvent.contentOffset.y);
    }, [updateCurrentSnapshot]);

    const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
        const visibleItems = viewableItems.filter((item: any) => item.isViewable && item.item?.id != null);

        if (visibleItems.length === 0) {
            return;
        }

        const firstVisible = visibleItems[0];
        currentAnchorId.current = firstVisible.item.id;

        const lastIndex = visibleItems[visibleItems.length - 1].index;
        const currentArticles = articlesRef.current;
        if (currentArticles && currentArticles.length > lastIndex + 1) {
            const nextArticles = currentArticles.slice(lastIndex + 1, lastIndex + 4);
            nextArticles.forEach((article) => prefetchArticleRef.current(article.id));
        }
    }, []);

    const prepareForNewArticles = useCallback((newArticlesCount: number) => {
        if (newArticlesCount <= 0 || isRestoring.current) {
            return;
        }

        const snapshot = getSnapshot(scrollKey);
        if (snapshot.absoluteOffset <= 50 || snapshot.anchorArticleId == null) {
            isPrependCompensating.current = false;
            prependCompensationSnapshot.current = null;
            return;
        }

        currentScrollOffset.current = snapshot.absoluteOffset;
        isPrependCompensating.current = true;
        prependCompensationSnapshot.current = snapshot;
    }, [scrollKey]);

    useEffect(() => {
        if (!isPrependCompensating.current || !flatListRef.current) {
            return;
        }

        const compensationSnapshot = prependCompensationSnapshot.current;
        const previousAnchorId = compensationSnapshot?.anchorArticleId;
        if (previousAnchorId == null) {
            isPrependCompensating.current = false;
            prependCompensationSnapshot.current = null;
            return;
        }

        const targetIndex = articles.findIndex((article) => article.id === previousAnchorId);
        if (targetIndex < 0) {
            isPrependCompensating.current = false;
            prependCompensationSnapshot.current = null;
            return;
        }

        try {
            flatListRef.current.scrollToIndex({
                index: targetIndex,
                animated: false,
                viewPosition: 0,
            });
        } catch {
            flatListRef.current.scrollToOffset({
                offset: compensationSnapshot?.absoluteOffset ?? 0,
                animated: false,
            });
        }

        isPrependCompensating.current = false;
        prependCompensationSnapshot.current = null;
    }, [articles]);

    const scrollToTop = useCallback((animated = true) => {
        if (!flatListRef.current) return;

        flatListRef.current.scrollToOffset({ offset: 0, animated });
        currentScrollOffset.current = 0;
        currentAnchorId.current = articles[0]?.id ?? null;
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

        const snapshot = getSnapshot(scrollKey);
        flatListRef.current.scrollToOffset({
            offset: snapshot.absoluteOffset || (info.index * Math.max(info.averageItemLength, 120)),
            animated: false,
        });
    }, [scrollKey]);

    return {
        flatListRef,
        attachFlatListRef,
        onViewableItemsChanged,
        handleScroll,
        handleScrollEnd,
        handleScrollToIndexFailed,
        saveScrollPosition,
        scrollToTop,
        isAtTop,
        shouldMaintainVisibleContentPosition,
        prepareForNewArticles,
    };
};
