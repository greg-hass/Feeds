import { useState, useEffect, useCallback, useRef } from 'react';
import { Animated, Alert, AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { useArticleStore, useFeedStore, useAudioStore, useVideoStore, useDigestStore, useSettingsStore } from '@/stores';
import { extractVideoId } from '@/utils/youtube';
import { Article } from '@/services/api';

export const useTimeline = (onArticlePress?: (article: Article) => void) => {
    const router = useRouter();
    const { articles, isLoading, hasMore, filter, fetchArticles, setFilter, markAllRead, prefetchArticle } = useArticleStore();
    const { feeds, folders, refreshAllFeeds, isLoading: isFeedLoading, refreshProgress, isBackgroundRefreshing } = useFeedStore();
    const { currentArticleId: playingArticleId, isPlaying, play, pause, resume } = useAudioStore();
    const { activeVideoId, playVideo } = useVideoStore();
    const { fetchPendingDigest } = useDigestStore();
    const { settings, globalNextRefreshAt } = useSettingsStore();

    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    
    // Track app state for pausing timers and animations
    const appStateRef = useRef<AppStateStatus>('active');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        fetchPendingDigest();
    }, []);

    const isRefreshing = isFeedLoading || !!refreshProgress || isBackgroundRefreshing;

    // Function to start the refresh timer
    const startTimer = useCallback(() => {
        if (timerRef.current) return; // Already running
        
        let hasFetchedForCurrentCycle = false;
        
        timerRef.current = setInterval(() => {
            if (!globalNextRefreshAt) {
                setTimeLeft(null);
                hasFetchedForCurrentCycle = false;
                return;
            }

            const now = Date.now();
            const nextRefresh = new Date(globalNextRefreshAt).getTime();
            const diff = nextRefresh - now;

            if (diff <= 0) {
                setTimeLeft('0s');
                const currentIsRefreshing = useFeedStore.getState().isLoading ||
                    !!useFeedStore.getState().refreshProgress ||
                    useFeedStore.getState().isBackgroundRefreshing;
                if (diff < -10000 && !currentIsRefreshing && !hasFetchedForCurrentCycle) {
                    hasFetchedForCurrentCycle = true;
                    useSettingsStore.getState().fetchSettings().catch(() => { });
                }
            } else {
                hasFetchedForCurrentCycle = false;
                if (diff < 60000) {
                    setTimeLeft(`${Math.floor(diff / 1000)}s`);
                } else if (diff < 3600000) {
                    setTimeLeft(`${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`);
                } else {
                    setTimeLeft(`${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`);
                }
            }
        }, 1000);
    }, [globalNextRefreshAt]);

    // Function to stop the refresh timer
    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Handle app state changes for timer
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const previousState = appStateRef.current;
            appStateRef.current = nextAppState;

            if (nextAppState === 'active' && previousState !== 'active') {
                // App came to foreground - restart timer
                startTimer();
            } else if (nextAppState !== 'active' && previousState === 'active') {
                // App went to background - stop timer to save battery
                stopTimer();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Start timer on mount if app is active
        if (appStateRef.current === 'active') {
            startTimer();
        }

        return () => {
            subscription.remove();
            stopTimer();
        };
    }, [startTimer, stopTimer]);

    const [hotPulseAnim] = useState(() => new Animated.Value(1));
    const [bookmarkScales] = useState(() => new Map<number, Animated.Value>());
    const [bookmarkRotations] = useState(() => new Map<number, Animated.Value>());

    // Function to start the HOT badge animation
    const startAnimation = useCallback(() => {
        if (animationRef.current) return; // Already running
        
        animationRef.current = Animated.loop(
            Animated.sequence([
                Animated.timing(hotPulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
                Animated.timing(hotPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        );
        animationRef.current.start();
    }, [hotPulseAnim]);

    // Function to stop the HOT badge animation
    const stopAnimation = useCallback(() => {
        if (animationRef.current) {
            animationRef.current.stop();
            animationRef.current = null;
        }
    }, []);

    // Handle app state changes for animation
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const previousState = appStateRef.current;

            if (nextAppState === 'active' && previousState !== 'active') {
                // App came to foreground - restart animation
                startAnimation();
            } else if (nextAppState !== 'active' && previousState === 'active') {
                // App went to background - stop animation to save battery
                stopAnimation();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Start animation on mount if app is active
        if (appStateRef.current === 'active') {
            startAnimation();
        }

        return () => {
            subscription.remove();
            stopAnimation();
        };
    }, [startAnimation, stopAnimation]);

    const getBookmarkScale = (id: number) => {
        if (!bookmarkScales.has(id)) bookmarkScales.set(id, new Animated.Value(1));
        return bookmarkScales.get(id)!;
    };

    const getBookmarkRotation = (id: number) => {
        if (!bookmarkRotations.has(id)) bookmarkRotations.set(id, new Animated.Value(0));
        return bookmarkRotations.get(id)!;
    };

    const handleMarkAllRead = () => {
        Alert.alert('Mark All Read', 'Mark visible articles as read?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Mark Read',
                onPress: () => {
                    if (filter.feed_id) markAllRead('feed', filter.feed_id);
                    else if (filter.folder_id) markAllRead('folder', filter.folder_id);
                    else if (filter.type) markAllRead('type', undefined, filter.type);
                    else markAllRead('all');
                }
            }
        ]);
    };

    const handleArticlePress = useCallback((item: Article) => {
        useArticleStore.getState().markRead(item.id);
        if (onArticlePress) onArticlePress(item);
        else router.push(`/(app)/article/${item.id}`);
    }, [onArticlePress, router]);

    const handlePlayPress = useCallback((item: Article) => {
        if (playingArticleId === item.id) {
            isPlaying ? pause() : resume();
        } else {
            play({
                id: item.id,
                url: item.enclosure_url || item.url || '',
                title: item.title,
                author: item.feed_title || 'Unknown Source',
                coverArt: item.thumbnail_url || item.feed_icon_url || ''
            });
        }
    }, [playingArticleId, isPlaying, play, pause, resume]);

    const handleVideoPress = useCallback((item: Article) => {
        const videoId = extractVideoId(item.url || '');
        if (videoId) playVideo(videoId, item.title);
        else handleArticlePress(item);
    }, [playVideo, handleArticlePress]);

    const headerTitle = (() => {
        if (filter.folder_id) return folders.find(f => f.id === filter.folder_id)?.name || 'Folder';
        if (filter.feed_id) return feeds.find(f => f.id === filter.feed_id)?.title || 'Feed';
        if (filter.type) {
            return { youtube: 'YouTube', podcast: 'Podcasts', reddit: 'Reddit', rss: 'RSS' }[filter.type] || filter.type;
        }
        return 'All Articles';
    })();

    return {
        articles, isLoading, hasMore, filter, feeds, isFeedLoading, headerTitle, timeLeft, isRefreshing, refreshProgress,
        playingArticleId, isPlaying, activeVideoId, hotPulseAnim,
        fetchArticles, setFilter, refreshAllFeeds, handleMarkAllRead, handleArticlePress,
        handlePlayPress, handleVideoPress, getBookmarkScale, getBookmarkRotation, prefetchArticle,
    };
};
