import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useArticleStore, useFeedStore, useAudioStore, useVideoStore, useDigestStore, useSettingsStore } from '@/stores';
import { extractVideoId } from '@/utils/youtube';
import { Article } from '@/services/api';

export const useTimeline = (onArticlePress?: (article: Article) => void) => {
    const router = useRouter();
    const { articles, isLoading, hasMore, filter, fetchArticles, setFilter, markAllRead } = useArticleStore();
    const { feeds, folders, refreshAllFeeds, isLoading: isFeedLoading, refreshProgress } = useFeedStore();
    const { currentArticleId: playingArticleId, isPlaying, play, pause, resume } = useAudioStore();
    const { activeVideoId, playVideo } = useVideoStore();
    const { fetchPendingDigest } = useDigestStore();
    const { settings, globalNextRefreshAt } = useSettingsStore();

    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        fetchPendingDigest();
    }, []);

    // Global refresh timer
    useEffect(() => {
        const timer = setInterval(() => {
            if (!globalNextRefreshAt) {
                setTimeLeft(null);
                return;
            }

            const now = Date.now();
            const nextRefresh = new Date(globalNextRefreshAt).getTime();
            const diff = nextRefresh - now;

            if (diff <= 0) {
                setTimeLeft('0s');
            } else if (diff < 60000) {
                setTimeLeft(`${Math.floor(diff / 1000)}s`);
            } else if (diff < 3600000) {
                setTimeLeft(`${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`);
            } else {
                setTimeLeft(`${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [globalNextRefreshAt]);

    const isRefreshing = !!refreshProgress;
    const hotPulseAnim = useRef(new Animated.Value(1)).current;
    const bookmarkScales = useRef<Map<number, Animated.Value>>(new Map());
    const bookmarkRotations = useRef<Map<number, Animated.Value>>(new Map());

    // HOT badge pulse animation
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(hotPulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
                Animated.timing(hotPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    const getBookmarkScale = (id: number) => {
        if (!bookmarkScales.current.has(id)) bookmarkScales.current.set(id, new Animated.Value(1));
        return bookmarkScales.current.get(id)!;
    };

    const getBookmarkRotation = (id: number) => {
        if (!bookmarkRotations.current.has(id)) bookmarkRotations.current.set(id, new Animated.Value(0));
        return bookmarkRotations.current.get(id)!;
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
        articles, isLoading, hasMore, filter, feeds, isFeedLoading, headerTitle, timeLeft, isRefreshing,
        playingArticleId, isPlaying, activeVideoId, hotPulseAnim,
        fetchArticles, setFilter, refreshAllFeeds, handleMarkAllRead, handleArticlePress,
        handlePlayPress, handleVideoPress, getBookmarkScale, getBookmarkRotation,
    };
};
