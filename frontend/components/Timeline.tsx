import { useEffect, useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, Linking, Image, useWindowDimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useFeedStore } from '@/stores';
import { Article } from '@/services/api';
import { Circle, CircleCheck, Play, Bookmark, MoreVertical, CheckCheck, AlertTriangle, Filter, RefreshCw } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getThumbnailUrl, getEmbedUrl } from '@/utils/youtube';
import { VideoModal } from '@/components/VideoModal';


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
    const { feeds, folders, refreshAllFeeds } = useFeedStore();
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    const s = styles(colors, isMobile);

    useEffect(() => {
        // Countdown Timer Logic
        const timer = setInterval(() => {
            const now = new Date();
            let earliest: Date | null = null;

            feeds.forEach(f => {
                if (f.next_fetch_at) {
                    const next = new Date(f.next_fetch_at);
                    if (!isNaN(next.getTime())) {
                        if (!earliest || next < earliest) {
                            earliest = next;
                        }
                    }
                }
            });

            if (earliest) {
                const diff = (earliest as Date).getTime() - now.getTime();
                if (diff <= 0) {
                    setTimeLeft('Soon');
                } else {
                    const minutes = Math.floor(diff / 60000);
                    const seconds = Math.floor((diff % 60000) / 1000);
                    setTimeLeft(`${minutes}m ${seconds}s`);
                }
            } else {
                setTimeLeft(null);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [feeds]);

    const handleMarkAllRead = () => {
        const getScope = (): { scope: 'feed' | 'folder' | 'type' | 'all'; scopeId?: number; type?: string } => {
            if (filter.feed_id) return { scope: 'feed', scopeId: filter.feed_id };
            if (filter.folder_id) return { scope: 'folder', scopeId: filter.folder_id };
            if (filter.type) return { scope: 'type', type: filter.type };
            return { scope: 'all' };
        };

        const { scope, scopeId, type } = getScope();
        const scopeName = scope === 'all' ? 'all articles' : `these ${scope} articles`;

        Alert.alert(
            'Mark All as Read',
            `Mark ${scopeName} as read?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark Read',
                    onPress: async () => {
                        try {
                            await markAllRead(scope, scopeId, type);
                        } catch (err) {
                            Alert.alert('Error', 'Failed to mark articles as read');
                        }
                    }
                }
            ]
        );
    };

    const getHeaderTitle = () => {
        if (filter.feed_id) {
            const feed = feeds.find(f => f.id === filter.feed_id);
            return feed ? feed.title : 'Feed';
        }
        if (filter.folder_id) {
            const folder = folders.find(f => f.id === filter.folder_id);
            return folder ? folder.name : 'Folder';
        }
        if (filter.type) {
            const typeNames: Record<string, string> = {
                rss: 'RSS',
                youtube: 'YouTube',
                podcast: 'Podcasts',
                reddit: 'Reddit',
            };
            return typeNames[filter.type] || 'Articles';
        }
        return 'Articles';
    };

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
            // Use maxres for desktop, hq for mobile
            if (videoId) return getThumbnailUrl(videoId, isMobile ? 'hq' : 'maxres');
        }
        const url = item.thumbnail_url;
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            return url;
        }
        return null; // Ignore invalid entries like "self", "default"
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
                        <Text style={[s.articleTitle, item.is_read && s.articleTitleRead]} numberOfLines={thumbnail ? 2 : 3}>
                            {item.title}
                        </Text>
                        {thumbnail && (
                            <Text style={s.articleSummary} numberOfLines={isMobile ? 3 : 2}>
                                {item.summary}
                            </Text>
                        )}
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
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <Text style={s.headerTitle}>{getHeaderTitle()}</Text>
                </View>

                <View style={s.headerActions}>
                    {timeLeft && (
                        <View style={s.refreshContainer}>
                            <Text style={s.countdownText}>{timeLeft}</Text>
                            <TouchableOpacity onPress={() => refreshAllFeeds()} style={s.iconButton}>
                                <RefreshCw size={18} color={colors.primary.DEFAULT} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[s.filterButton, filter.unread_only && s.filterButtonActive]}
                        onPress={() => setFilter({ unread_only: !filter.unread_only })}
                    >
                        <Filter size={16} color={filter.unread_only ? colors.text.inverse : colors.text.secondary} />
                        {!isMobile && (
                            <Text style={[s.filterText, filter.unread_only && s.filterTextActive]}>
                                Unread Only
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleMarkAllRead} style={s.iconButton}>
                        <CircleCheck size={20} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>
            </View>

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

            {activeVideoId && Platform.OS !== 'web' && (
                <VideoModal
                    videoId={activeVideoId}
                    visible={!!activeVideoId}
                    onClose={() => setActiveVideoId(null)}
                />
            )}
        </View>
    );
}

const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        minHeight: 60,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20, // Smaller than 24 for timeline pane
        fontWeight: '700',
        color: colors.text.primary,
        marginLeft: isMobile ? 44 : 0, // Add space for absolute menu button
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    refreshContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginRight: spacing.sm,
    },
    countdownText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: colors.text.tertiary,
    },
    iconButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs + 2,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
    },
    filterButtonActive: {
        backgroundColor: colors.primary.DEFAULT,
    },
    filterText: {
        fontSize: 12,
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.text.inverse,
        fontWeight: '500',
    },
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
