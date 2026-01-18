import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Image, useWindowDimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useSettingsStore, useToastStore } from '@/stores';
import { Article, ArticleDetail, api } from '@/services/api';
import { ArrowLeft, ExternalLink, Circle, CircleCheck, Headphones, BookOpen, Play, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getEmbedUrl, isYouTubeUrl } from '@/utils/youtube';
import ArticleContent from '@/components/ArticleContent';
import { VideoModal } from '@/components/VideoModal';

export default function ArticleScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const { currentArticle, fetchArticle, markRead, markUnread, toggleBookmark, articles } = useArticleStore();
    const { settings } = useSettingsStore();
    const { show } = useToastStore();
    const [isLoading, setIsLoading] = useState(true);
    const [showReadability, setShowReadability] = useState(settings?.readability_enabled ?? false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [modalVideoId, setModalVideoId] = useState<string | null>(null);
    const [adjacentArticles, setAdjacentArticles] = useState<{ prev: number | null; next: number | null }>({ prev: null, next: null });

    const isYouTube = currentArticle?.feed_type === 'youtube' || isYouTubeUrl(currentArticle?.url || '');
    const videoId = extractVideoId(currentArticle?.url || currentArticle?.thumbnail_url || '');
    const externalUrl = currentArticle?.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

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

    // Calculate adjacent articles for navigation
    useEffect(() => {
        if (!currentArticle || articles.length === 0) return;

        const currentIndex = articles.findIndex((a: Article) => a.id === currentArticle.id);
        if (currentIndex === -1) return;

        setAdjacentArticles({
            prev: currentIndex > 0 ? articles[currentIndex - 1].id : null,
            next: currentIndex < articles.length - 1 ? articles[currentIndex + 1].id : null,
        });
    }, [currentArticle, articles]);

    const navigateToArticle = useCallback((articleId: number | null) => {
        if (!articleId) {
            show('No more articles in this direction');
            return;
        }
        router.replace(`/(app)/article/${articleId}`);
    }, [router, show]);

    const handleOpenExternal = useCallback(() => {
        if (externalUrl) {
            Linking.openURL(externalUrl);
        }
    }, [externalUrl]);

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
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let isProcessing = false;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            // Prevent rapid key presses from causing issues
            if (isProcessing) return;

            // Clear any existing debounce timer
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            // Mark as processing
            isProcessing = true;

            switch (e.key.toLowerCase()) {
                case 'j': // Next
                    navigateToArticle(adjacentArticles.next);
                    break;
                case 'k': // Previous
                    navigateToArticle(adjacentArticles.prev);
                    break;
                case 'm': // Toggle Read
                    handleToggleRead();
                    isProcessing = false; // Immediate actions don't need debounce
                    return;
                case 'o': // Open in browser
                    handleOpenExternal();
                    isProcessing = false; // Immediate actions don't need debounce
                    return;
                case 'escape': // Back to list
                    router.back();
                    isProcessing = false; // Immediate actions don't need debounce
                    return;
                case 'r': // Refresh/Reload this article
                    if (id) fetchArticle(Number(id));
                    isProcessing = false; // Immediate actions don't need debounce
                    return;
            }

            // Debounce navigation actions to prevent rapid successive navigations
            debounceTimer = setTimeout(() => {
                isProcessing = false;
                debounceTimer = null;
            }, 300);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [id, handleToggleRead, handleOpenExternal, adjacentArticles, navigateToArticle, fetchArticle, router]);

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

                {/* Article Navigation */}
                <View style={s.navigation}>
                    <TouchableOpacity
                        onPress={() => navigateToArticle(adjacentArticles.prev)}
                        style={[s.navButton, !adjacentArticles.prev && s.navButtonDisabled]}
                        disabled={!adjacentArticles.prev}
                    >
                        <ChevronLeft size={20} color={adjacentArticles.prev ? colors.primary.DEFAULT : colors.text.tertiary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigateToArticle(adjacentArticles.next)}
                        style={[s.navButton, !adjacentArticles.next && s.navButtonDisabled]}
                        disabled={!adjacentArticles.next}
                    >
                        <ChevronRight size={20} color={adjacentArticles.next ? colors.primary.DEFAULT : colors.text.tertiary} />
                    </TouchableOpacity>
                </View>

                <View style={s.headerActions}>
                    <TouchableOpacity onPress={handleToggleRead} style={s.actionButton}>
                        {currentArticle.is_read ? (
                            <CircleCheck size={22} color={colors.primary.DEFAULT} />
                        ) : (
                            <Circle size={22} color={colors.text.secondary} />
                        )}
                    </TouchableOpacity>

                    {currentArticle.url && (
                        <TouchableOpacity
                            onPress={async () => {
                                // If we already have content, just toggle
                                if (currentArticle.readability_content) {
                                    setShowReadability(!showReadability);
                                    return;
                                }

                                // If no content, try to fetch it
                                try {
                                    setIsLoading(true);
                                    const { content } = await api.fetchReadability(currentArticle.id);
                                    // Update store with new content
                                    useArticleStore.setState((state) => ({
                                        currentArticle: state.currentArticle?.id === currentArticle.id
                                            ? { ...state.currentArticle, readability_content: content }
                                            : state.currentArticle,
                                        articles: state.articles.map(a =>
                                            a.id === currentArticle.id
                                                ? { ...a, readability_content: content }
                                                : a
                                        )
                                    }));
                                    setShowReadability(true);
                                } catch (err) {
                                    alert('Failed to extract article content.');
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
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

                {/* YouTube Player - Mobile Inline / Desktop Modal */}
                {isYouTube && videoId && Platform.OS === 'web' && (
                    <View style={s.videoContainer}>
                        {isMobile ? (
                            <iframe
                                src={getEmbedUrl(videoId, false, true)}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                    borderRadius: borderRadius.lg,
                                }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                frameBorder="0"
                                title={currentArticle.title}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                // iOS PWA: force inline playback on iPhone/iPad
                                {...({ webkitplaysinline: 'true' } as any)}
                                playsInline
                            />
                        ) : (
                            <TouchableOpacity
                                style={s.videoPlaceholder}
                                onPress={() => setModalVideoId(videoId)}
                                activeOpacity={0.9}
                            >
                                <Image
                                    source={{ uri: currentArticle.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
                                    style={s.heroImageFull}
                                    resizeMode="cover"
                                />
                                <View style={s.playOverlay}>
                                    <View style={s.playButton}>
                                        <Play size={32} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
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

            <VideoModal
                videoId={modalVideoId}
                visible={!!modalVideoId}
                onClose={() => setModalVideoId(null)}
            />
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
    navigation: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    navButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
    },
    navButtonDisabled: {
        opacity: 0.4,
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
    videoPlaceholder: {
        width: '100%',
        height: '100%',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    playButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,0,0,0.9)', // YouTube red
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    // Hero image for non-YouTube articles
    heroImage: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xl,
    },
    heroImageFull: {
        width: '100%',
        height: '100%',
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
