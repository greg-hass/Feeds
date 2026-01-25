import { useRef, useState, useEffect } from 'react';
import { FlatList } from 'react-native';
import { useArticleStore } from '@/stores';

export const useTimelineScroll = (articles: any[], filter: any) => {
    const { scrollPosition, setScrollPosition, prefetchArticle } = useArticleStore();
    const [isScrollRestored, setIsScrollRestored] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const hasRestoredScroll = useRef(false);

    // Reset scroll restoration flag when filter changes
    useEffect(() => {
        hasRestoredScroll.current = false;
        setIsScrollRestored(false);
    }, [filter]);

    // Restore scroll position when articles are loaded
    useEffect(() => {
        if (!hasRestoredScroll.current && articles.length > 0 && scrollPosition > 0 && flatListRef.current) {
            flatListRef.current?.scrollToOffset({ offset: scrollPosition, animated: false });
            hasRestoredScroll.current = true;
            setTimeout(() => setIsScrollRestored(true), 50);
        } else if (scrollPosition === 0 || articles.length === 0) {
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
