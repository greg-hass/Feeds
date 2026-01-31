import { useEffect, useRef, useCallback } from 'react';
import { Article } from '@/services/api';
import { scheduleIdle, canPrefetch } from '@/utils/scheduler';

interface UseArticlePrefetchOptions {
    articles: Article[];
    isLoading: boolean;
    isMobile: boolean;
    unreadOnly: boolean;
    prefetchArticle: (id: number) => Promise<void>;
}

/**
 * Hook to manage prefetching of article content
 * Prefetches the first N articles when idle to improve perceived performance
 */
export function useArticlePrefetch({
    articles,
    isLoading,
    isMobile,
    unreadOnly,
    prefetchArticle,
}: UseArticlePrefetchOptions) {
    const prefetchedRef = useRef<Set<number>>(new Set());

    // Clear prefetch cache when filters change
    useEffect(() => {
        prefetchedRef.current.clear();
    }, [unreadOnly]);

    const performPrefetch = useCallback(() => {
        if (isLoading || articles.length === 0) return;

        const prefetchCount = isMobile ? 8 : 16;
        const candidates = (unreadOnly ? articles.filter((article) => !article.is_read) : articles)
            .slice(0, prefetchCount);

        scheduleIdle(() => {
            canPrefetch().then((allowed) => {
                if (!allowed) return;
                
                candidates.forEach((article) => {
                    if (prefetchedRef.current.has(article.id)) return;
                    prefetchedRef.current.add(article.id);
                    prefetchArticle(article.id);
                });
            });
        });
    }, [articles, isLoading, isMobile, unreadOnly, prefetchArticle]);

    useEffect(() => {
        let cancelled = false;
        
        const runPrefetch = () => {
            if (!cancelled) {
                performPrefetch();
            }
        };
        
        runPrefetch();
        
        return () => {
            cancelled = true;
        };
    }, [performPrefetch]);

    return {
        clearPrefetchCache: () => prefetchedRef.current.clear(),
    };
}
