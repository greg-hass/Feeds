import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, useWindowDimensions, Platform, Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore } from '@/stores/articleStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToastStore } from '@/stores/toastStore';
import { useVideoStore } from '@/stores/videoStore';
import { useAudioStore } from '@/stores/audioStore';
import { useReadingSession, calculateScrollDepth } from '@/hooks/useReadingSession';
import {
    ArrowLeft, ExternalLink, Circle, CircleCheck,
    Headphones, Play, Bookmark, Share2,
    ChevronLeft, ChevronRight, Maximize2, Type
} from 'lucide-react-native';
import { useColors, borderRadius, spacing, typography } from '@/theme';
import { extractVideoId, getEmbedUrl, isYouTubeUrl } from '@/utils/youtube';
import { shareContent } from '@/utils/share';
import { initWebBrowser, cleanupWebBrowser, openExternalLink } from '@/utils/externalLink';
import ArticleContent from '@/components/ArticleContent';
import { ReaderControls } from '@/components/ReaderControls';
import { VideoModal } from '@/components/VideoModal';
import { ErrorView } from '@/components/ErrorView';
import { UI } from '@/config/constants';
import { useShallow } from 'zustand/react/shallow';

const iconButtonHitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

export default function ArticleScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const articleId = Number(id);
    const router = useRouter();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const [
        currentArticle,
        fetchArticle,
        markRead,
        markUnread,
        toggleBookmark,
        articles,
        setArticleScrollPosition,
        getArticleScrollPosition,
        error,
    ] = useArticleStore(
        useShallow((state) => [
            state.currentArticle,
            state.fetchArticle,
            state.markRead,
            state.markUnread,
            state.toggleBookmark,
            state.articles,
            state.setArticleScrollPosition,
            state.getArticleScrollPosition,
            state.error,
        ])
    );
    const settings = useSettingsStore((state) => state.settings);
    const show = useToastStore((state) => state.show);
    const showReadability = settings?.readability_enabled ?? false;
    const [iconFailedArticleId, setIconFailedArticleId] = useState<number | null>(null);
    const [readerControlsVisible, setReaderControlsVisible] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const currentArticleIdRef = useRef<number | null>(null);

    const [activeVideoId, playVideo, minimize, closeVideo, isMinimized] = useVideoStore(
        useShallow((state) => [state.activeVideoId, state.playVideo, state.minimize, state.close, state.isMinimized])
    );
    const playPodcast = useAudioStore((state) => state.play);

    // Analytics: Track reading session
    const { updateScrollDepth } = useReadingSession({
        articleId,
        enabled: !!id,
    });
    const contentHeightRef = useRef(0);
    const containerHeightRef = useRef(0);
    const [readingProgressByArticle, setReadingProgressByArticle] = useState<Record<number, number>>({});

    const isYouTube = currentArticle?.feed_type === 'youtube' || isYouTubeUrl(currentArticle?.url || '');
    const videoId = extractVideoId(currentArticle?.url || currentArticle?.thumbnail_url || '');
    // For YouTube videos, always construct a proper watch URL to ensure it opens correctly
    // Don't rely on article.url which might be a feed URL or malformed
    const externalUrl = videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : (currentArticle?.url || null);

    const s = styles(colors, isMobile, insets.bottom, settings?.reader_theme, settings?.reader_width || 'comfortable');

    const [fadeAnim] = useState(() => new Animated.Value(0));
    const isArticleLoaded = currentArticle?.id === articleId;
    const isLoading = !isArticleLoaded;
    const iconFailed = iconFailedArticleId === articleId;
    const readingProgress = readingProgressByArticle[articleId] ?? 0;

    // Initialize WebBrowser for native platforms
    useEffect(() => {
        initWebBrowser();
        return () => {
            cleanupWebBrowser();
        };
    }, []);

    useEffect(() => {
        if (id) {
            fadeAnim.setValue(0);
            fetchArticle(articleId)
                .then(() => {
                    markRead(articleId);
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: Platform.OS !== 'web',
                    }).start();
                })
                .catch(() => undefined);
        }
    }, [id, articleId, fetchArticle, markRead, fadeAnim]);

    useEffect(() => {
        if (!id || !currentArticle || currentArticle.id !== articleId) return;
        fadeAnim.setValue(1);
    }, [currentArticle, currentArticle?.id, id, articleId, fadeAnim]);

    // Derive adjacent articles from store using useMemo instead of useState+useEffect
    const adjacentArticles = useMemo(() => {
        if (id && articles.length > 0) {
            const currentIndex = articles.findIndex(a => a.id === articleId);
            if (currentIndex !== -1) {
                return {
                    prev: currentIndex > 0 ? articles[currentIndex - 1].id : null,
                    next: currentIndex < articles.length - 1 ? articles[currentIndex + 1].id : null
                };
            }
        }
        return { prev: null, next: null };
    }, [id, articles, articleId]);

    // Handle video state when article changes
    useEffect(() => {
        if (currentArticle && activeVideoId) {
            const articleVideoId = extractVideoId(currentArticle.url || currentArticle.thumbnail_url || '');

            // If opening a non-YouTube article or different YouTube video, close the current video
            if (!isYouTube || (articleVideoId && articleVideoId !== activeVideoId)) {
                closeVideo();
            } else if (!isMobile && !isMinimized) {
                // On desktop, minimize video when opening the same YouTube article
                minimize();
            }
        }
    }, [currentArticle, currentArticle?.id, currentArticle?.url, currentArticle?.thumbnail_url, activeVideoId, closeVideo, isYouTube, isMobile, isMinimized, minimize]);

    // Restore scroll position when screen is focused and article is loaded
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Intentional deps for scroll restoration
    useFocusEffect(
        useCallback(() => {
            if (!id || !currentArticle || isLoading) return;

            // Only restore if this is a different article than last viewed
            if (currentArticleIdRef.current !== articleId) {
                const savedPosition = getArticleScrollPosition(articleId);

                // Small delay to ensure ScrollView is laid out
                const timeoutId = setTimeout(() => {
                    if (savedPosition > 0 && scrollViewRef.current) {
                        scrollViewRef.current.scrollTo({ y: savedPosition, animated: false });
                    }
                }, 100);

                currentArticleIdRef.current = articleId;

                return () => clearTimeout(timeoutId);
            }
        }, [id, currentArticle, isLoading, getArticleScrollPosition, articleId])
    );

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offset = event.nativeEvent.contentOffset.y;
            const contentHeight = event.nativeEvent.contentSize.height;
            const containerHeight = event.nativeEvent.layoutMeasurement.height;
            const totalHeight = contentHeight - containerHeight;

        // Store heights for scroll depth calculation
        contentHeightRef.current = contentHeight;
        containerHeightRef.current = containerHeight;

        // Update Reading Progress
        if (totalHeight > 0) {
            const progress = Math.min(offset / totalHeight, 1);
            setReadingProgressByArticle((state) => ({
                ...state,
                [articleId]: progress,
            }));

            // Analytics: Update scroll depth for reading session tracking
            const scrollDepth = calculateScrollDepth(offset, contentHeight, containerHeight);
            updateScrollDepth(scrollDepth);
        }

        // Save scroll position for current article
        if (id && offset > 0) {
            setArticleScrollPosition(articleId, offset);
        }
    };

    const handlePlayVideo = () => {
        if (videoId) playVideo(videoId, currentArticle?.title || '');
    };

    const handlePlayPodcast = () => {
        if (currentArticle) {
            // Close video if playing
            if (activeVideoId) {
                closeVideo();
            }

            playPodcast({
                id: currentArticle.id,
                url: currentArticle.enclosure_url || '',
                title: currentArticle.title,
                author: currentArticle.author || currentArticle.feed_title,
                coverArt: currentArticle.thumbnail_url || currentArticle.hero_image || ''
            });
        }
    };

    const navigateToArticle = useCallback((targetId: number | null) => {
        if (!targetId) {
            show('No more articles in this direction');
            return;
        }
        router.replace(`/(app)/article/${targetId}`);
    }, [router, show]);

    const handleOpenExternal = useCallback(async () => {
        if (externalUrl) {
            try {
                await openExternalLink(externalUrl);
            } catch (error) {
                console.error('Error opening browser:', error);
            }
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
        if (currentArticle) toggleBookmark(currentArticle.id);
    }, [currentArticle, toggleBookmark]);

    const handleShare = useCallback(async () => {
        if (!currentArticle) return;
        try {
            await shareContent({
                title: currentArticle.title,
                message: currentArticle.title,
                url: externalUrl || undefined,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    }, [currentArticle, externalUrl]);

    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Intentional deps for retry handler
    const handleRetry = useCallback(() => {
        if (id) {
            fetchArticle(articleId);
        }
    }, [id, fetchArticle, articleId]);

    const renderReader = () => {
        if (error && !currentArticle) {
            return (
                <ErrorView
                    message={error}
                    onRetry={handleRetry}
                />
            );
        }

        if (!isArticleLoaded) {
            return (
                <View style={s.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            );
        }

        const content = showReadability && currentArticle.readability_content
            ? currentArticle.readability_content
            : currentArticle.content;
        const displayContent = content || currentArticle.summary || '';
        const isContentLoading = isLoading && !content;

        return (
            <View style={s.readerContent}>
                {/* Progress Bar */}
                <View style={s.progressBarContainer}>
                    <View style={[s.progressBar, { width: `${readingProgress * 100}%` }]} />
                </View>

                <View style={s.readerHeader}>
                    <View style={s.headerLeft}>
                        {isMobile && (
                            <TouchableOpacity onPress={() => router.back()} style={s.backButton} hitSlop={iconButtonHitSlop} accessibilityLabel="Go back">
                                <ArrowLeft size={22} color={colors.text.primary} />
                            </TouchableOpacity>
                        )}
                        <View style={s.navigation}>
                            <TouchableOpacity
                                onPress={() => navigateToArticle(adjacentArticles.prev)}
                                style={[s.navButton, !adjacentArticles.prev && s.navButtonDisabled]}
                                disabled={!adjacentArticles.prev}
                                hitSlop={iconButtonHitSlop}
                                accessibilityLabel="Previous article"
                            >
                                <ChevronLeft size={18} color={adjacentArticles.prev ? colors.primary.DEFAULT : colors.text.tertiary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigateToArticle(adjacentArticles.next)}
                                style={[s.navButton, !adjacentArticles.next && s.navButtonDisabled]}
                                disabled={!adjacentArticles.next}
                                hitSlop={iconButtonHitSlop}
                                accessibilityLabel="Next article"
                            >
                                <ChevronRight size={18} color={adjacentArticles.next ? colors.primary.DEFAULT : colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={s.headerActions}>
                        <TouchableOpacity
                            onPress={() => setReaderControlsVisible((prev) => !prev)}
                            style={s.actionButton}
                            hitSlop={iconButtonHitSlop}
                            accessibilityLabel={readerControlsVisible ? 'Close reader settings' : 'Open reader settings'}
                        >
                            <Type size={18} color={readerControlsVisible ? colors.primary.DEFAULT : colors.text.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleToggleRead} style={s.actionButton} hitSlop={iconButtonHitSlop} accessibilityLabel={currentArticle.is_read ? 'Mark as unread' : 'Mark as read'}>
                            {currentArticle.is_read ? (
                                <CircleCheck size={20} color={colors.primary.DEFAULT} />
                            ) : (
                                <Circle size={20} color={colors.text.secondary} />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleToggleBookmark} style={s.actionButton} hitSlop={iconButtonHitSlop} accessibilityLabel={currentArticle.is_bookmarked ? 'Remove bookmark' : 'Bookmark article'}>
                            <Bookmark size={20} color={currentArticle.is_bookmarked ? colors.primary.DEFAULT : colors.text.secondary} fill={currentArticle.is_bookmarked ? colors.primary.DEFAULT : 'transparent'} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleShare} style={s.actionButton} hitSlop={iconButtonHitSlop} accessibilityLabel="Share article">
                            <Share2 size={20} color={colors.text.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleOpenExternal} style={s.actionButton} hitSlop={iconButtonHitSlop} accessibilityLabel="Open original article">
                            <ExternalLink size={20} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    ref={scrollViewRef}
                    style={s.scrollView}
                    contentContainerStyle={s.scrollContent}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >
                    <Animated.View style={[s.contentContainer, { opacity: fadeAnim }]}>
                        <View style={s.articleIntro}>
                            <View style={s.feedHeader}>
                            {currentArticle.feed_icon_url && !iconFailed ? (
                                    <Image
                                        source={{ uri: currentArticle.feed_icon_url }}
                                        style={s.feedIcon}
                                        onError={() => setIconFailedArticleId(articleId)}
                                    />
                                ) : (
                                    <View style={s.feedInitial}>
                                        <Text style={s.initialText}>{currentArticle.feed_title?.charAt(0)}</Text>
                                    </View>
                                )}
                                <Text style={s.feedName}>{currentArticle.feed_title}</Text>
                            </View>
                            <Text style={s.title}>{currentArticle.title}</Text>

                            <View style={s.meta}>
                                {currentArticle.author && <Text style={s.author}>{currentArticle.author}</Text>}
                                {currentArticle.published_at && (
                                    <Text style={s.date}>
                                        {formatDistanceToNow(new Date(currentArticle.published_at), { addSuffix: true })} • 5 min read
                                    </Text>
                                )}
                            </View>
                            {isContentLoading && (
                                <View style={s.inlineLoading}>
                                    <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                                    <Text style={s.inlineLoadingText}>Loading full article…</Text>
                                </View>
                            )}

                            {currentArticle.has_audio && (
                                <TouchableOpacity style={s.listenButton} onPress={handlePlayPodcast} activeOpacity={0.8}>
                                    <Headphones size={18} color={colors.primary.DEFAULT} />
                                    <Text style={s.listenButtonText}>Listen to Podcast</Text>
                                </TouchableOpacity>
                            )}

                            {isYouTube && videoId && Platform.OS === 'web' && (
                                <View style={s.videoContainer}>
                                    {isMobile ? (
                                        <View style={s.mobileVideoWrapper}>
                                            <iframe
                                                src={getEmbedUrl(videoId, false, true)}
                                                style={{ width: '100%', height: '100%', border: 'none', borderRadius: borderRadius.lg }}
                                                allowFullScreen
                                                title="Inline YouTube preview"
                                                loading="lazy"
                                            />
                                            <TouchableOpacity style={s.mobilePipToggle} onPress={() => playVideo(videoId, currentArticle.title)}>
                                                <Maximize2 size={16} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={s.videoPlaceholder} onPress={handlePlayVideo} activeOpacity={0.9}>
                                            <Image source={{ uri: currentArticle.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` }} style={s.heroImageFull} resizeMode="cover" />
                                            <View style={s.playOverlay}><View style={s.playButton}><Play size={32} color="#fff" fill="#fff" style={{ marginLeft: 4 }} /></View></View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>

                        <ArticleContent html={displayContent} />
                    </Animated.View>
                </ScrollView>

                <ReaderControls
                    visible={readerControlsVisible}
                    onClose={() => setReaderControlsVisible(false)}
                />
            </View>
        );
    };

    return (
        <View testID="article-detail" style={s.container}>
            {isMobile ? renderReader() : <View style={s.readerPane}>{renderReader()}</View>}

            <VideoModal
                videoId={activeVideoId}
                visible={!!activeVideoId && !isMinimized}
                onClose={closeVideo}
                onMinimize={minimize}
                title={currentArticle?.title || ''}
            />
        </View>
    );
}

const styles = (
    colors: any,
    isMobile: boolean,
    bottomInset: number,
    readerTheme?: string,
    readerWidth: 'narrow' | 'comfortable' | 'wide' = 'comfortable'
) => {
    let bgColor = colors.background.primary;
    if (readerTheme === 'sepia') bgColor = colors.reader.sepia.background;
    if (readerTheme === 'paper') bgColor = colors.reader.paper.background;
    const maxContentWidth = readerWidth === 'narrow'
        ? 640
        : readerWidth === 'wide'
            ? 880
            : 740;

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: bgColor,
        },
        readerPane: {
            flex: 1,
            backgroundColor: bgColor,
        },
        readerContent: {
            flex: 1,
        },
        progressBarContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 100,
            backgroundColor: 'transparent',
        },
        progressBar: {
            height: '100%',
            backgroundColor: colors.primary.DEFAULT,
        },
        readerHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.sm,
            backgroundColor: colors.background.primary,
            minHeight: UI.HEADER_HEIGHT,
            gap: spacing.md,
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            flexShrink: 1,
        },
        backButton: {
            padding: spacing.xs,
            marginLeft: -spacing.xs,
            borderRadius: borderRadius.md,
            backgroundColor: 'transparent',
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
        },
        navigation: {
            flexDirection: 'row',
            gap: spacing.xs,
        },
        navButton: {
            padding: 6,
            borderRadius: borderRadius.md,
            backgroundColor: 'transparent',
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
        },
        navButtonDisabled: {
            opacity: 0.4,
        },
        headerActions: {
            flexDirection: 'row',
            gap: spacing.xs,
            flexShrink: 0,
        },
        actionButton: {
            width: 44,
            height: 44,
            borderRadius: borderRadius.md,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'transparent',
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        scrollView: {
            flex: 1,
        },
        inlineLoading: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        inlineLoadingText: {
            fontSize: 12,
            color: colors.text.tertiary,
            fontWeight: '600',
        },
        scrollContent: {
            alignItems: 'center',
            paddingTop: spacing.xl,
            paddingBottom: Math.max(bottomInset + 72, 96),
        },
        contentContainer: {
            width: '100%',
            maxWidth: maxContentWidth,
            paddingHorizontal: spacing.lg,
        },
        articleIntro: {
            width: '100%',
            paddingBottom: spacing.lg,
            marginBottom: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.DEFAULT,
        },
        feedHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginBottom: spacing.xs,
        },
        feedIcon: {
            width: 16,
            height: 16,
            borderRadius: 4,
        },
        feedInitial: {
            width: 16,
            height: 16,
            borderRadius: 4,
            backgroundColor: colors.primary.DEFAULT,
            justifyContent: 'center',
            alignItems: 'center',
        },
        initialText: {
            color: '#fff',
            fontSize: 9,
            fontWeight: '900',
        },
        feedName: {
            ...typography.small,
            color: colors.text.secondary,
            fontWeight: '700',
        },
        title: {
            fontFamily: typography.sans.family,
            fontSize: isMobile ? 24 : 28,
            fontWeight: '800',
            color: colors.text.primary,
            lineHeight: isMobile ? 30 : 34,
            marginBottom: spacing.sm,
            letterSpacing: isMobile ? -0.8 : -1,
        },
        meta: {
            flexDirection: 'row',
            gap: spacing.xs,
            marginBottom: spacing.md,
            opacity: 0.7,
            flexWrap: 'wrap',
        },
        author: {
            ...typography.body,
            color: colors.text.primary,
            fontWeight: '700',
        },
        date: {
            ...typography.body,
            color: colors.text.secondary,
        },
        videoContainer: {
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            marginBottom: spacing.xl,
            backgroundColor: colors.background.tertiary,
        },
        mobileVideoWrapper: {
            flex: 1,
            position: 'relative',
        },
        mobilePipToggle: {
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: 6,
            borderRadius: 4,
        },
        videoPlaceholder: {
            width: '100%',
            height: '100%',
            position: 'relative',
            justifyContent: 'center',
            alignItems: 'center',
        },
        heroImageFull: {
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
            backgroundColor: 'rgba(0,0,0,0.1)',
        },
        playButton: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.primary.DEFAULT,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 5,
        },
        listenButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background.secondary,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: borderRadius.full,
            alignSelf: 'flex-start',
            marginBottom: spacing.lg,
            gap: 6,
            borderWidth: 1,
            borderColor: colors.primary.DEFAULT,
        },
        listenButtonText: {
            color: colors.primary.DEFAULT,
            fontSize: 13,
            fontWeight: '700',
        },
    });
};
