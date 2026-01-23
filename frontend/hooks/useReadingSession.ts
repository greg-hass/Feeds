import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api } from '@/services/api';

interface ReadingSessionOptions {
    articleId: number;
    enabled?: boolean;
}

/**
 * Hook to track reading sessions with analytics
 * Automatically starts session on mount, tracks scroll depth, and ends on unmount
 */
export function useReadingSession({ articleId, enabled = true }: ReadingSessionOptions) {
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [scrollDepth, setScrollDepth] = useState(0);
    const startTimeRef = useRef<number>(Date.now());
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const scrollUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Start session
    const startSession = useCallback(async () => {
        if (!enabled) return;

        try {
            const response = await api.post<{ session_id: number }>('/analytics/session/start', {
                article_id: articleId,
            });
            setSessionId(response.session_id);
            startTimeRef.current = Date.now();
        } catch (error) {
            console.error('[Analytics] Failed to start session:', error);
        }
    }, [articleId, enabled]);

    // End session
    const endSession = useCallback(async (completed: boolean = false) => {
        if (!sessionId) return;

        try {
            await api.post('/analytics/session/end', {
                session_id: sessionId,
                scroll_depth_percent: scrollDepth,
                completed,
            });
        } catch (error) {
            console.error('[Analytics] Failed to end session:', error);
        } finally {
            setSessionId(null);
        }
    }, [sessionId, scrollDepth]);

    // Update scroll depth (debounced)
    const updateScrollDepth = useCallback((depth: number) => {
        setScrollDepth(depth);

        // Debounce API updates to avoid excessive requests
        if (scrollUpdateTimerRef.current) {
            clearTimeout(scrollUpdateTimerRef.current);
        }

        scrollUpdateTimerRef.current = setTimeout(async () => {
            if (!sessionId) return;

            try {
                await api.post('/analytics/session/scroll', {
                    session_id: sessionId,
                    scroll_depth_percent: depth,
                });
            } catch (error) {
                console.error('[Analytics] Failed to update scroll depth:', error);
            }
        }, 2000); // Update every 2 seconds max
    }, [sessionId]);

    // Calculate completion based on scroll depth and time
    const isCompleted = useCallback((): boolean => {
        const timeSpent = (Date.now() - startTimeRef.current) / 1000; // seconds

        // Consider completed if:
        // - Scrolled past 80% AND spent at least 10 seconds
        // - OR scrolled to 100%
        return (scrollDepth >= 80 && timeSpent >= 10) || scrollDepth >= 100;
    }, [scrollDepth]);

    // Start session on mount
    useEffect(() => {
        startSession();

        return () => {
            // End session on unmount
            if (sessionId) {
                const completed = isCompleted();
                endSession(completed);
            }
        };
    }, [articleId]); // Only restart if article changes

    // Handle app state changes (background/foreground)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            // App going to background
            if (
                appStateRef.current.match(/active/) &&
                nextAppState.match(/inactive|background/)
            ) {
                if (sessionId) {
                    const completed = isCompleted();
                    endSession(completed);
                }
            }

            // App coming to foreground
            if (
                appStateRef.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                if (!sessionId && enabled) {
                    startSession();
                }
            }

            appStateRef.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [sessionId, enabled, endSession, startSession, isCompleted]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (scrollUpdateTimerRef.current) {
                clearTimeout(scrollUpdateTimerRef.current);
            }
        };
    }, []);

    return {
        sessionId,
        updateScrollDepth,
        endSession: (completed: boolean = false) => endSession(completed),
    };
}

/**
 * Calculate scroll depth percentage from scroll event
 */
export function calculateScrollDepth(
    scrollY: number,
    contentHeight: number,
    containerHeight: number
): number {
    const scrollableHeight = Math.max(contentHeight - containerHeight, 1);
    const depth = Math.round((scrollY / scrollableHeight) * 100);
    return Math.min(Math.max(depth, 0), 100);
}
