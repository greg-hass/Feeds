import { useEffect, useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, Linking, Image, useWindowDimensions, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useFeedStore } from '@/stores';
import { Article, api } from '@/services/api';
import { Circle, CircleCheck, Headphones, Filter, CheckCheck, MoreVertical, Play, Bookmark, Menu, X, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getThumbnailUrl, getEmbedUrl } from '@/utils/youtube';

import { VideoModal } from '@/components/VideoModal';
import Sidebar from '@/components/Sidebar';
import { RefreshProgressDialog } from '@/components/RefreshProgressDialog';

export default function ArticleListScreen() {
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    // Use collapsible sidebar on tablets (iPad), only permanent on larger desktop screens
    const isMobile = width < 1024;
    const { articles, isLoading, hasMore, filter, fetchArticles, setFilter, markAllRead, error, clearError } = useArticleStore();
    const { feeds, fetchFeeds, fetchFolders, refreshAllFeeds, refreshProgress } = useFeedStore();
    const [showMenu, setShowMenu] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    // Animated value for sidebar slide-in from left
    const [sidebarAnim] = useState(new Animated.Value(-300));

    const toggleMenu = () => {
        setShowMenu(!showMenu);
        Animated.timing(sidebarAnim, {
            toValue: showMenu ? -300 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

    const s = styles(colors, isMobile);

    useEffect(() => {
        fetchFeeds();
        fetchFolders();
        fetchArticles(true);
    }, []);

    const handleArticlePress = (item: Article) => {
        // Optimistically mark as read
        useArticleStore.getState().markRead(item.id);

        if (item.feed_type === 'youtube') {
            const videoId = extractVideoId(item.url || item.thumbnail_url || '');
            if (videoId) {
                if (isMobile) {
                    // On mobile, play inline in the list
                    setActiveVideoId((current) => (current === videoId ? null : videoId));
                } else {
                    // On desktop, open VideoModal (pop-out player)
                    setActiveVideoId(videoId);
                }
                return;
            }
        }

        router.push(`/(app)/article/${item.id}`);
    };

    const handleRefresh = useCallback(() => {
        refreshAllFeeds();
    }, [refreshAllFeeds]);

    // Countdown Timer Logic
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            let earliest: Date | null = null;

            // Log for debugging if needed
            // console.log('Checking feeds for next_fetch_at');

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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                if (e.key === 'Escape') {
                    (document.activeElement as HTMLElement).blur();
                }
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'j': // Next
                    setSelectedIndex((prev: number) => Math.min(prev + 1, articles.length - 1));
                    break;
                case 'k': // Previous
                    setSelectedIndex((prev: number) => Math.max(prev - 1, 0));
                    break;
                case 'm': // Toggle Read
                    if (selectedIndex >= 0 && selectedIndex < articles.length) {
                        const article = articles[selectedIndex];
                        useArticleStore.getState().markRead(article.id);
                    }
                    break;
                case 'o': // Open in browser
                case 'enter':
                    if (selectedIndex >= 0 && selectedIndex < articles.length) {
                        const article = articles[selectedIndex];
                        if (e.key.toLowerCase() === 'o' && article.url) {
                            Linking.openURL(article.url);
                        } else {
                            handleArticlePress(article);
                        }
                    }
                    break;
                case 'r': // Refresh
                    handleRefresh();
                    break;
                case 'b': // Bookmark
                    if (selectedIndex >= 0 && selectedIndex < articles.length) {
                        const article = articles[selectedIndex];
                        useArticleStore.getState().toggleBookmark(article.id);
                    }
                    break;
                case '/': // Focus search (if search was on this screen, but it's separate)
                    e.preventDefault();
                    router.push('/(app)/search');
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [articles, selectedIndex, handleRefresh, handleArticlePress]);

    const handleLoadMore = useCallback(() => {
        if (hasMore && !isLoading) {
            fetchArticles(false);
        }
    }, [hasMore, isLoading]);

    const toggleUnreadFilter = () => {
        setFilter({ unread_only: !filter.unread_only });
    };

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
        // Close menu if open
        if (showMenu) toggleMenu();
    };

    const getHeaderTitle = () => {
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

    const unreadCount = articles.filter((a: Article) => !a.is_read).length;

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
            <View
                style={[
                    s.articleCard,
                    item.is_read && s.articleRead,
                    index === selectedIndex && s.articleFocused
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
                            {item.has_audio && <Headphones size={14} color={colors.secondary.DEFAULT} />}
                        </View>
                        <TouchableOpacity onPress={() => handleArticlePress(item)} activeOpacity={0.7}>
                            <Text style={[s.articleTitle, item.is_read && s.articleTitleRead]} numberOfLines={2}>
                                {!item.is_read && (
                                    <Circle size={8} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} style={{ marginRight: 6 }} />
                                )}
                                {item.title}
                            </Text>
                        </TouchableOpacity>

                        {item.summary && (
                            <Text style={s.articleSummary} numberOfLines={2}>
                                {item.summary}
                            </Text>
                        )}
                        <TouchableOpacity onPress={() => handleArticlePress(item)} activeOpacity={0.7}>
                            <Text style={s.articleMeta}>
                                {item.author && `${item.author} • `}
                                {item.published_at && formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Desktop: Thumbnail on right side */}
                    {!isMobile && thumbnail && (
                        <TouchableOpacity
                            style={s.thumbnailContainerDesktop}
                            onPress={handleThumbnailPress}
                        >
                            <Image
                                source={{ uri: thumbnail }}
                                style={s.thumbnailDesktop}
                                resizeMode="cover"
                            />
                            {isYouTube && (
                                <View style={s.playOverlaySmall}>
                                    <Play size={20} color="#fff" fill="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bookmark Icon - Absolute Positioned */}
                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        useArticleStore.getState().toggleBookmark(item.id);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={s.bookmarkButton}
                >
                    <Bookmark
                        size={16}
                        color={item.is_bookmarked ? colors.primary.DEFAULT : colors.text.tertiary}
                        fill={item.is_bookmarked ? colors.primary.DEFAULT : 'transparent'}
                    />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={[s.header, isMobile && s.headerMobile]}>
                <View style={s.headerLeft}>
                    {isMobile && (
                        <TouchableOpacity onPress={toggleMenu} style={s.menuButton}>
                            <Menu size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    )}
                    <Text style={s.headerTitle}>{getHeaderTitle()}</Text>
                    {isLoading && <ActivityIndicator size="small" color={colors.text.secondary} style={{ marginLeft: spacing.sm }} />}
                </View>
                <View style={s.headerActions}>
                    {unreadCount > 0 && (
                        <View style={s.unreadBadge}>
                            <Text style={s.unreadBadgeText}>{unreadCount}</Text>
                        </View>
                    )}
                    {/* Always-visible refresh button */}
                    <View style={s.refreshContainer}>
                        {timeLeft && !isLoading && (
                            <Text style={s.countdownText}>{timeLeft}</Text>
                        )}
                        <TouchableOpacity
                            style={s.iconButton}
                            onPress={handleRefresh}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size={16} color={colors.text.secondary} />
                            ) : (
                                <RefreshCw size={18} color={colors.text.secondary} />
                            )}
                        </TouchableOpacity>
                    </View>
                    {/* Mark All Read */}
                    <TouchableOpacity
                        style={s.iconButton}
                        onPress={handleMarkAllRead}
                    >
                        <CheckCheck size={20} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>

                    {/* Unread Filter */}
                    <TouchableOpacity
                        style={[s.filterButton, filter.unread_only && s.filterButtonActive]}
                        onPress={toggleUnreadFilter}
                    >
                        <Filter size={16} color={filter.unread_only ? colors.text.inverse : colors.text.secondary} />
                        <Text style={[s.filterText, filter.unread_only && s.filterTextActive]}>
                            {filter.unread_only ? 'Unread' : 'All'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* List */}
            <FlatList
                data={articles}
                keyExtractor={(item: Article) => String(item.id)}
                renderItem={({ item, index }: { item: Article; index: number }) => renderArticle({ item, index })}
                extraData={activeVideoId}
                contentContainerStyle={s.list}
                ItemSeparatorComponent={() => <View style={s.separator} />}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading && articles.length === 0}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary.DEFAULT}
                        colors={[colors.primary.DEFAULT]}
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
                                    <RefreshCw size={18} color={colors.text.inverse} />
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
            {/* Only show modal on desktop */}
            {activeVideoId && !isMobile && (
                <VideoModal
                    videoId={activeVideoId}
                    visible={!!activeVideoId}
                    onClose={() => setActiveVideoId(null)}
                />
            )}

            {/* Mobile Sidebar - Slide from Left */}
            {isMobile && (
                <>
                    {/* Backdrop */}
                    {showMenu && (
                        <TouchableOpacity
                            style={s.sidebarBackdrop}
                            activeOpacity={1}
                            onPress={toggleMenu}
                        />
                    )}
                    {/* Sidebar */}
                    <Animated.View
                        style={[
                            s.sidebarContainer,
                            {
                                transform: [{ translateX: sidebarAnim }],
                                width: 280,
                            },
                        ]}
                    >
                        <View style={{ alignItems: 'flex-end', padding: spacing.md }}>
                            <TouchableOpacity onPress={toggleMenu} style={{ padding: spacing.sm }}>
                                <X size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <Sidebar onNavigate={toggleMenu} />
                    </Animated.View>
                </>
            )}

            {/* Refresh Progress Dialogue */}
            <RefreshProgressDialog
                visible={!!refreshProgress}
                total={refreshProgress?.total || 0}
                completed={refreshProgress?.completed || 0}
                currentTitle={refreshProgress?.currentTitle || ''}
            />
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
        padding: spacing.xl,
        paddingBottom: spacing.lg,
    },
    headerMobile: {
        padding: spacing.md,
        paddingTop: spacing.xl,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuButton: {
        marginRight: spacing.md,
        padding: 4,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text.primary,
    },
    unreadBadge: {
        backgroundColor: colors.primary.DEFAULT,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        minWidth: 24,
        alignItems: 'center',
    },
    unreadBadgeText: {
        fontSize: 12,
        color: colors.text.inverse,
        fontWeight: '600',
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
    },
    countdownText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: colors.text.tertiary,
        marginRight: spacing.xs,
    },
    iconButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    filterButtonActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
    },
    filterText: {
        fontSize: 14,
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
    },
    articleRead: {
        opacity: 0.6,
    },
    articleFocused: {
        borderColor: colors.primary.DEFAULT,
        borderWidth: 2,
        padding: spacing.lg - 2,
    },
    // Layout styles
    articleRowLayout: {
        flexDirection: 'row',
        gap: spacing.lg,
        paddingRight: 24, // Space for bookmark
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
    // Thumbnail styles - Desktop
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
    // Thumbnail styles - Mobile
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
    separator: {
        height: spacing.md,
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary.DEFAULT,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        marginTop: spacing.md,
    },
    retryButtonText: {
        color: colors.text.inverse,
        fontSize: 15,
        fontWeight: '600',
    },
    // Inline player
    inlinePlayer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    thumbnailImageContainer: {
        width: '100%',
        height: '100%',
    },
    // Slide-from-left sidebar (iOS PWA style)
    sidebarBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 900,
    },
    sidebarContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: colors.background.elevated,
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
});
