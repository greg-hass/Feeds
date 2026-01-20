import { useEffect, useCallback, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, Linking, Image, useWindowDimensions, Platform, Animated } from 'react-native';
import { WebView } from 'react-native-webview'; // Import WebView
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useFeedStore, useAudioStore, useVideoStore } from '@/stores'; // Import useVideoStore
import { Article } from '@/services/api';
import { Circle, CircleCheck, Play, Bookmark, MoreVertical, Filter, RefreshCw, Clock, Headphones, Flame } from 'lucide-react-native';
import { useColors, borderRadius, spacing, shadows, animations } from '@/theme';
import { extractVideoId, getThumbnailUrl } from '@/utils/youtube';
import { TimelineSkeleton } from './Skeleton';
import { PlayingWaveform } from './PlayingWaveform';
import { LinearGradient } from 'expo-linear-gradient';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Check, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeyboardShortcuts, SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import ArticleCard from './ArticleCard';
import FilterPills from './FilterPills';

interface TimelineProps {
    onArticlePress?: (article: Article) => void;
    activeArticleId?: number | null;
}

export default function Timeline({ onArticlePress, activeArticleId }: TimelineProps) {
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const { articles, isLoading, hasMore, filter, scrollPosition, fetchArticles, setFilter, setScrollPosition, markAllRead, error, clearError, prefetchArticle } = useArticleStore();
    const { feeds, folders, refreshAllFeeds, isLoading: isFeedLoading } = useFeedStore();

    const { currentArticleId: playingArticleId, isPlaying } = useAudioStore();
    const { activeVideoId, playVideo, setPlaying: setVideoPlaying } = useVideoStore(); // Destructure video store
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    const [isScrollRestored, setIsScrollRestored] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const hasRestoredScroll = useRef(false);
    
    // Animation values for bookmark
    const bookmarkScales = useRef<Map<number, Animated.Value>>(new Map());
    const bookmarkRotations = useRef<Map<number, Animated.Value>>(new Map());
    
    const getBookmarkScale = (id: number) => {
        if (!bookmarkScales.current.has(id)) {
            bookmarkScales.current.set(id, new Animated.Value(1));
        }
        return bookmarkScales.current.get(id)!;
    };
    
    const getBookmarkRotation = (id: number) => {
        if (!bookmarkRotations.current.has(id)) {
            bookmarkRotations.current.set(id, new Animated.Value(0));
        }
        return bookmarkRotations.current.get(id)!;
    };
    
    // HOT badge pulse animation
    const hotPulseAnim = useRef(new Animated.Value(1)).current;
    
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(hotPulseAnim, {
                    toValue: 1.05,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(hotPulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    // Prefetch articles as user scrolls
    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            const lastIndex = viewableItems[viewableItems.length - 1].index;
            if (articles && articles.length > lastIndex + 1) {
                const nextArticles = articles.slice(lastIndex + 1, lastIndex + 4);
                nextArticles.forEach(a => prefetchArticle(a.id));
            }
        }
    }).current;

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
                if (diff <= 0) {
                    setTimeLeft('Refreshing');
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

    // Reset scroll restoration flag when filter changes
    useEffect(() => {
        hasRestoredScroll.current = false;
        setIsScrollRestored(false);
    }, [filter]);

    // Restore scroll position when articles are loaded
    useEffect(() => {
        if (!hasRestoredScroll.current && articles.length > 0 && scrollPosition > 0 && flatListRef.current) {
            // Immediately restore scroll without delay to prevent flash
            flatListRef.current?.scrollToOffset({ offset: scrollPosition, animated: false });
            hasRestoredScroll.current = true;
            // Small delay to ensure scroll has taken effect before showing
            setTimeout(() => setIsScrollRestored(true), 50);
        } else if (scrollPosition === 0 || articles.length === 0) {
            // No scroll to restore, show immediately
            setIsScrollRestored(true);
        }
    }, [articles.length, scrollPosition]);

    // Determine header title
    let headerTitle = 'Timeline';
    if (filter.folder_id) {
        const folder = folders.find(f => f.id === filter.folder_id);
        if (folder) headerTitle = folder.name;
    } else if (filter.feed_id) {
        const feed = feeds.find(f => f.id === filter.feed_id);
        if (feed) headerTitle = feed.title;
    } else if (filter.type) {
        // Map type to proper smart folder name
        const typeNames: Record<string, string> = {
            'youtube': 'YouTube',
            'podcast': 'Podcasts',
            'reddit': 'Reddit',
            'rss': 'RSS',
        };
        headerTitle = typeNames[filter.type] || filter.type;
    } else {
        headerTitle = 'All Articles';
    }

    const handleMarkAllRead = () => {
        Alert.alert('Mark All Read', 'Mark visible articles as read?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Mark Read',
                onPress: () => {
                    if (filter.feed_id) {
                        markAllRead('feed', filter.feed_id);
                    } else if (filter.folder_id) {
                        markAllRead('folder', filter.folder_id);
                    } else if (filter.type) {
                        markAllRead('type', undefined, filter.type);
                    } else {
                        markAllRead('all');
                    }
                }
            }
        ]);
    };

    const handleArticlePress = useCallback((item: Article) => {
        useArticleStore.getState().markRead(item.id);
        if (onArticlePress) onArticlePress(item);
        else router.push(`/(app)/article/${item.id}`);
    }, [onArticlePress, router]);

    const handlePlayPress = useCallback((item: Article) => {
        const { currentArticleId, isPlaying, play, pause, resume } = useAudioStore.getState();

        if (currentArticleId === item.id) {
            if (isPlaying) {
                pause();
            } else {
                resume();
            }
        } else {
            // Prefer enclosure_url for podcasts, fall back to url (though for podcasts enclosure is key)
            // We can check item.enclosure_url if it was part of Article interface, but let's assume item.url 
            // or similar. Wait, Article interface might not have enclosure_url explicity typed in all contexts
            // but it is passed from backend. Let's use item.url for now or assume enclosure_url is on item as any.
            // Actually, the audioStore play expects { id, url, title, author, coverArt }.
            // We should find the audio URL.
            // For now, I'll use item.url or check if I can access enclosure_url.
            // Looking at api.ts, Article has enclosure_url?: string.
            play({
                id: item.id,
                url: item.enclosure_url || item.url || '',
                title: item.title,
                author: item.feed_title || 'Unknown Source',
                coverArt: item.thumbnail_url || item.feed_icon_url || ''
            });
        }
    }, []);

    const handleVideoPress = useCallback((item: Article) => {
        const videoId = extractVideoId(item.url || '');
        if (videoId) {
            playVideo(videoId, item.title);
        } else {
            // Fallback if no video ID found, just open article
            handleArticlePress(item);
        }
    }, [playVideo, handleArticlePress]);

    const renderRightActions = (progress: any, dragX: any, item: Article) => {
        const trans = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });
        return (
            <Animated.View style={[s.swipeActionRight, { transform: [{ translateX: trans }] }]}>
                <TouchableOpacity onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    useArticleStore.getState().markRead(item.id);
                }} style={s.swipeActionButton}>
                    <Check size={24} color="#fff" />
                    <Text style={s.swipeActionText}>Read</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderLeftActions = (progress: any, dragX: any, item: Article) => {
        const trans = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });
        return (
            <Animated.View style={[s.swipeActionLeft, { transform: [{ translateX: trans }] }]}>
                <TouchableOpacity onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    useArticleStore.getState().toggleBookmark(item.id);
                }} style={s.swipeActionButton}>
                    <Bookmark size={24} color="#fff" fill="#fff" />
                    <Text style={s.swipeActionText}>Save</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderArticle = ({ item, index }: { item: Article; index: number }) => {
        const Content = (
            <ArticleCard
                item={item}
                index={index}
                isActive={activeArticleId === item.id}
                isMobile={isMobile}
                activeVideoId={activeVideoId}
                playingArticleId={playingArticleId}
                isPlaying={isPlaying}
                onArticlePress={handleArticlePress}
                onVideoPress={handleVideoPress}
                onPlayPress={handlePlayPress}
                onBookmarkToggle={(id) => useArticleStore.getState().toggleBookmark(id)}
                getBookmarkScale={getBookmarkScale}
                getBookmarkRotation={getBookmarkRotation}
                hotPulseAnim={hotPulseAnim}
            />
        );

        if (isMobile) {
            return (
                <Swipeable
                    renderRightActions={(p, d) => renderRightActions(p, d, item)}
                    renderLeftActions={(p, d) => renderLeftActions(p, d, item)}
                    containerStyle={s.swipeableContainer}
                >
                    {Content}
                </Swipeable>
            );
        }

        return Content;
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <Text style={s.headerTitle} numberOfLines={1}>{headerTitle}</Text>
                    {timeLeft && <View style={s.timerPill}><Text style={s.timerText}>{timeLeft}</Text></View>}
                </View>
                <View style={s.headerActions}>
                    <TouchableOpacity
                        onPress={() => refreshAllFeeds()}
                        style={s.iconButton}
                        disabled={isFeedLoading}
                        accessibilityLabel="Refresh feeds"
                        accessibilityRole="button"
                    >
                        {isFeedLoading ? (
                            <ActivityIndicator size={18} color={colors.primary.DEFAULT} />
                        ) : (
                            <RefreshCw size={20} color={colors.text.secondary} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleMarkAllRead}
                        style={s.iconButton}
                        accessibilityLabel="Mark all as read"
                        accessibilityRole="button"
                    >
                        <CircleCheck size={20} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>
            </View>


            <FilterPills
                unreadOnly={filter.unread_only || false}
                activeType={filter.type}
                onFilterChange={(filterId) => {
                    if (filterId === 'unread') {
                        setFilter({ unread_only: !filter.unread_only });
                    } else {
                        setFilter({ type: filterId === 'all' ? undefined : filterId });
                    }
                }}
            />

            {isLoading && articles.length === 0 ? (
                <TimelineSkeleton />
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={articles}
                    renderItem={renderArticle}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={s.list}
                    onEndReached={() => hasMore && fetchArticles(false)}
                    onEndReachedThreshold={0.5}
                    refreshControl={<RefreshControl refreshing={isLoading && articles.length === 0} onRefresh={refreshAllFeeds} tintColor={colors.primary.DEFAULT} />}
                    ListFooterComponent={isLoading ? <ActivityIndicator style={s.loader} color={colors.primary.DEFAULT} /> : null}
                    // Prefetching strategy
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                    scrollEventThrottle={400}
                    onScroll={(e) => {
                        const offset = e.nativeEvent.contentOffset.y;
                        setScrollPosition(offset);
                    }}
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
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    filterWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        paddingBottom: spacing.md,
    },
    filterScroll: {
        paddingHorizontal: spacing.lg,
        gap: 8,
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginLeft: isMobile ? 40 : 0, // Add space for menu hamburger
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
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    filterPillActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
        ...shadows.colored(colors.primary.DEFAULT),
    },
    unreadPillActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.background.primary,
    },
    filterDivider: {
        width: 1,
        height: 16,
        backgroundColor: colors.border.DEFAULT,
        marginHorizontal: 4,
    },
    unreadDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.text.tertiary,
    },
    unreadDotActive: {
        backgroundColor: '#fff',
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
        borderColor: colors.border.DEFAULT,
        position: 'relative',
        overflow: 'hidden',
        ...shadows.md,
        ...Platform.select({
            web: {
                cursor: 'pointer',
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
    featuredBody: {
        flexDirection: 'column-reverse',
        gap: spacing.lg,
    },
    featuredTitle: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '700',
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
        zIndex: 10,
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
    videoContainer: {
        width: '100%',
        height: 220,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        marginTop: spacing.md,
        backgroundColor: colors.background.tertiary, // Changed from #000
    },
    videoThumbnailWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    webview: {
        flex: 1,
        backgroundColor: colors.background.tertiary, // Changed from #000
    },
    playButtonOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    playButtonCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
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
        padding: 8,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    hotBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF4500', // Orange Red
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        gap: 4,
        marginRight: 8,
    },
    hotText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    swipeableContainer: {
        marginBottom: spacing.md,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        backgroundColor: colors.background.secondary,
    },
    swipeActionRight: {
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center',
        alignItems: 'flex-end',
        flex: 1,
        borderRadius: borderRadius.xl,
    },
    swipeActionLeft: {
        backgroundColor: '#F59E0B', // Amber 500
        justifyContent: 'center',
        alignItems: 'flex-start',
        flex: 1,
        borderRadius: borderRadius.xl,
    },
    swipeActionButton: {
        width: 80,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    swipeActionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    }
});
