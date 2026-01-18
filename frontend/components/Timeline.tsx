import { useEffect, useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, Linking, Image, useWindowDimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useFeedStore } from '@/stores';
import { Article } from '@/services/api';
import { Circle, CircleCheck, Play, Bookmark, MoreVertical, CheckCheck, AlertTriangle } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getThumbnailUrl, getEmbedUrl } from '@/utils/youtube';

interface TimelineProps {
    onArticlePress?: (article: Article) => void;
    activeArticleId?: number | null;
}

export default function Timeline({ onArticlePress, activeArticleId }: TimelineProps) {
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const { articles, isLoading, hasMore, filter, fetchArticles, setFilter, markAllRead, error, clearError } = useArticleStore();
    const { refreshAllFeeds } = useFeedStore();
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

    const s = styles(colors, isMobile);

    useEffect(() => {
        if (activeArticleId) {
            const index = articles.findIndex(a => a.id === activeArticleId);
            if (index !== -1) {
                setSelectedIndex(index);
            }
        }
    }, [activeArticleId, articles]);

    const handleArticlePress = useCallback((item: Article) => {
        // Optimistically mark as read
        useArticleStore.getState().markRead(item.id);

        if (onArticlePress) {
            onArticlePress(item);
        } else {
            if (item.feed_type === 'youtube') {
                const videoId = extractVideoId(item.url || item.thumbnail_url || '');
                if (videoId) {
                    if (isMobile) {
                        // On mobile, play inline in the list
                        setActiveVideoId((current) => (current === videoId ? null : videoId));
                    } else {
                        // On desktop, the parent should handle it or it navigates
                        router.push(`/(app)/article/${item.id}`);
                    }
                    return;
                }
            }
            router.push(`/(app)/article/${item.id}`);
        }
    }, [onArticlePress, isMobile, router]);

    const handleRefresh = useCallback(() => {
        refreshAllFeeds();
    }, [refreshAllFeeds]);

    const handleLoadMore = useCallback(() => {
        if (hasMore && !isLoading) {
            fetchArticles(false);
        }
    }, [hasMore, isLoading]);

    // Keyboard navigation
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            switch (e.key.toLowerCase()) {
                case 'j': // Down
                    setSelectedIndex(prev => {
                        const next = Math.min(prev + 1, articles.length - 1);
                        return next;
                    });
                    break;
                case 'k': // Up
                    setSelectedIndex(prev => {
                        const next = Math.max(prev - 1, 0);
                        return next;
                    });
                    break;
                case 'o':
                case 'enter':
                    if (selectedIndex >= 0 && selectedIndex < articles.length) {
                        handleArticlePress(articles[selectedIndex]);
                    }
                    break;
                case 'm': // Mark read
                    if (selectedIndex >= 0 && selectedIndex < articles.length) {
                        useArticleStore.getState().markRead(articles[selectedIndex].id);
                    }
                    break;
                case 'b': // Bookmark
                    if (selectedIndex >= 0 && selectedIndex < articles.length) {
                        useArticleStore.getState().toggleBookmark(articles[selectedIndex].id);
                    }
                    break;
                case 'r': // Refresh articles
                    fetchArticles(true);
                    break;
                case '/': // Focus search (if search exists)
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [articles, selectedIndex, handleArticlePress, fetchArticles]);

    // Get thumbnail URL - prefer YouTube thumbnail, then article thumbnail
    const getArticleThumbnail = (item: Article): string | null => {
        if (item.feed_type === 'youtube') {
            const videoId = extractVideoId(item.url || item.thumbnail_url || '');
            if (videoId) return getThumbnailUrl(videoId, 'maxres');
        }
        return item.thumbnail_url || null;
    };

    const renderArticle = ({ item, index }: { item: Article; index: number }) => {
        const isYouTube = item.feed_type === 'youtube';
        const videoId = isYouTube ? extractVideoId(item.url || item.thumbnail_url || '') : null;
        const thumbnail = getArticleThumbnail(item);
        const isActive = activeArticleId === item.id || (activeArticleId === undefined && index === selectedIndex);

        const handleThumbnailPress = () => {
            if (isYouTube && videoId) {
                if (Platform.OS !== 'web') {
                    const watchUrl = item.url || `https://www.youtube.com/watch?v=${videoId}`;
                    Linking.openURL(watchUrl);
                    return;
                }
                setActiveVideoId((current) => (current === videoId ? null : videoId));
            } else {
                handleArticlePress(item);
            }
        };

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleArticlePress(item)}
                style={[
                    s.articleCard,
                    item.is_read && s.articleRead,
                    isActive && s.articleFocused
                ]}
            >
                {/* Desktop: Row layout with thumbnail on right */}
                {/* Mobile: Column layout with thumbnail below title */}
                <View style={isMobile ? s.articleColumnLayout : s.articleRowLayout}>
                    {/* Mobile: Thumbnail after title */}
                    {isMobile && thumbnail && (
                        <View style={s.thumbnailContainerMobile}>
                            {isYouTube && videoId && activeVideoId === videoId && Platform.OS === 'web' ? (
                                <View style={s.inlinePlayer}>
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={getEmbedUrl(activeVideoId!, true, true)}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        style={{ borderBottomLeftRadius: borderRadius.md, borderBottomRightRadius: borderRadius.md }}
                                    />
                                </View>
                            ) : (
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={handleThumbnailPress}
                                    style={s.thumbnailImageContainer}
                                >
                                    <Image
                                        source={{ uri: thumbnail }}
                                        style={s.thumbnailMobile}
                                        resizeMode="cover"
                                    />
                                    {isYouTube && (
                                        <View style={s.playOverlay}>
                                            <Play size={32} color="#fff" fill="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <View style={s.articleContent}>
                        <View style={s.articleHeader}>
                            {item.feed_icon_url && (
                                <Image source={{ uri: item.feed_icon_url }} style={{ width: 16, height: 16, borderRadius: 3, marginRight: 6 }} />
                            )}
                            <Text style={s.feedName}>{item.feed_title}</Text>
                        </View>
                        <Text style={[s.articleTitle, item.is_read && s.articleTitleRead]} numberOfLines={2}>
                            {item.title}
                        </Text>
                        <Text style={s.articleSummary} numberOfLines={isMobile ? 3 : 2}>
                            {item.summary}
                        </Text>
                        <Text style={s.articleMeta}>
                            {item.author ? `${item.author} • ` : ''}
                            {item.published_at ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true }) : ''}
                        </Text>
                    </View>

                    {/* Desktop: Thumbnail on RIGHT */}
                    {!isMobile && thumbnail && (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={handleThumbnailPress}
                            style={s.thumbnailContainerDesktop}
                        >
                            <Image
                                source={{ uri: thumbnail }}
                                style={s.thumbnailDesktop}
                                resizeMode="cover"
                            />
                            {isYouTube && (
                                <View style={s.playOverlaySmall}>
                                    <Play size={24} color="#fff" fill="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bookmark Button */}
                <TouchableOpacity
                    style={s.bookmarkButton}
                    onPress={() => useArticleStore.getState().toggleBookmark(item.id)}
                >
                    <Bookmark
                        size={18}
                        color={item.is_bookmarked ? colors.primary.DEFAULT : colors.text.tertiary}
                        fill={item.is_bookmarked ? colors.primary.DEFAULT : 'transparent'}
                    />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <FlatList
            data={articles}
            renderItem={renderArticle}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={s.list}
            refreshControl={
                <RefreshControl
                    refreshing={isLoading && articles.length === 0}
                    onRefresh={handleRefresh}
                    colors={[colors.primary.DEFAULT]}
                    tintColor={colors.primary.DEFAULT}
                />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
                isLoading && articles.length > 0 ? (
                    <ActivityIndicator style={s.loader} color={colors.primary.DEFAULT} />
                ) : null
            }
            ListEmptyComponent={
                !isLoading ? (
                    error ? (
                        <View style={s.empty}>
                            <AlertTriangle size={48} color={colors.error} />
                            <Text style={s.emptyTitle}>Something went wrong</Text>
                            <Text style={s.emptyText}>{error}</Text>
                            <TouchableOpacity
                                style={s.retryButton}
                                onPress={() => {
                                    clearError();
                                    fetchArticles(true);
                                }}
                            >
                                <Text style={s.retryButtonText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={s.empty}>
                            <CircleCheck size={48} color={colors.primary.DEFAULT} />
                            <Text style={s.emptyTitle}>All caught up!</Text>
                            <Text style={s.emptyText}>No unread articles</Text>
                        </View>
                    )
                ) : null
            }
        />
    );
}

const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    list: {
        padding: spacing.lg,
    },
    articleCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    articleRead: {
        opacity: 0.6,
    },
    articleFocused: {
        borderColor: colors.primary.DEFAULT,
        backgroundColor: colors.background.tertiary,
    },
    articleRowLayout: {
        flexDirection: 'row',
        gap: spacing.lg,
        paddingRight: 24,
    },
    articleColumnLayout: {
        flexDirection: 'column',
    },
    articleContent: {
        flex: 1,
    },
    articleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    bookmarkButton: {
        position: 'absolute',
        top: spacing.lg,
        right: spacing.lg,
        zIndex: 10,
    },
    feedName: {
        fontSize: 12,
        color: colors.secondary.DEFAULT,
        fontWeight: '500',
    },
    articleTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.text.primary,
        lineHeight: 24,
        marginBottom: spacing.sm,
    },
    articleTitleRead: {
        color: colors.text.secondary,
    },
    articleSummary: {
        fontSize: 14,
        color: colors.text.secondary,
        lineHeight: 20,
        marginBottom: spacing.sm,
    },
    articleMeta: {
        fontSize: 12,
        color: colors.text.tertiary,
    },
    thumbnailContainerDesktop: {
        position: 'relative',
        width: 120,
        height: 80,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        flexShrink: 0,
    },
    thumbnailDesktop: {
        width: '100%',
        height: '100%',
    },
    playOverlaySmall: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    thumbnailContainerMobile: {
        position: 'relative',
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    thumbnailMobile: {
        width: '100%',
        height: '100%',
    },
    playOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    loader: {
        paddingVertical: spacing.xl,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 64,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
        marginTop: spacing.lg,
    },
    emptyText: {
        fontSize: 14,
        color: colors.text.secondary,
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
    },
    retryButton: {
        backgroundColor: colors.primary.DEFAULT,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
    },
    retryButtonText: {
        color: colors.text.inverse,
        fontSize: 15,
        fontWeight: '600',
    },
    inlinePlayer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    thumbnailImageContainer: {
        width: '100%',
        height: '100%',
    },
});
