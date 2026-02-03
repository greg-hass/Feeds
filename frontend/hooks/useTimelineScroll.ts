import { useRef, useState, useEffect, useCallback } from 'react';
import { FlatList } from 'react-native';
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

    // Save scroll position to global ref with the current filter key
    const saveScrollPosition = useCallback(() => {
        const position = pendingScrollPosition.current || scrollPositions[scrollKey] || 0;
        scrollPositions[scrollKey] = position;
    }, [scrollKey]);

    // Track scroll position in real-time for the current view
    const handleScroll = useCallback((e: any) => {
        // IMPORTANT: Ignore scroll events during restoration to prevent overwriting saved position with 0 or jitter
        if (!hasRestoredScroll.current || pendingScrollPosition.current !== null) {
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

    return {
        flatListRef,
        isScrollRestored,
        onViewableItemsChanged,
        handleScroll,
        saveScrollPosition,
    };
};
