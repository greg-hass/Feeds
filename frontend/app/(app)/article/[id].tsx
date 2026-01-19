import { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Image, useWindowDimensions, Platform, Alert, Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useSettingsStore, useToastStore, useVideoStore, useAudioStore } from '@/stores';
import { Article, api } from '@/services/api';
import {
    ArrowLeft, ExternalLink, Circle, CircleCheck,
    Headphones, BookOpen, Play, Bookmark,
    ChevronLeft, ChevronRight, Maximize2, Pause
} from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getEmbedUrl, isYouTubeUrl } from '@/utils/youtube';
import ArticleContent from '@/components/ArticleContent';
import { VideoModal } from '@/components/VideoModal';
import { ReaderControls } from '@/components/ReaderControls';
import { PodcastPlayer } from '@/components/PodcastPlayer';

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

    // Zen Mode & Progress
    const [scrollOffset, setScrollOffset] = useState(0);
    const headerOpacity = useRef(new Animated.Value(1)).current;
    const [readingProgress, setReadingProgress] = useState(0);

    const { activeVideoId, playVideo, minimize, close: closeVideo, isMinimized } = useVideoStore();
    const { play: playPodcast, isPlaying: isAudioPlaying, showPlayer } = useAudioStore();
    const [adjacentArticles, setAdjacentArticles] = useState<{ prev: number | null; next: number | null }>({ prev: null, next: null });

    const isYouTube = currentArticle?.feed_type === 'youtube' || isYouTubeUrl(currentArticle?.url || '');
    const videoId = extractVideoId(currentArticle?.url || currentArticle?.thumbnail_url || '');
    const externalUrl = currentArticle?.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);

    const s = styles(colors, isMobile, settings?.reader_theme);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (settings?.readability_enabled !== undefined) {
            setShowReadability(settings.readability_enabled);
        }
    }, [settings?.readability_enabled]);

    useEffect(() => {
        if (id) {
            if (!isMobile && activeVideoId && !isMinimized) {
                minimize();
            }

            setIsLoading(true);
            fadeAnim.setValue(0);
            setReadingProgress(0);
            fetchArticle(Number(id))
                .then(() => {
                    markRead(Number(id));
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }).start();
                })
                .finally(() => setIsLoading(false));
        }
    }, [id]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offset = event.nativeEvent.contentOffset.y;
        const totalHeight = event.nativeEvent.contentSize.height - event.nativeEvent.layoutMeasurement.height;

        // Update Reading Progress
        if (totalHeight > 0) {
            const progress = Math.min(offset / totalHeight, 1);
            setReadingProgress(progress);
        }

        // Zen Mode: Hide header on scroll down
        if (offset > 100 && offset > scrollOffset) {
            Animated.timing(headerOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start();
        } else if (offset < scrollOffset || offset < 50) {
            Animated.timing(headerOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
        setScrollOffset(offset);
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

    const navigateToArticle = useCallback((articleId: number | null) => {
        if (!articleId) {
            show('No more articles in this direction');
            return;
        }
        router.replace(`/(app)/article/${articleId}`);
    }, [router, show]);

    const handleOpenExternal = useCallback(() => {
        if (externalUrl) Linking.openURL(externalUrl);
    }, [externalUrl]);

    const handleToggleRead = useCallback(() => {
        if (!currentArticle) return;
        currentArticle.is_read ? markUnread(currentArticle.id) : markRead(currentArticle.id);
    }, [currentArticle, markRead, markUnread]);

    const handleToggleBookmark = useCallback(() => {
        if (currentArticle) toggleBookmark(currentArticle.id);
    }, [currentArticle, toggleBookmark]);

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
                {/* Progress Bar */}
                <View style={s.progressBarContainer}>
                    <View style={[s.progressBar, { width: `${readingProgress * 100}%` }]} />
                </View>

                {/* Animated Header */}
                <Animated.View style={[s.readerHeader, {
                    opacity: headerOpacity,
                    transform: [{
                        translateY: headerOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-10, 0]
                        })
                    }]
                }]}>
                    <View style={s.headerLeft}>
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
                    </View>

                    <View style={s.headerActions}>
                        <TouchableOpacity onPress={handleToggleRead} style={s.actionButton}>
                            {currentArticle.is_read ? (
                                <CircleCheck size={22} color={colors.primary.DEFAULT} />
                            ) : (
                                <Circle size={22} color={colors.text.secondary} />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleToggleBookmark} style={s.actionButton}>
                            <Bookmark size={22} color={currentArticle.is_bookmarked ? colors.primary.DEFAULT : colors.text.secondary} fill={currentArticle.is_bookmarked ? colors.primary.DEFAULT : 'transparent'} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleOpenExternal} style={s.actionButton}>
                            <ExternalLink size={22} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                <ScrollView
                    style={s.scrollView}
                    contentContainerStyle={s.scrollContent}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >
                    <Animated.View style={[s.contentContainer, { opacity: fadeAnim }]}>
                        <Text style={s.feedName}>{currentArticle.feed_title}</Text>
                        <Text style={s.title}>{currentArticle.title}</Text>

                        <View style={s.meta}>
                            {currentArticle.author && <Text style={s.author}>{currentArticle.author}</Text>}
                            {currentArticle.published_at && (
                                <Text style={s.date}>
                                    {formatDistanceToNow(new Date(currentArticle.published_at), { addSuffix: true })} • 5 min read
                                </Text>
                            )}
                        </View>

                        {currentArticle.has_audio && (
                            <TouchableOpacity style={s.listenButton} onPress={handlePlayPodcast} activeOpacity={0.8}>
                                <Headphones size={20} color="#fff" />
                                <Text style={s.listenButtonText}>Listen to Podcast</Text>
                            </TouchableOpacity>
                        )}

                        {isYouTube && videoId && Platform.OS === 'web' && (
                            <View style={s.videoContainer}>
                                {isMobile ? (
                                    <View style={s.mobileVideoWrapper}>
                                        <iframe src={getEmbedUrl(videoId)} style={{ width: '100%', height: '100%', border: 'none', borderRadius: borderRadius.lg }} allowFullScreen />
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

                        <ArticleContent html={content || ''} />
                    </Animated.View>
                </ScrollView>

                <ReaderControls />
            </View>
        );
    };

    return (
        <View style={s.container}>
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

const styles = (colors: any, isMobile: boolean, readerTheme?: string) => {
    let bgColor = colors.background.primary;
    if (readerTheme === 'sepia') bgColor = colors.reader.sepia.background;
    if (readerTheme === 'paper') bgColor = colors.reader.paper.background;

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
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.DEFAULT,
            backgroundColor: colors.background.elevated,
            zIndex: 10,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 4,
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
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
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            alignItems: 'center',
            paddingTop: 100, // Header spacing
            paddingBottom: 140, // Controls spacing
        },
        contentContainer: {
            width: '100%',
            maxWidth: 800,
            padding: spacing.xl,
            borderRadius: isMobile ? 0 : borderRadius.lg,
        },
        feedName: {
            fontSize: 13,
            color: colors.primary.DEFAULT,
            fontWeight: '700',
            marginBottom: spacing.sm,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        title: {
            fontSize: isMobile ? 32 : 46,
            fontWeight: '900',
            color: colors.text.primary,
            lineHeight: isMobile ? 40 : 56,
            marginBottom: spacing.md,
            letterSpacing: -1.5,
        },
        meta: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginBottom: spacing.xl,
            opacity: 0.7,
        },
        author: {
            fontSize: 14,
            color: colors.text.primary,
            fontWeight: '700',
        },
        date: {
            fontSize: 14,
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
            backgroundColor: colors.primary.DEFAULT,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            borderRadius: borderRadius.full,
            alignSelf: 'flex-start',
            marginBottom: spacing.xl,
            gap: spacing.sm,
            shadowColor: colors.primary.DEFAULT,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        listenButtonText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '800',
        },
    });
};
