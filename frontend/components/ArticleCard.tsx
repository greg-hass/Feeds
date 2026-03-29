import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import { Headphones } from 'lucide-react-native';
import { Article } from '@/services/api';
import { useColors, borderRadius } from '@/theme';
import { extractVideoId } from '@/utils/youtube';
import { densitySpacing, fontSizes } from '@/utils/densitySpacing';
import ArticleFooter from './ArticleFooter';
import YouTubePlayer from './YouTubePlayer';

interface ArticleCardProps {
    testID?: string;
    item: Article;
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
}

/**
 * ArticleCard - Memoized component for rendering individual articles
 * Prevents unnecessary re-renders when parent state changes
 */
const ArticleCard = React.memo<ArticleCardProps>(({
    testID,
    item,
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
}) => {
    const colors = useColors();
    const [iconFailed, setIconFailed] = useState(false);

    const s = styles(colors, isMobile);

    const thumbnail = item.thumbnail_url;
    const isYouTube = item.feed_type === 'youtube';
    const videoId = isYouTube ? extractVideoId(item.url || '') : null;
    const isShort = !!(isYouTube && item.url?.includes('/shorts/'));
    const isVideoPlaying = !!(isYouTube && videoId && activeVideoId === videoId);
    const isFeatured = !!(isYouTube && thumbnail);

    const cardHeader = (
        <View style={s.cardBody}>
            <View style={{ flex: 1 }}>
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
                    <Text style={s.feedName} numberOfLines={1}>
                        {item.feed_title}
                    </Text>
                </View>

                <Text style={[
                    s.articleTitle,
                    item.is_read && s.articleTitleRead
                ]} numberOfLines={2}>
                    {item.title}
                </Text>

                {!isYouTube && item.summary && (
                    <Text style={s.featuredSummary} numberOfLines={2}>
                        {item.summary?.replace(/<[^>]*>?/gm, '')}
                    </Text>
                )}
            </View>

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
                            <Headphones size={12} color={colors.text.inverse} />
                        </View>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );

    const footer = (
        <ArticleFooter
            item={item}
            onBookmarkToggle={onBookmarkToggle}
            getBookmarkScale={getBookmarkScale}
            getBookmarkRotation={getBookmarkRotation}
        />
    );

    if (isYouTube) {
        return (
            <View
                testID={testID || `article-card-${item.id}`}
                style={[
                    s.articleCard,
                    item.is_read && s.articleRead,
                    isActive && s.articleActive,
                    isFeatured && s.articleFeatured
                ]}
                accessibilityRole="summary"
                accessibilityLabel={`Article: ${item.title}`}
                accessibilityState={{ selected: isActive }}
            >
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => onVideoPress(item)}
                    onLongPress={onLongPress}
                    delayLongPress={200}
                    accessibilityRole="button"
                    accessibilityLabel={`Play video: ${item.title}`}
                    accessibilityHint="Double tap to open inline video"
                >
                    {cardHeader}
                </TouchableOpacity>
                {footer}
                {videoId && (
                    <YouTubePlayer
                        videoId={videoId}
                        thumbnail={thumbnail ?? null}
                        isPlaying={isVideoPlaying}
                        isShort={isShort}
                        onPress={() => onVideoPress(item)}
                    />
                )}
                {!item.is_read && <View style={s.unreadIndicator} />}
                <View style={s.separator} />
            </View>
        );
    }

    return (
        <TouchableOpacity
            testID={testID || `article-card-${item.id}`}
            activeOpacity={0.9}
            onPress={() => onArticlePress(item)}
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
            {cardHeader}
            {footer}
            {!item.is_read && <View style={s.unreadIndicator} />}
            <View style={s.separator} />
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
        backgroundColor: colors.background.primary,
        paddingHorizontal: densitySpacing.md,
        paddingVertical: densitySpacing.md,
        marginBottom: densitySpacing.sm,
        position: 'relative' as const,
        overflow: 'hidden' as const,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        borderRadius: borderRadius.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 1,
        ...Platform.select({
            web: {
                cursor: 'pointer' as const,
                transition: 'background-color 0.2s ease',
            } as any,
        }),
    },
    articleActive: {
        backgroundColor: colors.primary.soft,
        borderColor: colors.primary.DEFAULT,
    },
    articleFeatured: {
        paddingHorizontal: densitySpacing.md,
        paddingVertical: densitySpacing.md,
    },
    articleRead: {
        opacity: 0.78,
    },
    cardBody: {
        flexDirection: 'row' as const,
        gap: densitySpacing.md,
        alignItems: 'flex-start' as const,
    },
    cardInfo: {
        flex: 1,
    },
    feedPill: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 3,
        paddingHorizontal: 6,
        alignSelf: 'flex-start' as const,
        marginBottom: 6,
        gap: 5,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
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
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    },
    initialText: {
        color: colors.text.inverse,
        fontSize: 9,
        fontWeight: '900' as const,
    },
    feedName: {
        fontSize: 12,
        fontWeight: '600' as const,
        color: colors.text.tertiary,
        maxWidth: 210,
    },
    articleTitle: {
        fontSize: fontSizes.title - 1,
        fontWeight: '700' as const,
        color: colors.text.primary,
        lineHeight: 21,
        marginBottom: 6,
    },
    articleTitleRead: {
        color: colors.text.secondary,
    },
    featuredSummary: {
        fontSize: fontSizes.summary - 1,
        color: colors.text.secondary,
        lineHeight: 18,
        marginBottom: 4,
    },
    thumbnailWrapper: {
        width: isMobile ? 72 : 84,
        height: isMobile ? 72 : 84,
        borderRadius: borderRadius.md,
        overflow: 'hidden' as const,
        position: 'relative' as const,
        aspectRatio: 1,
    },
    featuredThumbnailWrapper: {
        width: isMobile ? 72 : 84,
        height: isMobile ? 72 : 84,
        aspectRatio: 1,
        borderRadius: borderRadius.md,
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
        width: 22,
        height: 22,
        borderRadius: 11,
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
        top: densitySpacing.md,
        left: densitySpacing.md,
        width: 3,
        height: 18,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary.DEFAULT,
    },
    separator: {
        position: 'absolute' as const,
        left: densitySpacing.md,
        right: densitySpacing.md,
        bottom: 0,
        height: 1,
        backgroundColor: colors.border.light ?? colors.border.DEFAULT,
    },
});
