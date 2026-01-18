import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Image, useWindowDimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useSettingsStore } from '@/stores';
import { Article, api } from '@/services/api';
import { ArrowLeft, ExternalLink, Circle, CircleCheck, Headphones, BookOpen, Play, Bookmark } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getEmbedUrl } from '@/utils/youtube';
import ArticleContent from '@/components/ArticleContent';

export default function ArticleScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const { currentArticle, fetchArticle, markRead, markUnread } = useArticleStore();
    const { settings } = useSettingsStore();
    const [isLoading, setIsLoading] = useState(true);
    const [showReadability, setShowReadability] = useState(settings?.readability_enabled ?? false);
    const [isBookmarked, setIsBookmarked] = useState(false);

    const isYouTube = currentArticle?.feed_type === 'youtube';
    const videoId = currentArticle?.url ? extractVideoId(currentArticle.url) : null;

    const s = styles(colors);

    useEffect(() => {
        if (currentArticle) {
            setIsBookmarked(currentArticle.is_bookmarked || false);
        }
    }, [currentArticle]);

    useEffect(() => {
        if (id) {
            setIsLoading(true);
            fetchArticle(Number(id))
                .then(() => markRead(Number(id)))
                .finally(() => setIsLoading(false));
        }
    }, [id]);

    useEffect(() => {
        if (settings) {
            setShowReadability(settings.readability_enabled);
        }
    }, [settings?.readability_enabled]);

    const handleOpenExternal = useCallback(() => {
        if (currentArticle?.url) {
            Linking.openURL(currentArticle.url);
        }
    }, [currentArticle?.url]);

    const handleToggleRead = useCallback(() => {
        if (!currentArticle) return;
        if (currentArticle.is_read) {
            markUnread(currentArticle.id);
        } else {
            markRead(currentArticle.id);
        }
    }, [currentArticle, markRead, markUnread]);

    const handleToggleBookmark = useCallback(() => {
        if (currentArticle) {
            toggleBookmark(currentArticle.id);
        }
    }, [currentArticle, toggleBookmark]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            const { articles } = useArticleStore.getState();
            const currentIndex = articles.findIndex((a: Article) => a.id === Number(id));

            switch (e.key.toLowerCase()) {
                case 'j': // Next
                    if (currentIndex < articles.length - 1) {
                        router.replace(`/(app)/article/${articles[currentIndex + 1].id}`);
                    }
                    break;
                case 'k': // Previous
                    if (currentIndex > 0) {
                        router.replace(`/(app)/article/${articles[currentIndex - 1].id}`);
                    }
                    break;
                case 'm': // Toggle Read
                    handleToggleRead();
                    break;
                case 'o': // Open in browser
                    handleOpenExternal();
                    break;
                case 'escape': // Back to list
                    router.back();
                    break;
                case 'r': // Refresh/Reload this article
                    if (id) fetchArticle(Number(id));
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [id, handleToggleRead, handleOpenExternal]);

    if (isLoading || !currentArticle) {
        return (
            <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    const content = showReadability && currentArticle.readability_content
        ? currentArticle.readability_content
        : currentArticle.content;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>

                <View style={s.headerActions}>
                    <TouchableOpacity onPress={handleToggleRead} style={s.actionButton}>
                        {currentArticle.is_read ? (
                            <CircleCheck size={22} color={colors.primary.DEFAULT} />
                        ) : (
                            <Circle size={22} color={colors.text.secondary} />
                        )}
                    </TouchableOpacity>

                    {currentArticle.readability_content && (
                        <TouchableOpacity
                            onPress={() => setShowReadability(!showReadability)}
                            style={[s.actionButton, showReadability && s.actionButtonActive]}
                        >
                            <BookOpen size={22} color={showReadability ? colors.primary.DEFAULT : colors.text.secondary} />
                        </TouchableOpacity>
                    )}

                    {currentArticle.url && (
                        <TouchableOpacity onPress={handleOpenExternal} style={s.actionButton}>
                            <ExternalLink size={22} color={colors.text.secondary} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={handleToggleBookmark} style={s.actionButton}>
                        <Bookmark
                            size={22}
                            color={currentArticle.is_bookmarked ? colors.primary.DEFAULT : colors.text.secondary}
                            fill={currentArticle.is_bookmarked ? colors.primary.DEFAULT : 'transparent'}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={s.scrollView} contentContainerStyle={s.content}>
                {/* Article Meta */}
                <Text style={s.feedName}>{currentArticle.feed_title}</Text>
                <Text style={s.title}>{currentArticle.title}</Text>

                <View style={s.meta}>
                    {currentArticle.author && (
                        <Text style={s.author}>{currentArticle.author}</Text>
                    )}
                    {currentArticle.published_at && (
                        <Text style={s.date}>
                            {formatDistanceToNow(new Date(currentArticle.published_at), { addSuffix: true })}
                        </Text>
                    )}
                </View>

                {/* YouTube Player */}
                {isYouTube && videoId && Platform.OS === 'web' && (
                    <View style={s.videoContainer}>
                        <iframe
                            src={getEmbedUrl(videoId)}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                borderRadius: borderRadius.lg,
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </View>
                )}

                {/* Hero Image for non-YouTube articles */}
                {!isYouTube && currentArticle.thumbnail_url && (
                    <Image
                        source={{ uri: currentArticle.thumbnail_url }}
                        style={s.heroImage}
                        resizeMode="cover"
                    />
                )}

                {/* Audio Player for Podcasts */}
                {currentArticle.has_audio && currentArticle.enclosure_url && (
                    <TouchableOpacity
                        style={s.audioPlayer}
                        onPress={() => Linking.openURL(currentArticle.enclosure_url!)}
                    >
                        <Headphones size={20} color={colors.secondary.DEFAULT} />
                        <Text style={s.audioText}>Play Episode</Text>
                    </TouchableOpacity>
                )}

                {/* Content - HTML or Plain Text */}
                <View style={s.articleContentWrapper}>
                    {Platform.OS === 'web' && content ? (
                        <ArticleContent
                            html={content}
                            fontSize={settings?.font_size || 'medium'}
                        />
                    ) : (
                        <Text style={s.contentText}>
                            {content || currentArticle.summary || 'No content available'}
                        </Text>
                    )}
                </View>
            </ScrollView>
        </View >
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    backButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    actionButton: {
        padding: spacing.sm,
    },
    actionButtonActive: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.xl,
        paddingBottom: 64,
    },
    feedName: {
        fontSize: 13,
        color: colors.secondary.DEFAULT,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: colors.text.primary,
        lineHeight: 34,
        marginBottom: spacing.md,
    },
    meta: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    author: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    date: {
        fontSize: 14,
        color: colors.text.tertiary,
    },
    audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.background.secondary,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.secondary.DEFAULT,
    },
    audioText: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.secondary.DEFAULT,
    },
    // Video container for YouTube
    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        marginBottom: spacing.xl,
        backgroundColor: colors.background.tertiary,
    },
    // Hero image for non-YouTube articles
    heroImage: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xl,
    },
    articleContentWrapper: {
        paddingTop: spacing.md,
    },
    contentText: {
        fontSize: 17,
        color: colors.text.primary,
        lineHeight: 28,
    },
});

