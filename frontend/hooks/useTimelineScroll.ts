import { useRef, useState, useEffect } from 'react';
import { FlatList } from 'react-native';
import { useArticleStore } from '@/stores';

export const useTimelineScroll = (articles: any[], filter: any) => {
    const { scrollPosition, setScrollPosition, prefetchArticle } = useArticleStore();
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

        if (articles.length > 0 && scrollPosition > 0 && flatListRef.current) {
            // Store the position we want to scroll to
            pendingScrollPosition.current = scrollPosition;
            
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
        } else if (scrollPosition === 0 || articles.length === 0) {
            hasRestoredScroll.current = true;
            setIsScrollRestored(true);
        }
    }, [articles.length, scrollPosition]);

    // Prefetch articles as user scrolls
    const articlesRef = useRef(articles);
    useEffect(() => {
        articlesRef.current = articles;
    }, [articles]);

    // Prefetch articles as user scrolls
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

    const handleScroll = (e: any) => {
        const offset = e.nativeEvent.contentOffset.y;
        setScrollPosition(offset);
    };

    return {
        flatListRef,
        isScrollRestored,
        onViewableItemsChanged,
        handleScroll,
    };
};
