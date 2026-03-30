import { useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useArticleStore } from '@/stores/articleStore';
import { useFeedStore } from '@/stores/feedStore';
import { useAudioStore } from '@/stores/audioStore';
import { useVideoStore } from '@/stores/videoStore';
import { useDigestStore } from '@/stores/digestStore';
import { extractVideoId } from '@/utils/youtube';
import { Article } from '@/services/api';
import { getRefreshPresentation } from '@/utils/refreshStatus';
import { useShallow } from 'zustand/react/shallow';

export const useTimeline = (onArticlePress?: (article: Article) => void) => {
    const router = useRouter();
    const [articles, isLoading, hasMore, filter, fetchArticles, setFilter, markAllRead, prefetchArticle] = useArticleStore(
        useShallow((state) => [
            state.articles,
            state.isLoading,
            state.hasMore,
            state.filter,
            state.fetchArticles,
            state.setFilter,
            state.markAllRead,
            state.prefetchArticle,
        ])
    );
    const [feeds, folders, refreshAllFeeds, isFeedLoading, refreshState] = useFeedStore(
        useShallow((state) => [
            state.feeds,
            state.folders,
            state.refreshAllFeeds,
            state.isLoading,
            state.refreshState,
        ])
    );
    const [playingArticleId, isPlaying, play, pause, resume] = useAudioStore(
        useShallow((state) => [
            state.currentArticleId,
            state.isPlaying,
            state.play,
            state.pause,
            state.resume,
        ])
    );
    const [activeVideoId, playVideo] = useVideoStore(
        useShallow((state) => [state.activeVideoId, state.playVideo])
    );
    const fetchPendingDigest = useDigestStore((state) => state.fetchPendingDigest);

    useEffect(() => {
        fetchPendingDigest();
    }, [fetchPendingDigest]);

    const refreshPresentation = useMemo(() => getRefreshPresentation(refreshState), [refreshState]);
    const isRefreshing = refreshPresentation.isRefreshing;
    const lastRefreshed = refreshPresentation.lastRefreshedAt
        ? new Date(refreshPresentation.lastRefreshedAt)
        : null;
    const refreshStatus = useMemo(() => ({
        label: refreshPresentation.label,
        refreshText: refreshPresentation.shortLabel,
    }), [refreshPresentation]);

    const bookmarkScales = useRef(new Map<number, Animated.Value>());
    const bookmarkRotations = useRef(new Map<number, Animated.Value>());

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
            if (isPlaying) {
                pause();
            } else {
                resume();
            }
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
        playingArticleId, isPlaying, activeVideoId,
        fetchArticles, setFilter, refreshAllFeeds, handleMarkAllRead, handleArticlePress,
        handlePlayPress, handleVideoPress, getBookmarkScale, getBookmarkRotation, prefetchArticle,
    };
};
