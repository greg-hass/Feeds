import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import { Bookmark, Clock, Headphones, Play, Flame } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import { Article } from '@/services/api';
import { useColors, spacing, borderRadius, shadows, animations } from '@/theme';
import { extractVideoId } from '@/utils/youtube';

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
    getBookmarkScale,
    getBookmarkRotation,
    hotPulseAnim,
}) => {
    const colors = useColors();
    const s = styles(colors, isMobile);

    const thumbnail = item.thumbnail_url;
    const isYouTube = item.feed_type === 'youtube';
    const videoId = isYouTube ? extractVideoId(item.url || '') : null;
    const isVideoPlaying = isYouTube && videoId && activeVideoId === videoId;
    const isFeatured = (index % 5 === 0 && !isMobile && thumbnail) || isYouTube;
    const isHot = item.published_at && (new Date(item.published_at).getTime() > Date.now() - 4 * 60 * 60 * 1000);

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
            <View style={isFeatured && !isYouTube ? [s.cardBody, s.featuredBody] : s.cardBody}>
                <View style={s.cardInfo}>
                    {/* Feed Pill */}
                    <View style={s.feedPill}>
                        {item.feed_icon_url ? (
                            <Image source={{ uri: item.feed_icon_url }} style={s.feedIcon} />
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

                {/* Thumbnail - positioned consistently */}
                {!isYouTube && thumbnail && (
                    item.has_audio ? (
                        <TouchableOpacity
                            style={[s.thumbnailWrapper, isFeatured && s.featuredThumbnailWrapper]}
                            onPress={() => onPlayPress(item)}
                            activeOpacity={0.8}
                        >
                            <Image source={{ uri: thumbnail }} style={s.thumbnail} resizeMode="cover" />
                            <View style={s.podcastIndicator}>
                                <Headphones size={12} color="#fff" />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View style={[s.thumbnailWrapper, isFeatured && s.featuredThumbnailWrapper]}>
                            <Image source={{ uri: thumbnail }} style={s.thumbnail} resizeMode="cover" />
                        </View>
                    )
                )}
            </View>

            {/* Footer with metadata and bookmark */}
            <View style={s.articleFooter}>
                <View style={s.metaRow}>
                    {/* HOT Badge */}
                    {isHot && (
                        <Animated.View style={{ transform: [{ scale: hotPulseAnim }] }}>
                            <LinearGradient
                                colors={['#f97316', '#ef4444']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={s.hotBadge}
                            >
                                <Flame size={10} color="#fff" fill="#fff" />
                                <Text style={s.hotText}>HOT</Text>
                            </LinearGradient>
                        </Animated.View>
                    )}
                    
                    {/* Time */}
                    <Clock size={12} color={colors.text.tertiary} />
                    <Text style={s.articleMeta}>
                        {item.published_at ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true }) : ''}
                    </Text>
                </View>

                {/* Bookmark Button */}
                <TouchableOpacity
                    onPress={handleBookmarkPress}
                    style={s.cardAction}
                    accessibilityRole="button"
                    accessibilityLabel={item.is_bookmarked ? "Remove bookmark" : "Bookmark article"}
                    accessibilityHint="Double tap to save for later"
                    accessibilityState={{ selected: item.is_bookmarked }}
                >
                    <Animated.View style={{
                        transform: [
                            { scale: getBookmarkScale(item.id) },
                            { rotate: getBookmarkRotation(item.id).interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '360deg'],
                            })}
                        ]
                    }}>
                        <Bookmark
                            size={20}
                            color={item.is_bookmarked ? colors.primary.DEFAULT : colors.text.tertiary}
                            fill={item.is_bookmarked ? colors.primary.DEFAULT : 'transparent'}
                        />
                    </Animated.View>
                </TouchableOpacity>
            </View>

            {/* YouTube Video - shown after footer */}
            {isYouTube && videoId && (
                <View style={s.videoContainer}>
                    {isVideoPlaying ? (
                        <View style={s.webview}>
                            {/* WebView placeholder - actual implementation in parent */}
                        </View>
                    ) : (
                        <View style={s.videoThumbnailWrapper}>
                            <Image 
                                source={{ uri: thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` }} 
                                style={s.thumbnail} 
                                resizeMode="cover" 
                            />
                            <View style={s.playButtonOverlay}>
                                <View style={s.playButtonCircle}>
                                    <Play size={24} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
                                </View>
                            </View>
                        </View>
                    )}
                </View>
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
const styles = (colors: any, isMobile: boolean) => ({
    articleCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
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
        padding: spacing.xl,
    },
    articleRead: {
        opacity: 0.6,
    },
    cardBody: {
        flexDirection: 'row' as const,
        gap: spacing.md,
    },
    featuredBody: {
        flexDirection: 'column-reverse' as const,
        gap: spacing.lg,
    },
    cardInfo: {
        flex: 1,
    },
    feedPill: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
        alignSelf: 'flex-start' as const,
        marginBottom: spacing.sm,
        gap: 6,
    },
    feedIcon: {
        width: 14,
        height: 14,
        borderRadius: 3,
    },
    feedInitial: {
        width: 14,
        height: 14,
        borderRadius: 3,
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    },
    initialText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '900' as const,
    },
    feedName: {
        fontSize: 11,
        fontWeight: '700' as const,
        color: colors.text.secondary,
        maxWidth: 150,
    },
    articleTitle: {
        fontSize: 16,
        fontWeight: '700' as const,
        color: colors.text.primary,
        lineHeight: 22,
        marginBottom: spacing.md,
    },
    articleTitleRead: {
        color: colors.text.secondary,
    },
    featuredSummary: {
        fontSize: 14,
        color: colors.text.secondary,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    articleFooter: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
    },
    metaRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 4,
    },
    articleMeta: {
        fontSize: 11,
        color: colors.text.tertiary,
        fontWeight: '600' as const,
    },
    hotBadge: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 99,
        gap: 3,
        marginRight: 6,
    },
    hotText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900' as const,
        letterSpacing: 0.5,
    },
    cardAction: {
        padding: spacing.sm,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    },
    thumbnailWrapper: {
        width: 90,
        height: 90,
        borderRadius: borderRadius.lg,
        overflow: 'hidden' as const,
        position: 'relative' as const,
    },
    featuredThumbnailWrapper: {
        width: '100%' as const,
        height: 200,
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
    videoContainer: {
        width: '100%' as const,
        height: 220,
        borderRadius: borderRadius.lg,
        overflow: 'hidden' as const,
        marginTop: spacing.md,
        backgroundColor: colors.background.tertiary,
    },
    videoThumbnailWrapper: {
        width: '100%' as const,
        height: '100%' as const,
        position: 'relative' as const,
    },
    webview: {
        flex: 1,
        backgroundColor: colors.background.tertiary,
    },
    playButtonOverlay: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    playButtonCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
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
