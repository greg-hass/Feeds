import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Image, useWindowDimensions, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useSettingsStore, useToastStore } from '@/stores';
import { Article, api } from '@/services/api';
import { ArrowLeft, ExternalLink, Circle, CircleCheck, Headphones, BookOpen, Play, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getEmbedUrl, isYouTubeUrl } from '@/utils/youtube';
import ArticleContent from '@/components/ArticleContent';
import { VideoModal } from '@/components/VideoModal';
import Timeline from '@/components/Timeline';

export default function ArticleScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
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

    const s = styles(colors, isMobile);

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
        // Use replace on mobile to keep stack clean, but router push works too. 
        // On desktop replace is better to keep the URL in sync without pushing to stack for every article click.
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
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            if (isProcessing) return;
            if (debounceTimer) clearTimeout(debounceTimer);
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
                    isProcessing = false;
                    return;
                case 'o': // Open in browser
                    handleOpenExternal();
                    isProcessing = false;
                    return;
                case 'escape': // Back to list
                    router.back();
                    isProcessing = false;
                    return;
                case 'r': // Refresh/Reload this article
                    if (id) fetchArticle(Number(id));
                    isProcessing = false;
                    return;
            }

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

    const renderReader = () => {
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
            <View style={s.readerContent}>
                <View style={s.readerHeader}>
                    {isMobile && (
                        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
                            <ArrowLeft size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    )}

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
                                    if (currentArticle.readability_content) {
                                        setShowReadability(!showReadability);
                                        return;
                                    }
                                    try {
                                        setIsLoading(true);
                                        const { content } = await api.fetchReadability(currentArticle.id);
                                        useArticleStore.setState((state) => ({
                                            currentArticle: state.currentArticle?.id === currentArticle.id
                                                ? { ...state.currentArticle, readability_content: content }
                                                : state.currentArticle,
                                            articles: state.articles.map(a =>
                                                a.id === currentArticle.id ? { ...a, readability_content: content } : a
                                            )
                                        }));
                                        setShowReadability(true);
                                    } catch (err) {
                                        Alert.alert('Error', 'Failed to extract article content.');
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

                <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent}>
                    <View style={s.contentContainer}>
                        <Text style={s.feedName}>{currentArticle.feed_title}</Text>
                        <Text style={s.title}>{currentArticle.title}</Text>

                        <View style={s.meta}>
                            {currentArticle.author && <Text style={s.author}>{currentArticle.author}</Text>}
                            {currentArticle.published_at && (
                                <Text style={s.date}>
                                    {formatDistanceToNow(new Date(currentArticle.published_at), { addSuffix: true })}
                                </Text>
                            )}
                        </View>

                        {isYouTube && videoId && Platform.OS === 'web' && (
                            <View style={s.videoContainer}>
                                {isMobile ? (
                                    <iframe
                                        src={getEmbedUrl(videoId, false, true)}
                                        style={{ width: '100%', height: '100%', border: 'none', borderRadius: borderRadius.lg }}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                        frameBorder="0"
                                        title={currentArticle.title}
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <TouchableOpacity style={s.videoPlaceholder} onPress={() => setModalVideoId(videoId)} activeOpacity={0.9}>
                                        <Image
                                            source={{ uri: currentArticle.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` }}
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

                        {!isYouTube && currentArticle.thumbnail_url && (
                            <Image source={{ uri: currentArticle.thumbnail_url }} style={s.heroImage} resizeMode="cover" />
                        )}

                        {currentArticle.has_audio && currentArticle.enclosure_url && (
                            <TouchableOpacity style={s.audioPlayer} onPress={() => Linking.openURL(currentArticle.enclosure_url!)}>
                                <Headphones size={20} color={colors.secondary.DEFAULT} />
                                <Text style={s.audioText}>Play Episode</Text>
                            </TouchableOpacity>
                        )}

                        <View style={s.articleContentWrapper}>
                            {Platform.OS === 'web' && content ? (
                                <ArticleContent
                                    html={content}
                                    fontSize={settings?.font_size || 'medium'}
                                    article={{
                                        title: currentArticle.title,
                                        author: currentArticle.author,
                                        feed_title: currentArticle.feed_title,
                                        published_at: currentArticle.published_at,
                                        thumbnail_url: currentArticle.thumbnail_url,
                                        feed_icon_url: currentArticle.feed_icon_url,
                                        site_name: currentArticle.site_name,
                                        hero_image: currentArticle.hero_image,
                                    }}
                                />
                            ) : (
                                <Text style={s.contentText}>
                                    {content || currentArticle.summary || 'No content available'}
                                </Text>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    };

    return (
        <View style={s.container}>
            {isMobile ? (
                renderReader()
            ) : (
                // Desktop: Render Reader in the second pane (which is the Slot)
                <View style={s.readerPane}>
                    {renderReader()}
                </View>
            )}

            <VideoModal
                videoId={modalVideoId}
                visible={!!modalVideoId}
                onClose={() => setModalVideoId(null)}
            />
        </View>
    );
}

const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    desktopLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    listPane: {
        width: 400,
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
    },
    readerPane: {
        flex: 1,
        backgroundColor: colors.background.secondary,
    },
    readerContent: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    readerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
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
    scrollContent: {
        alignItems: 'center', // Center content for legibility
        paddingBottom: 64,
    },
    contentContainer: {
        width: '100%',
        maxWidth: 800, // Optimize legibility
        padding: spacing.xl,
    },
    feedName: {
        fontSize: 13,
        color: colors.secondary.DEFAULT,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text.primary,
        lineHeight: 42,
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
        backgroundColor: 'rgba(255,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
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
        fontSize: 18,
        color: colors.text.primary,
        lineHeight: 30,
    },
});
