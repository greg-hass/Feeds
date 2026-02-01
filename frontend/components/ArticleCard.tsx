import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import { Headphones } from 'lucide-react-native';
import { Article } from '@/services/api';
import { useColors, spacing, borderRadius, shadows, animations } from '@/theme';
import { extractVideoId } from '@/utils/youtube';
import { useSettingsStore } from '@/stores';
import { densitySpacing, thumbnailSize, fontSizes, featuredThumbnailHeight } from '@/utils/densitySpacing';
import ArticleFooter from './ArticleFooter';
import YouTubePlayer from './YouTubePlayer';

interface ArticleCardProps {
    item: Article;
    index: number;
    isActive: boolean;
    isMobile: boolean;
    activeVideoId: string | null;
    playingArticleId: number | null;
    isPlaying: boolean;
    onArticlePress: (item: Article) => void;
    onVideoPress: (item: Article) => void;
    onPlayPress: (item: Article) => void;
    onBookmarkToggle: (id: number) => void;
    onLongPress?: () => void;
    getBookmarkScale: (id: number) => Animated.Value;
    getBookmarkRotation: (id: number) => Animated.Value;
    hotPulseAnim: Animated.Value;
}

/**
 * ArticleCard - Memoized component for rendering individual articles
 * Prevents unnecessary re-renders when parent state changes
 */
const ArticleCard = React.memo<ArticleCardProps>(({
    item,
    index,
    isActive,
    isMobile,
    activeVideoId,
    playingArticleId,
    isPlaying,
    onArticlePress,
    onVideoPress,
    onPlayPress,
    onBookmarkToggle,
    onLongPress,
    getBookmarkScale,
    getBookmarkRotation,
    hotPulseAnim,
}) => {
    const colors = useColors();
    const { settings } = useSettingsStore();
    const [iconFailed, setIconFailed] = useState(false);

    const s = styles(colors, isMobile);

    const thumbnail = item.thumbnail_url;
    const isYouTube = item.feed_type === 'youtube';
    const videoId = isYouTube ? extractVideoId(item.url || '') : null;
    const isShort = !!(isYouTube && item.url?.includes('/shorts/'));
    const isVideoPlaying = !!(isYouTube && videoId && activeVideoId === videoId);
    const isFeatured = (index % 5 === 0 && !isMobile && thumbnail) || isYouTube;
    // eslint-disable-next-line react-hooks/purity
    const isHot = !!(item.published_at && (new Date(item.published_at).getTime() > Date.now() - 4 * 60 * 60 * 1000));

    const handleBookmarkPress = () => {
        const scale = getBookmarkScale(item.id);
        const rotation = getBookmarkRotation(item.id);

        // Animate scale
        Animated.sequence([
            Animated.spring(scale, {
                toValue: 1.3,
                ...animations.spring,
                useNativeDriver: true,
            }),
            Animated.spring(scale, {
                toValue: 1,
                ...animations.spring,
                useNativeDriver: true,
            }),
        ]).start();

        // Animate rotation
        Animated.spring(rotation, {
            toValue: item.is_bookmarked ? 0 : 1,
            ...animations.spring,
            useNativeDriver: true,
        }).start();

        onBookmarkToggle(item.id);
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => isYouTube ? onVideoPress(item) : onArticlePress(item)}
            onLongPress={onLongPress}
            delayLongPress={200}
            style={[
                s.articleCard,
                item.is_read && s.articleRead,
                isActive && s.articleActive,
                isFeatured && s.articleFeatured
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Article: ${item.title}`}
            accessibilityHint={item.is_read ? "Read article" : "Unread article, double tap to open"}
            accessibilityState={{ selected: isActive }}
        >
            {/* Header + Info + Thumbnail section */}
            <View style={isFeatured && !isYouTube ? [s.cardBody, s.featuredBody] : s.cardBody}>
                <View style={{ flex: 1 }}>
                    {/* Feed Pill */}
                    <View style={s.feedPill}>
                        {item.feed_icon_url && !iconFailed ? (
                            <Image 
                                source={{ uri: item.feed_icon_url }} 
                                style={s.feedIcon}
                                onError={() => setIconFailed(true)}
                            />
                        ) : (
                            <View style={s.feedInitial}>
                                <Text style={s.initialText}>{item.feed_title?.charAt(0)}</Text>
                            </View>
                        )}
                        <Text style={s.feedName} numberOfLines={1}>{item.feed_title}</Text>
                    </View>

                    {/* Title */}
                    <Text style={[
                        s.articleTitle,
                        item.is_read && s.articleTitleRead
                    ]} numberOfLines={3}>
                        {item.title}
                    </Text>

                    {/* Summary for featured non-YouTube articles */}
                    {!isYouTube && isFeatured && (
                        <Text style={s.featuredSummary} numberOfLines={3}>
                            {item.summary?.replace(/<[^>]*>?/gm, '')}
                        </Text>
                    )}
                </View>

                {/* Thumbnail */}
                {!isYouTube && thumbnail && (
                    <TouchableOpacity
                        style={[s.thumbnailWrapper, isFeatured && s.featuredThumbnailWrapper]}
                        onPress={item.has_audio ? () => onPlayPress(item) : undefined}
                        activeOpacity={item.has_audio ? 0.8 : 1}
                        disabled={!item.has_audio}
                    >
                        <Image source={{ uri: thumbnail }} style={s.thumbnail} resizeMode="cover" />
                        {item.has_audio && (
                            <View style={s.podcastIndicator}>
                                <Headphones size={12} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Footer with metadata and bookmark */}
            <ArticleFooter
                item={item}
                isHot={isHot}
                hotPulseAnim={hotPulseAnim}
                onBookmarkToggle={onBookmarkToggle}
                getBookmarkScale={getBookmarkScale}
                getBookmarkRotation={getBookmarkRotation}
            />

            {/* YouTube Video - shown after footer */}
            {isYouTube && videoId && (
                <YouTubePlayer
                    videoId={videoId}
                    thumbnail={thumbnail ?? null}
                    isPlaying={isVideoPlaying}
                    isShort={isShort}
                    onPress={() => onVideoPress(item)}
                />
            )}

            {/* Unread Indicator */}
            {!item.is_read && <View style={s.unreadIndicator} />}
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function - only re-render if these props change
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.is_read === nextProps.item.is_read &&
        prevProps.item.is_bookmarked === nextProps.item.is_bookmarked &&
        prevProps.isActive === nextProps.isActive &&
        prevProps.activeVideoId === nextProps.activeVideoId &&
        prevProps.playingArticleId === nextProps.playingArticleId &&
        prevProps.isPlaying === nextProps.isPlaying
    );
});

ArticleCard.displayName = 'ArticleCard';

export default ArticleCard;

// Styles extracted from Timeline
const styles = (
    colors: any,
    isMobile: boolean
) => ({
    articleCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        padding: densitySpacing.lg,
        marginBottom: densitySpacing.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        position: 'relative' as const,
        overflow: 'hidden' as const,
        ...shadows.md,
        ...Platform.select({
            web: {
                cursor: 'pointer' as const,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            } as any,
        }),
    },
    articleActive: {
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.DEFAULT + '44',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    articleFeatured: {
        padding: densitySpacing.xl,
    },
    articleRead: {
        opacity: 0.6,
    },
    cardBody: {
        flexDirection: 'row' as const,
        gap: densitySpacing.md,
    },
    featuredBody: {
        flexDirection: 'column-reverse' as const,
        gap: densitySpacing.lg,
    },
    cardInfo: {
        flex: 1,
    },
    feedPill: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: densitySpacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
        alignSelf: 'flex-start' as const,
        marginBottom: densitySpacing.sm,
        gap: 8, // Increased gap for larger icon
    },
    feedIcon: {
        width: 20, // Updated to 20
        height: 20, // Updated to 20
        borderRadius: 4, // Slightly larger radius
    },
    feedInitial: {
        width: 20, // Updated to 20
        height: 20, // Updated to 20
        borderRadius: 4, // Slightly larger radius
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    },
    initialText: {
        color: '#fff',
        fontSize: 10, // Increased font size for initial
        fontWeight: '900' as const,
    },
    feedName: {
        fontSize: fontSizes.feedName,
        fontWeight: '700' as const,
        color: colors.text.secondary,
        maxWidth: 150,
    },
    articleTitle: {
        fontSize: fontSizes.title,
        fontWeight: '700' as const,
        color: colors.text.primary,
        lineHeight: 22,
        marginBottom: densitySpacing.md,
    },
    articleTitleRead: {
        color: colors.text.secondary,
    },
    featuredSummary: {
        fontSize: fontSizes.summary,
        color: colors.text.secondary,
        lineHeight: 20,
        marginBottom: densitySpacing.md,
    },
    thumbnailWrapper: {
        width: thumbnailSize.width,
        height: thumbnailSize.height,
        borderRadius: borderRadius.lg,
        overflow: 'hidden' as const,
        position: 'relative' as const,
        aspectRatio: 1, // Ensure it stays square
    },
    featuredThumbnailWrapper: {
        width: '100%' as const,
        height: featuredThumbnailHeight,
        aspectRatio: 16 / 9,
        borderRadius: borderRadius.xl,
    },
    thumbnail: {
        width: '100%' as const,
        height: '100%' as const,
    },
    podcastIndicator: {
        position: 'absolute' as const,
        bottom: 6,
        right: 6,
        backgroundColor: colors.primary.DEFAULT,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10,
    },
    unreadIndicator: {
        position: 'absolute' as const,
        top: spacing.lg,
        right: spacing.lg,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary.DEFAULT,
    },
});
