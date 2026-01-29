import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Play, Pause, Clock, Headphones, ChevronRight } from 'lucide-react-native';
import { Article } from '@/services/api';
import { useColors, spacing, borderRadius, shadows } from '@/theme';
import { useAudioStore } from '@/stores/audioStore';
import { formatDistanceToNow } from 'date-fns';

interface PodcastSectionProps {
    articles: Article[];
    maxPerFeed?: number;
}

interface PodcastGroup {
    feedId: number;
    feedTitle: string;
    feedIconUrl: string | null;
    podcasts: Article[];
}

/**
 * PodcastSection - Premium podcast browsing experience
 * Groups podcasts by feed and shows max 5 per feed
 */
export const PodcastSection: React.FC<PodcastSectionProps> = ({
    articles,
    maxPerFeed = 5,
}) => {
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const { currentArticleId, isPlaying, play, pause, resume } = useAudioStore();

    // Group podcasts by feed, limiting to maxPerFeed per feed
    const podcastGroups = useMemo(() => {
        const groups = new Map<number, PodcastGroup>();
        
        articles.forEach((article) => {
            if (!article.has_audio) return;
            
            const existing = groups.get(article.feed_id);
            if (existing) {
                if (existing.podcasts.length < maxPerFeed) {
                    existing.podcasts.push(article);
                }
            } else {
                groups.set(article.feed_id, {
                    feedId: article.feed_id,
                    feedTitle: article.feed_title,
                    feedIconUrl: article.feed_icon_url,
                    podcasts: [article],
                });
            }
        });
        
        return Array.from(groups.values());
    }, [articles, maxPerFeed]);

    const handlePlayPodcast = (podcast: Article) => {
        if (currentArticleId === podcast.id) {
            isPlaying ? pause() : resume();
        } else {
            play({
                id: podcast.id,
                url: podcast.enclosure_url || '',
                title: podcast.title,
                author: podcast.feed_title || 'Unknown Source',
                coverArt: podcast.thumbnail_url || podcast.feed_icon_url || '',
            });
        }
    };

    const s = styles(colors, isMobile);

    if (podcastGroups.length === 0) return null;

    return (
        <View style={s.container}>
            {/* Section Header */}
            <View style={s.sectionHeader}>
                <View style={s.sectionTitleRow}>
                    <View style={s.iconContainer}>
                        <Headphones size={20} color="#fff" />
                    </View>
                    <Text style={s.sectionTitle}>Podcasts</Text>
                </View>
                <Text style={s.sectionSubtitle}>
                    {podcastGroups.reduce((acc, g) => acc + g.podcasts.length, 0)} episodes from {podcastGroups.length} shows
                </Text>
            </View>

            {/* Podcast Groups */}
            {podcastGroups.map((group) => (
                <PodcastFeedGroup
                    key={group.feedId}
                    group={group}
                    colors={colors}
                    isMobile={isMobile}
                    currentArticleId={currentArticleId}
                    isPlaying={isPlaying}
                    onPlay={handlePlayPodcast}
                />
            ))}
        </View>
    );
};

interface PodcastFeedGroupProps {
    group: PodcastGroup;
    colors: any;
    isMobile: boolean;
    currentArticleId: number | null;
    isPlaying: boolean;
    onPlay: (podcast: Article) => void;
}

const PodcastFeedGroup: React.FC<PodcastFeedGroupProps> = ({
    group,
    colors,
    isMobile,
    currentArticleId,
    isPlaying,
    onPlay,
}) => {
    const s = groupStyles(colors, isMobile);

    return (
        <View style={s.groupContainer}>
            {/* Feed Header */}
            <View style={s.feedHeader}>
                <View style={s.feedInfo}>
                    {group.feedIconUrl ? (
                        <Image source={{ uri: group.feedIconUrl }} style={s.feedIcon} />
                    ) : (
                        <View style={s.feedIconPlaceholder}>
                            <Text style={s.feedIconText}>{group.feedTitle.charAt(0)}</Text>
                        </View>
                    )}
                    <View style={s.feedTextContainer}>
                        <Text style={s.feedTitle} numberOfLines={1}>{group.feedTitle}</Text>
                        <Text style={s.feedCount}>{group.podcasts.length} episodes</Text>
                    </View>
                </View>
                <ChevronRight size={16} color={colors.text.tertiary} />
            </View>

            {/* Podcast Episodes - Horizontal Scroll */}
            <Animated.ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.episodesContainer}
                decelerationRate="fast"
                snapToInterval={isMobile ? 280 : 320}
                snapToAlignment="start"
            >
                {group.podcasts.map((podcast, index) => (
                    <PodcastCard
                        key={podcast.id}
                        podcast={podcast}
                        index={index}
                        colors={colors}
                        isMobile={isMobile}
                        isPlaying={currentArticleId === podcast.id && isPlaying}
                        isCurrent={currentArticleId === podcast.id}
                        onPlay={() => onPlay(podcast)}
                    />
                ))}
            </Animated.ScrollView>
        </View>
    );
};

interface PodcastCardProps {
    podcast: Article;
    index: number;
    colors: any;
    isMobile: boolean;
    isPlaying: boolean;
    isCurrent: boolean;
    onPlay: () => void;
}

// Animated waveform component for playing indicator
const PlayingWaveform: React.FC = () => {
    const anim1 = useRef(new Animated.Value(8)).current;
    const anim2 = useRef(new Animated.Value(14)).current;
    const anim3 = useRef(new Animated.Value(10)).current;

    useEffect(() => {
        const createPulse = (anim: Animated.Value, min: number, max: number, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: max,
                        duration: 300,
                        delay,
                        useNativeDriver: false,
                    }),
                    Animated.timing(anim, {
                        toValue: min,
                        duration: 300,
                        useNativeDriver: false,
                    }),
                ])
            );
        };

        const pulse1 = createPulse(anim1, 6, 16, 0);
        const pulse2 = createPulse(anim2, 10, 20, 100);
        const pulse3 = createPulse(anim3, 8, 14, 200);

        pulse1.start();
        pulse2.start();
        pulse3.start();

        return () => {
            pulse1.stop();
            pulse2.stop();
            pulse3.stop();
        };
    }, []);

    return (
        <View style={waveformStyles.container}>
            <Animated.View style={[waveformStyles.bar, { height: anim1 }]} />
            <Animated.View style={[waveformStyles.bar, { height: anim2 }]} />
            <Animated.View style={[waveformStyles.bar, { height: anim3 }]} />
        </View>
    );
};

const waveformStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 20,
    },
    bar: {
        width: 3,
        backgroundColor: '#fff',
        borderRadius: 1.5,
    },
});

const PodcastCard: React.FC<PodcastCardProps> = ({
    podcast,
    index,
    colors,
    isMobile,
    isPlaying,
    isCurrent,
    onPlay,
}) => {
    const s = cardStyles(colors, isMobile);
    const isNew = podcast.published_at && 
        new Date(podcast.published_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;

    return (
        <TouchableOpacity
            style={[s.card, isCurrent && s.cardActive]}
            onPress={onPlay}
            activeOpacity={0.85}
            accessibilityLabel={`Play ${podcast.title}`}
        >
            {/* Cover Art */}
            <View style={s.coverContainer}>
                {podcast.thumbnail_url ? (
                    <Image source={{ uri: podcast.thumbnail_url }} style={s.cover} />
                ) : (
                    <View style={s.coverPlaceholder}>
                        <Headphones size={32} color={colors.text.tertiary} />
                    </View>
                )}
                
                {/* Play Overlay */}
                <View style={[s.playOverlay, isCurrent && s.playOverlayActive]}>
                    {isPlaying ? (
                        <PlayingWaveform />
                    ) : (
                        <Play size={24} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
                    )}
                </View>

                {/* New Badge */}
                {isNew && !isCurrent && (
                    <View style={s.newBadge}>
                        <Text style={s.newBadgeText}>NEW</Text>
                    </View>
                )}
            </View>

            {/* Info */}
            <View style={s.infoContainer}>
                <Text style={[s.title, isCurrent && s.titleActive]} numberOfLines={2}>
                    {podcast.title}
                </Text>
                <View style={s.metaRow}>
                    <Clock size={12} color={colors.text.tertiary} />
                    <Text style={s.metaText}>
                        {formatDistanceToNow(new Date(podcast.published_at || Date.now()), { addSuffix: true })}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// Main section styles
const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.feedTypes.podcast,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    sectionTitle: {
        fontSize: isMobile ? 22 : 26,
        fontWeight: '800',
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: colors.text.secondary,
        marginLeft: 44, // Align with title
    },
});

// Group styles
const groupStyles = (colors: any, isMobile: boolean) => StyleSheet.create({
    groupContainer: {
        marginBottom: spacing.xl,
    },
    feedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    feedInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    feedIcon: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
    },
    feedIconPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.md,
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    feedIconText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#fff',
    },
    feedTextContainer: {
        flex: 1,
    },
    feedTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.primary,
    },
    feedCount: {
        fontSize: 12,
        color: colors.text.tertiary,
        fontWeight: '500',
    },
    episodesContainer: {
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
});

// Card styles
const cardStyles = (colors: any, isMobile: boolean) => StyleSheet.create({
    card: {
        width: isMobile ? 260 : 300,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        ...shadows.md,
    },
    cardActive: {
        borderColor: colors.feedTypes.podcast,
        shadowColor: colors.feedTypes.podcast,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    coverContainer: {
        width: '100%',
        aspectRatio: 1,
        position: 'relative',
        backgroundColor: colors.background.tertiary,
    },
    cover: {
        width: '100%',
        height: '100%',
    },
    coverPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
    },
    playOverlay: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.lg,
    },
    playOverlayActive: {
        backgroundColor: colors.feedTypes.podcast,
    },
    newBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: colors.feedTypes.podcast,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
    },
    newBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 0.5,
    },
    infoContainer: {
        padding: spacing.md,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text.primary,
        lineHeight: 20,
        marginBottom: spacing.xs,
    },
    titleActive: {
        color: colors.feedTypes.podcast,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: colors.text.tertiary,
        fontWeight: '500',
    },
});

export default PodcastSection;
