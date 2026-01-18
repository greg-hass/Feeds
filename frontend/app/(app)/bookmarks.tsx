import { useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore } from '@/stores';
import { Article, api } from '@/services/api';
import { Circle, Bookmark, Headphones, Play } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getThumbnailUrl } from '@/utils/youtube';
import { useState } from 'react';

export default function BookmarksScreen() {
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const { bookmarkedArticles, fetchBookmarks, isLoading } = useArticleStore();

    const s = styles(colors, isMobile);

    useEffect(() => {
        fetchBookmarks();
    }, []);

    const handleArticlePress = (id: number) => {
        router.push(`/(app)/article/${id}`);
    };

    const getArticleThumbnail = (item: Article): string | null => {
        if (item.feed_type === 'youtube') {
            const videoId = extractVideoId(item.url || item.thumbnail_url || '');
            if (videoId) return getThumbnailUrl(videoId, 'maxres');
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

    if (isLoading) {
        return (
            <View style={s.loading}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    return (
        <View style={s.container}>
            <View style={s.header}>
                <Text style={s.headerTitle}>Bookmarks</Text>
            </View>

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
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text.primary,
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
});
