import { useRef, useState, useEffect, useCallback } from 'react';
import { FlatList, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useArticleStore } from '@/stores';

// Global ref to store scroll positions outside of React lifecycle
// Keyed by filter configuration so each view has its own scroll position
const scrollPositions: Record<string, number> = {};

// Generate a unique key based on filter configuration
function getScrollKey(filter: any): string {
    // Build a key from the filter state
    const parts: string[] = ['timeline'];

    if (filter.unread_only) parts.push('unread');
    if (filter.type) parts.push(`type:${filter.type}`);
    if (filter.feed_id) parts.push(`feed:${filter.feed_id}`);
    if (filter.folder_id) parts.push(`folder:${filter.folder_id}`);

    // Default view (All Articles with no filters)
    if (parts.length === 1) {
        return 'timeline:all';
    }

    return parts.join(':');
}

export const useTimelineScroll = (articles: any[], filter: any) => {
    const { prefetchArticle } = useArticleStore();
    const [isScrollRestored, setIsScrollRestored] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const hasRestoredScroll = useRef(false);
    const pendingScrollPosition = useRef<number | null>(null);
    const currentScrollKey = useRef<string>('');

    // Scroll compensation refs for Twitter/X-style prepending
    const contentHeightBeforeUpdate = useRef<number>(0);
    const scrollOffsetBeforeUpdate = useRef<number>(0);
    const firstArticleIdBeforeUpdate = useRef<number | null>(null);
    const isCompensatingScroll = useRef(false);
    const pendingNewArticlesCount = useRef<number>(0);

    // Generate scroll key based on current filter
    const scrollKey = getScrollKey(filter);

    // Reset scroll restoration when filter changes (view switches)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Resetting state on filter change
    useEffect(() => {
        // Only reset if the key actually changed
        if (currentScrollKey.current !== scrollKey) {
            hasRestoredScroll.current = false;
            setIsScrollRestored(false);
            pendingScrollPosition.current = null;
            currentScrollKey.current = scrollKey;
        }
    }, [scrollKey]);

    // Reset scroll restoration when screen regains focus (e.g., returning from article)
    // This ensures scroll position is restored when navigating back to timeline
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Intentional deps for focus handling
    useFocusEffect(
        useCallback(() => {
            // Only reset if we have a saved position to restore to
            const savedPosition = scrollPositions[scrollKey] || 0;
            if (savedPosition > 0 && hasRestoredScroll.current) {
                // Reset to allow scroll restoration
                hasRestoredScroll.current = false;
                setIsScrollRestored(false);
            }
        }, [scrollKey])
    );

    // Restore scroll position when articles are loaded
    useEffect(() => {
        if (hasRestoredScroll.current) {
            return;
        }

        const savedPosition = scrollPositions[scrollKey] || 0;

        // If there's no saved position, we're done
        if (savedPosition <= 0) {
            hasRestoredScroll.current = true;
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Scroll restoration complete
            setIsScrollRestored(true);
            return;
        }

        // If we have a saved position but no articles yet, wait for articles
        if (articles.length === 0) {
            return;
        }

        if (flatListRef.current) {
            // Store the position we want to scroll to
            pendingScrollPosition.current = savedPosition;

            // Use a slightly longer delay to ensure FlatList has fully rendered items
            const timeoutId = setTimeout(() => {
                if (flatListRef.current && pendingScrollPosition.current !== null) {
                    flatListRef.current.scrollToOffset({
                        offset: pendingScrollPosition.current,
                        animated: false
                    });

                    // Small additional delay before allowing scroll tracking to resume
                    // This prevents the scrollToOffset event itself from being tracked
                    setTimeout(() => {
                        hasRestoredScroll.current = true;
                        pendingScrollPosition.current = null;
                        setIsScrollRestored(true);
                    }, 50);
                }
            }, 250); // Increased delay for layout stability

            return () => clearTimeout(timeoutId);
        }
    }, [articles.length, scrollKey]);

    // Track new articles and prepare for scroll compensation
    const prepareForNewArticles = useCallback((newArticlesCount: number) => {
        if (!flatListRef.current || newArticlesCount <= 0) return;

        // Store current scroll position and content height
        flatListRef.current?.getScrollableNode?.().then?.((node: any) => {
            if (node) {
                scrollOffsetBeforeUpdate.current = node.scrollTop || 0;
                contentHeightBeforeUpdate.current = node.scrollHeight || 0;
            }
        }).catch(() => {
            // Fallback: try to get from native event if available
        });

        // Store the first visible article ID to find it after update
        if (articles.length > 0) {
            firstArticleIdBeforeUpdate.current = articles[0]?.id ?? null;
        }

        pendingNewArticlesCount.current = newArticlesCount;
        isCompensatingScroll.current = true;
    }, [articles]);

    // Apply scroll compensation after new articles are added
    const applyScrollCompensation = useCallback(() => {
        if (!isCompensatingScroll.current || !flatListRef.current) {
            isCompensatingScroll.current = false;
            return;
        }

        // Only compensate if user was not at the top (scroll offset > 0)
        if (scrollOffsetBeforeUpdate.current <= 10) {
            isCompensatingScroll.current = false;
            pendingNewArticlesCount.current = 0;
            return;
        }

        // Find the index of the first article that was visible before
        let targetIndex = -1;
        if (firstArticleIdBeforeUpdate.current) {
            targetIndex = articles.findIndex(a => a.id === firstArticleIdBeforeUpdate.current);
        }

        // If we found the previously first article, scroll to it
        if (targetIndex > 0 && targetIndex < pendingNewArticlesCount.current + 5) {
            // Use a small delay to let FlatList measure the new content
            requestAnimationFrame(() => {
                // Calculate approximate height of new items
                // We estimate based on the standard article card height (~120-150px)
                const estimatedItemHeight = 140;
                const newContentHeight = pendingNewArticlesCount.current * estimatedItemHeight;

                // Scroll to maintain the same visual position
                const targetOffset = scrollOffsetBeforeUpdate.current + newContentHeight;

                flatListRef.current?.scrollToOffset({
                    offset: targetOffset,
                    animated: false
                });

                // Update saved scroll position
                scrollPositions[scrollKey] = targetOffset;

                // Reset compensation state
                setTimeout(() => {
                    isCompensatingScroll.current = false;
                    pendingNewArticlesCount.current = 0;
                }, 50);
            });
        } else {
            isCompensatingScroll.current = false;
            pendingNewArticlesCount.current = 0;
        }
    }, [articles, scrollKey]);

    // Effect to apply scroll compensation when articles change
    useEffect(() => {
        if (isCompensatingScroll.current && pendingNewArticlesCount.current > 0) {
            // Small delay to allow FlatList to render the new items
            const timeoutId = setTimeout(() => {
                applyScrollCompensation();
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [articles.length, applyScrollCompensation]);

    // Save scroll position to global ref with the current filter key
    const saveScrollPosition = useCallback(() => {
        const position = pendingScrollPosition.current || scrollPositions[scrollKey] || 0;
        scrollPositions[scrollKey] = position;
    }, [scrollKey]);

    // Track scroll position in real-time for the current view
    const handleScroll = useCallback((e: any) => {
        // IMPORTANT: Ignore scroll events during restoration/compensation to prevent overwriting saved position
        if (!hasRestoredScroll.current || pendingScrollPosition.current !== null || isCompensatingScroll.current) {
            return;
        }

        const offset = e.nativeEvent.contentOffset.y;

        // Only save if it's a valid positive offset to avoid jitter
        if (offset > 0) {
            scrollPositions[scrollKey] = offset;
        }
    }, [scrollKey]);

    // Prefetch articles as user scrolls
    const articlesRef = useRef(articles);
    useEffect(() => {
        articlesRef.current = articles;
    }, [articles]);

    const [onViewableItemsChanged] = useState(() => ({ viewableItems }: any) => {
        const currentArticles = articlesRef.current;
        if (viewableItems.length > 0) {
            const lastIndex = viewableItems[viewableItems.length - 1].index;
            if (currentArticles && currentArticles.length > lastIndex + 1) {
                const nextArticles = currentArticles.slice(lastIndex + 1, lastIndex + 4);
                nextArticles.forEach(a => prefetchArticle(a.id));
            }
        }
    });

    // Scroll to top function
    const scrollToTop = useCallback((animated = true) => {
        if (flatListRef.current) {
            flatListRef.current.scrollToOffset({
                offset: 0,
                animated
            });
            scrollPositions[scrollKey] = 0;
        }
    }, [scrollKey]);

    // Check if currently at top
    const isAtTop = useCallback(() => {
        return (scrollPositions[scrollKey] || 0) < 50;
    }, [scrollKey]);

    return {
        flatListRef,
        isScrollRestored,
        onViewableItemsChanged,
        handleScroll,
        saveScrollPosition,
        scrollToTop,
        isAtTop,
        prepareForNewArticles,
        applyScrollCompensation,
    };
};
