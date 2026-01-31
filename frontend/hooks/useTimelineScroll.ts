import { useRef, useState, useEffect, useCallback } from 'react';
import { FlatList } from 'react-native';
import { useArticleStore } from '@/stores';

// Global ref to store scroll positions outside of React lifecycle
// This avoids hook dependency issues and circular imports
const scrollPositions = {
    timeline: 0,
    bookmarks: 0,
    search: 0,
};

export const useTimelineScroll = (articles: any[], filter: any) => {
    const { prefetchArticle } = useArticleStore();
    const [isScrollRestored, setIsScrollRestored] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const hasRestoredScroll = useRef(false);
    const pendingScrollPosition = useRef<number | null>(null);

    // Reset scroll restoration flag when component mounts or filter changes
    useEffect(() => {
        hasRestoredScroll.current = false;
        setIsScrollRestored(false);
        pendingScrollPosition.current = null;
    }, []);

    // Reset scroll restoration flag when filter changes
    useEffect(() => {
        hasRestoredScroll.current = false;
        setIsScrollRestored(false);
        pendingScrollPosition.current = null;
    }, [filter]);

    // Restore scroll position when articles are loaded
    useEffect(() => {
        if (hasRestoredScroll.current) {
            setIsScrollRestored(true);
            return;
        }

        const savedPosition = scrollPositions.timeline;

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
    }, [articles.length]);

    // Save scroll position to global ref
    const saveScrollPosition = useCallback(() => {
        scrollPositions.timeline = pendingScrollPosition.current || scrollPositions.timeline;
    }, []);

    // Track scroll position in real-time
    const handleScroll = useCallback((e: any) => {
        const offset = e.nativeEvent.contentOffset.y;
        scrollPositions.timeline = offset;
    }, []);

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