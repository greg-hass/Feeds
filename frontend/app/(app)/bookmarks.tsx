import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, useWindowDimensions, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore } from '@/stores';
import { Article, api } from '@/services/api';
import { Circle, Bookmark, Headphones, Play, RefreshCw, CircleCheck, Menu, X } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getThumbnailUrl } from '@/utils/youtube';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import Sidebar from '@/components/Sidebar';

export default function BookmarksScreen() {
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const { bookmarkedArticles, fetchBookmarks, isLoading, markArticleRead } = useArticleStore();

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [sidebarAnim] = useState(new Animated.Value(-300));

    const s = styles(colors, isMobile);

    useEffect(() => {
        fetchBookmarks();
    }, []);

    const toggleMenu = () => {
        setShowMenu(!showMenu);
        Animated.timing(sidebarAnim, {
            toValue: showMenu ? -300 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchBookmarks();
        setIsRefreshing(false);
    };

    const handleMarkAllRead = async () => {
        for (const article of bookmarkedArticles) {
            if (!article.is_read) {
                await markArticleRead(article.id);
            }
        }
    };

    const handleArticlePress = (id: number) => {
        router.push(`/(app)/article/${id}`);
    };

    const getArticleThumbnail = (item: Article): string | null => {
        if (item.feed_type === 'youtube') {
            const videoId = extractVideoId(item.url || item.thumbnail_url || '');
            if (videoId) return getThumbnailUrl(videoId, isMobile ? 'hq' : 'maxres');
        }
        return item.thumbnail_url || null;
    };

    const renderArticle = ({ item }: { item: Article }) => {
        const thumbnail = getArticleThumbnail(item);
        const isYouTube = item.feed_type === 'youtube';

        return (
            <TouchableOpacity
                style={[s.articleCard, item.is_read && s.articleRead]}
                onPress={() => handleArticlePress(item.id)}
            >
                <View style={isMobile ? s.articleColumnLayout : s.articleRowLayout}>
                    <View style={s.articleContent}>
                        <View style={s.articleHeader}>
                            <Text style={s.feedName}>{item.feed_title}</Text>
                            {item.has_audio && <Headphones size={14} color={colors.secondary.DEFAULT} />}
                            <Bookmark size={14} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} />
                        </View>
                        <Text style={[s.articleTitle, item.is_read && s.articleTitleRead]} numberOfLines={2}>
                            {!item.is_read && (
                                <Circle size={8} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} style={{ marginRight: 6 }} />
                            )}
                            {item.title}
                        </Text>

                        {isMobile && thumbnail && (
                            <View style={s.thumbnailContainerMobile}>
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
                            </View>
                        )}

                        {item.summary && (
                            <Text style={s.articleSummary} numberOfLines={2}>
                                {item.summary}
                            </Text>
                        )}
                        <Text style={s.articleMeta}>
                            {item.author && `${item.author} • `}
                            {item.published_at && formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                        </Text>
                    </View>

                    {!isMobile && thumbnail && (
                        <View style={s.thumbnailContainerDesktop}>
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
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (isLoading && bookmarkedArticles.length === 0) {
        return (
            <View style={s.loading}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    return (
        <View style={s.container}>
            <ScreenHeader
                title="Bookmarks"
                showBackButton={false}
                isRefreshing={isRefreshing}
                rightActions={[
                    {
                        icon: <RefreshCw size={20} color={colors.text.secondary} />,
                        onPress: handleRefresh,
                        loading: isRefreshing,
                        accessibilityLabel: 'Refresh bookmarks',
                    },
                    {
                        icon: <CircleCheck size={20} color={colors.text.secondary} />,
                        onPress: handleMarkAllRead,
                        accessibilityLabel: 'Mark all as read',
                    },
                ]}
            />

            <FlatList
                data={bookmarkedArticles}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderArticle}
                contentContainerStyle={s.list}
                ItemSeparatorComponent={() => <View style={s.separator} />}
                ListEmptyComponent={
                    <View style={s.empty}>
                        <Bookmark size={48} color={colors.text.tertiary} />
                        <Text style={s.emptyTitle}>No bookmarks yet</Text>
                        <Text style={s.emptyText}>Bookmark articles to save them here</Text>
                    </View>
                }
            />

            {/* Mobile menu button */}
            {isMobile && (
                <>
                    <TouchableOpacity onPress={toggleMenu} style={s.mobileMenuButton} accessibilityLabel="Open menu">
                        <Menu size={24} color={colors.text.primary} />
                    </TouchableOpacity>

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
                            <TouchableOpacity onPress={toggleMenu} style={{ padding: spacing.sm }} accessibilityLabel="Close menu">
                                <X size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <Sidebar onNavigate={toggleMenu} />
                    </Animated.View>
                </>
            )}
        </View>
    );
}

const styles = (colors: any, isMobile: boolean = false) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    list: {
        padding: spacing.lg,
    },
    articleCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
    },
    articleRead: {
        opacity: 0.6,
    },
    articleRowLayout: {
        flexDirection: 'row',
        gap: spacing.lg,
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
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    feedName: {
        fontSize: 12,
        color: colors.secondary.DEFAULT,
        fontWeight: '500',
        flex: 1,
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
    separator: {
        height: spacing.md,
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
    },
    mobileMenuButton: {
        position: 'absolute',
        top: spacing.md,
        left: spacing.md,
        zIndex: 100,
        padding: 8,
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.full,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
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
