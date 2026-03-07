import { useState, useEffect, useCallback, useMemo } from 'react';
import { Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useArticleStore, useFeedStore, useAudioStore, useVideoStore, useDigestStore } from '@/stores';
import { extractVideoId } from '@/utils/youtube';
import { Article } from '@/services/api';

export const useTimeline = (onArticlePress?: (article: Article) => void) => {
    const router = useRouter();
    const { articles, isLoading, hasMore, filter, fetchArticles, setFilter, markAllRead, prefetchArticle } = useArticleStore();
    const { feeds, folders, refreshAllFeeds, isLoading: isFeedLoading, refreshState } = useFeedStore();
    const { currentArticleId: playingArticleId, isPlaying, play, pause, resume } = useAudioStore();
    const { activeVideoId, playVideo } = useVideoStore();
    const { fetchPendingDigest } = useDigestStore();

    useEffect(() => {
        fetchPendingDigest();
    }, []);

    const isRefreshing = refreshState.phase === 'refreshing' || refreshState.phase === 'syncing';
    const lastRefreshed = refreshState.lastCompletedAt ? new Date(refreshState.lastCompletedAt) : null;
    const refreshStatus = useMemo(() => {
        const completedAt = refreshState.lastCompletedAt ? new Date(refreshState.lastCompletedAt) : null;
        const staleSince = refreshState.staleSince ? new Date(refreshState.staleSince) : null;
        const shouldDisplayStale = (() => {
            if (!staleSince) return false;
            if (!completedAt) return true;
            return Date.now() - completedAt.getTime() > 10 * 60 * 1000;
        })();
        const formatAge = (date: Date | null) => {
            if (!date) return null;
            const diffMs = Date.now() - date.getTime();
            const minutes = Math.floor(diffMs / 60000);
            if (minutes < 1) return 'just now';
            if (minutes < 60) return `${minutes}m ago`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            return `${days}d ago`;
        };

        if (refreshState.phase === 'refreshing') {
            return {
                label: refreshState.message || 'Refreshing feeds…',
                refreshText: 'Refreshing…',
            };
        }

        if (refreshState.phase === 'syncing') {
            return {
                label: refreshState.message || 'Checking for updates…',
                refreshText: 'Syncing…',
            };
        }

        if (refreshState.phase === 'error') {
            return {
                label: refreshState.error ? `Refresh failed: ${refreshState.error}` : 'Refresh failed',
                refreshText: 'Refresh failed',
            };
        }

        if (shouldDisplayStale) {
            return {
                label: completedAt ? `Stale. Last updated ${formatAge(completedAt)}` : 'Stale. Refresh needed',
                refreshText: 'Stale',
            };
        }

        return {
            label: completedAt ? `Updated ${formatAge(completedAt)}` : 'Awaiting first refresh',
            refreshText: 'Up to date',
        };
    }, [refreshState]);

    const [hotPulseAnim] = useState(() => new Animated.Value(1));
    const [bookmarkScales] = useState(() => new Map<number, Animated.Value>());
    const [bookmarkRotations] = useState(() => new Map<number, Animated.Value>());

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
        articles, isLoading, hasMore, filter, feeds, isFeedLoading, headerTitle, lastRefreshed, isRefreshing, refreshStatus, refreshState,
        playingArticleId, isPlaying, activeVideoId, hotPulseAnim,
        fetchArticles, setFilter, refreshAllFeeds, handleMarkAllRead, handleArticlePress,
        handlePlayPress, handleVideoPress, getBookmarkScale, getBookmarkRotation, prefetchArticle,
    };
};
