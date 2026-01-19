import { useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, Linking, Image, useWindowDimensions, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useFeedStore, useAudioStore } from '@/stores';
import { Article } from '@/services/api';
import { Circle, CircleCheck, Play, Bookmark, MoreVertical, Filter, RefreshCw, Clock, Headphones } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getThumbnailUrl } from '@/utils/youtube';
import { TimelineSkeleton } from './Skeleton';
import { PlayingWaveform } from './PlayingWaveform';

interface TimelineProps {
    onArticlePress?: (article: Article) => void;
    activeArticleId?: number | null;
}

export default function Timeline({ onArticlePress, activeArticleId }: TimelineProps) {
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const { articles, isLoading, hasMore, filter, scrollPosition, fetchArticles, setFilter, setScrollPosition, markAllRead, error, clearError } = useArticleStore();
    const { feeds, folders, refreshAllFeeds } = useFeedStore();
    const { currentArticleId: playingArticleId, isPlaying } = useAudioStore();
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const hasRestoredScroll = useRef(false);

    const s = styles(colors, isMobile);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!feeds || feeds.length === 0) {
                setTimeLeft(null);
                return;
            }

            const now = Date.now();
            let earliestTimestamp: number | null = null;

            for (const f of feeds) {
                if (f.next_fetch_at) {
                    const next = new Date(f.next_fetch_at).getTime();
                    if (!isNaN(next) && (!earliestTimestamp || next < earliestTimestamp)) {
                        earliestTimestamp = next;
                    }
                }
            }

            if (earliestTimestamp) {
                const diff = earliestTimestamp - now;
                if (diff <= 1000) {
                    setTimeLeft('Live');
                } else if (diff < 60000) {
                    setTimeLeft(`${Math.floor(diff / 1000)}s`);
                } else if (diff < 3600000) {
                    const mins = Math.floor(diff / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    setTimeLeft(`${mins}m ${secs}s`);
                } else {
                    const hours = Math.floor(diff / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    setTimeLeft(`${hours}h ${mins}m`);
                }
            } else {
                setTimeLeft(null);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [feeds]);

    const handleMarkAllRead = () => {
        Alert.alert('Mark All Read', 'Mark visible articles as read?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Mark Read', onPress: () => markAllRead('all') }
        ]);
    };

    const handleArticlePress = useCallback((item: Article) => {
        useArticleStore.getState().markRead(item.id);
        if (onArticlePress) onArticlePress(item);
        else router.push(`/(app)/article/${item.id}`);
    }, [onArticlePress, router]);

    const renderArticle = ({ item, index }: { item: Article; index: number }) => {
        const isActive = activeArticleId === item.id;
        const thumbnail = item.thumbnail_url;
        const isYouTube = item.feed_type === 'youtube';
        const isFeatured = index % 5 === 0 && !isMobile && thumbnail; // Every 5th item is featured on desktop

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleArticlePress(item)}
                style={[
                    s.articleCard,
                    item.is_read && s.articleRead,
                    isActive && s.articleActive,
                    isFeatured && s.articleFeatured
                ]}
            >
                <View style={[s.cardBody, isFeatured && s.featuredBody]}>
                    <View style={s.cardInfo}>
                        <View style={s.feedPill}>
                            {item.feed_icon_url ? (
                                <Image source={{ uri: item.feed_icon_url }} style={s.feedIcon} />
                            ) : (
                                <View style={s.feedInitial}><Text style={s.initialText}>{item.feed_title?.charAt(0)}</Text></View>
                            )}
                            <Text style={s.feedName} numberOfLines={1}>{item.feed_title}</Text>
                        </View>

                        <Text style={[
                            s.articleTitle,
                            item.is_read && s.articleTitleRead,
                            isFeatured && s.featuredTitle
                        ]} numberOfLines={isFeatured ? 4 : 3}>
                            {item.title}
                        </Text>

                        {isFeatured && (
                            <Text style={s.featuredSummary} numberOfLines={3}>
                                {item.summary?.replace(/<[^>]*>?/gm, '')}
                            </Text>
                        )}

                        <View style={s.articleFooter}>
                            <View style={s.metaRow}>
                                <Clock size={12} color={colors.text.tertiary} />
                                <Text style={s.articleMeta}>
                                    {item.published_at ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true }) : ''}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => useArticleStore.getState().toggleBookmark(item.id)}
                                style={s.cardAction}
                            >
                                <Bookmark
                                    size={16}
                                    color={item.is_bookmarked ? colors.primary.DEFAULT : colors.text.tertiary}
                                    fill={item.is_bookmarked ? colors.primary.DEFAULT : 'transparent'}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {thumbnail && (
                        <View style={[s.thumbnailWrapper, isFeatured && s.featuredThumbnailWrapper]}>
                            <Image source={{ uri: thumbnail }} style={s.thumbnail} resizeMode="cover" />
                            {isYouTube && (
                                <View style={s.youtubeIndicator}><Play size={14} color="#fff" fill="#fff" /></View>
                            )}
                            {item.has_audio && !isYouTube && (
                                <View style={s.podcastIndicator}>
                                    {(isPlaying && playingArticleId === item.id) ? (
                                        <PlayingWaveform color="#fff" size={14} />
                                    ) : (
                                        <Headphones size={14} color="#fff" />
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </View>
                {!item.is_read && <View style={s.unreadIndicator} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <Text style={s.headerTitle}>Timeline</Text>
                    {timeLeft && <View style={s.timerPill}><Text style={s.timerText}>{timeLeft}</Text></View>}
                </View>
                <View style={s.headerActions}>
                    <TouchableOpacity
                        style={[s.filterPill, filter.unread_only && s.filterPillActive]}
                        onPress={() => setFilter({ unread_only: !filter.unread_only })}
                    >
                        <Filter size={14} color={filter.unread_only ? '#fff' : colors.text.secondary} />
                        <Text style={[s.filterText, filter.unread_only && s.filterTextActive]}>Unread</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleMarkAllRead} style={s.iconButton}>
                        <CircleCheck size={20} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {isLoading && articles.length === 0 ? (
                <TimelineSkeleton />
            ) : (
                <FlatList
                    data={articles}
                    renderItem={renderArticle}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={s.list}
                    onEndReached={() => hasMore && fetchArticles(false)}
                    onEndReachedThreshold={0.5}
                    refreshControl={<RefreshControl refreshing={isLoading && articles.length === 0} onRefresh={refreshAllFeeds} tintColor={colors.primary.DEFAULT} />}
                    ListFooterComponent={isLoading ? <ActivityIndicator style={s.loader} color={colors.primary.DEFAULT} /> : null}
                />
            )}
        </View>
    );
}

const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        flex: 1,
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
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    timerPill: {
        backgroundColor: colors.background.secondary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    timerText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
    },
    filterPillActive: {
        backgroundColor: colors.primary.DEFAULT,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: '#fff',
    },
    iconButton: {
        padding: spacing.sm,
    },
    list: {
        padding: spacing.lg,
    },
    articleCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
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
        backgroundColor: colors.background.elevated,
        padding: spacing.xl,
    },
    featuredBody: {
        flexDirection: 'column-reverse',
        gap: spacing.lg,
    },
    featuredTitle: {
        fontSize: 24,
        lineHeight: 30,
        fontWeight: '900',
    },
    featuredSummary: {
        fontSize: 14,
        color: colors.text.secondary,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    featuredThumbnailWrapper: {
        width: '100%',
        height: 200,
        borderRadius: borderRadius.xl,
    },
    podcastIndicator: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: colors.primary.DEFAULT,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    articleRead: {
        opacity: 0.6,
    },
    cardBody: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    cardInfo: {
        flex: 1,
    },
    feedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
        alignSelf: 'flex-start',
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    initialText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '900',
    },
    feedName: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.text.secondary,
        maxWidth: 150,
    },
    articleTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.primary,
        lineHeight: 22,
        marginBottom: spacing.md,
    },
    articleTitleRead: {
        color: colors.text.secondary,
    },
    articleFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    articleMeta: {
        fontSize: 11,
        color: colors.text.tertiary,
        fontWeight: '600',
    },
    thumbnailWrapper: {
        width: 90,
        height: 90,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        position: 'relative',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    youtubeIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    unreadIndicator: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 4,
        height: '100%',
        backgroundColor: colors.primary.DEFAULT,
    },
    loader: {
        marginVertical: spacing.xl,
    },
    cardAction: {
        padding: 4,
    }
});
