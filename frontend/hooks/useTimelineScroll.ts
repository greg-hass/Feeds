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
            setIsScrollRestored(true);
            return;
        }

        const savedPosition = scrollPositions[scrollKey] || 0;

        if (articles.length > 0 && savedPosition > 0 && flatListRef.current) {
            // Store the position we want to scroll to
            pendingScrollPosition.current = savedPosition;
            
            // Use a small delay to ensure FlatList has rendered items
            const timeoutId = setTimeout(() => {
                if (flatListRef.current && pendingScrollPosition.current !== null) {
                    flatListRef.current.scrollToOffset({ 
                        offset: pendingScrollPosition.current, 
                        animated: false 
                    });
                    hasRestoredScroll.current = true;
                    pendingScrollPosition.current = null;
                    setIsScrollRestored(true);
                }
            }, 100);

            return () => clearTimeout(timeoutId);
        } else if (savedPosition === 0 || articles.length === 0) {
            hasRestoredScroll.current = true;
            setIsScrollRestored(true);
        }
    }, [articles.length, scrollKey]);

    // Save scroll position to global ref with the current filter key
    const saveScrollPosition = useCallback(() => {
        const position = pendingScrollPosition.current || scrollPositions[scrollKey] || 0;
        scrollPositions[scrollKey] = position;
    }, [scrollKey]);

    // Track scroll position in real-time for the current view
    const handleScroll = useCallback((e: any) => {
        const offset = e.nativeEvent.contentOffset.y;
        scrollPositions[scrollKey] = offset;
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
