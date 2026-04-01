import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator, Platform, LayoutAnimation, UIManager, Animated, TouchableOpacity } from 'react-native';
import { Article } from '@/services/api';
import { useColors, spacing } from '@/theme';
import { useTimeline } from '@/hooks/useTimeline';
import { useTimelineScroll } from '@/hooks/useTimelineScroll';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useArticlePrefetch } from '@/hooks/useArticlePrefetch';
import { TimelineSkeleton } from './Skeleton';
import FilterPills from './FilterPills';
import TimelineArticle from './TimelineArticle';
import NewArticlesPill from './NewArticlesPill';
import { TimelineEmptyState } from './TimelineEmptyState';
import { DigestCard } from './DigestCard';
import { PodcastSection } from './PodcastSection';
import { FeedInfoSheet } from './FeedInfoSheet';
import { timelineStyles } from './Timeline.styles';
import { ScrollView } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import Sidebar from './Sidebar';
import { RefreshCw, CircleCheck, X } from 'lucide-react-native';
import { getRefreshIndicatorState } from '@/utils/refreshStatus';

interface TimelineProps {
    onArticlePress?: (article: Article) => void;
    activeArticleId?: number | null;
}

/**
 * Timeline - Orchestrator component for the article feed
 * Encapsulates logic in custom hooks and UI in sub-components
 */
export default function Timeline({ onArticlePress, activeArticleId }: TimelineProps) {
    const colors = useColors();
    const useNativeDriver = Platform.OS !== 'web';
    const isDesktop = useIsDesktop();
    const isMobile = !isDesktop;
    const styles = timelineStyles(colors, isMobile);
    const [showMenu, setShowMenu] = useState(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- useState initializer pattern for Animated.Value
    const [sidebarAnim] = useState(new Animated.Value(-300));
    const [feedInfoId, setFeedInfoId] = useState<number | null>(null);
    const [feedInfoVisible, setFeedInfoVisible] = useState(false);

    const [newArticlesCount, setNewArticlesCount] = useState<number>(0);
    const previousRefreshPhaseRef = useRef<string>('idle');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Animated.Value stable for component lifetime
    const [refreshSpin] = useState(new Animated.Value(0));

    const {
        articles, isLoading, hasMore, filter, headerTitle, lastRefreshed, isRefreshing, refreshState,
        playingArticleId, isPlaying, activeVideoId, feeds,
        fetchArticles, setFilter, refreshAllFeeds, handleMarkAllRead, prefetchArticle,
        handleArticlePress, handlePlayPress, handleVideoPress,
        getBookmarkScale, getBookmarkRotation,
    } = useTimeline(onArticlePress);

    const {
        attachFlatListRef, onViewableItemsChanged, handleScroll, handleScrollEnd, handleScrollToIndexFailed, saveScrollPosition,
        scrollToTop, isAtTop, shouldMaintainVisibleContentPosition, prepareForNewArticles, isRestoringPosition
    } = useTimelineScroll(articles, filter);

    useEffect(() => {
        const previousPhase = previousRefreshPhaseRef.current;
        const currentPhase = refreshState.phase;
        const completedRefresh =
            (previousPhase === 'refreshing' || previousPhase === 'syncing') &&
            currentPhase === 'success';

        if (completedRefresh) {
            const addedCount = refreshState.newContent.count || 0;
            const timeoutId = setTimeout(() => {
                if (addedCount > 0) {
                    if (isAtTop()) {
                        scrollToTop(false);
                        setNewArticlesCount(0);
                    } else {
                        prepareForNewArticles(addedCount);
                        setNewArticlesCount(addedCount);
                    }
                } else {
                    setNewArticlesCount(0);
                }
            }, 0);

            previousRefreshPhaseRef.current = currentPhase;
            return () => clearTimeout(timeoutId);
        }

        previousRefreshPhaseRef.current = currentPhase;
    }, [refreshState.phase, refreshState.newContent.count, isAtTop, prepareForNewArticles, scrollToTop]);

    // Connect saveScrollPosition to handleArticlePress
    const handleArticlePressWithSave = useCallback((item: Article) => {
        const articleIndex = articles.findIndex((article) => article.id === item.id);
        const fallbackArticleId =
            articleIndex >= 0
                ? (articles[articleIndex + 1]?.id ?? articles[articleIndex - 1]?.id ?? null)
                : null;
        saveScrollPosition(item.id, fallbackArticleId);
        handleArticlePress(item);
    }, [articles, handleArticlePress, saveScrollPosition]);

    const handleFeedInfoPress = useCallback((feedId: number) => {
        setFeedInfoId(feedId);
        setFeedInfoVisible(true);
    }, []);

    const toggleMenu = () => {
        setShowMenu(!showMenu);
        Animated.timing(sidebarAnim, {
            toValue: showMenu ? -300 : 0,
            duration: 250,
            useNativeDriver,
        }).start();
    };

    // Handle pressing the new articles pill - scroll to top and clear count
    const handleNewArticlesPress = useCallback(() => {
        scrollToTop(true);
        setNewArticlesCount(0);
    }, [scrollToTop]);

    const prevArticleCount = useRef(articles.length);

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    useEffect(() => {
        if (articles.length > prevArticleCount.current) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        prevArticleCount.current = articles.length;
    }, [articles.length]);

    useEffect(() => {
        if (!isRefreshing) {
            refreshSpin.stopAnimation();
            refreshSpin.setValue(0);
            return;
        }

        const loop = Animated.loop(
            Animated.timing(refreshSpin, {
                toValue: 1,
                duration: 900,
                useNativeDriver,
            })
        );
        loop.start();

        return () => {
            loop.stop();
            refreshSpin.stopAnimation();
            refreshSpin.setValue(0);
        };
    }, [isRefreshing, refreshSpin, useNativeDriver]);

    // Use the prefetch hook for article content
    useArticlePrefetch({
        articles,
        isLoading,
        isMobile,
        unreadOnly: filter.unread_only || false,
        prefetchArticle,
    });

    // Check if there are any feeds matching the current filter
    const feedsForCurrentFilter = filter.type
        ? feeds.filter(f => f.type === filter.type)
        : feeds;
    const clearFilters = () => setFilter({ unread_only: false, type: undefined });

    const renderArticle = ({ item }: { item: Article; index: number }) => (
        <TimelineArticle
            item={item}
            isActive={activeArticleId === item.id}
            isMobile={isMobile}
            activeVideoId={activeVideoId}
            playingArticleId={playingArticleId}
            isPlaying={isPlaying}
            colors={colors}
            onArticlePress={handleArticlePressWithSave}
            onVideoPress={handleVideoPress}
            onPlayPress={handlePlayPress}
            onArticlePressStart={saveScrollPosition}
            getBookmarkScale={getBookmarkScale}
            getBookmarkRotation={getBookmarkRotation}
            onFeedInfoPress={handleFeedInfoPress}
        />
    );

    const refreshRotation = refreshSpin.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const refreshIndicatorState = getRefreshIndicatorState(refreshState);
    const refreshIndicator = refreshIndicatorState
        ? {
            color:
                refreshIndicatorState.variant === 'error'
                    ? colors.error
                    : refreshIndicatorState.variant === 'stale'
                        ? colors.warning
                        : colors.primary.DEFAULT,
            accessibilityLabel: refreshIndicatorState.accessibilityLabel,
        }
        : null;

    const viewabilityConfig = useMemo(
        () => ({ itemVisiblePercentThreshold: 50 }),
        []
    );

    const handleEndReached = useCallback(() => {
        if (hasMore) {
            fetchArticles(false);
        }
    }, [fetchArticles, hasMore]);

    const maintainVisibleContentPosition = useMemo(
        () =>
            shouldMaintainVisibleContentPosition()
                ? {
                    minIndexForVisible: 0,
                    autoscrollToTopThreshold: undefined,
                }
                : undefined,
        [shouldMaintainVisibleContentPosition]
    );

    return (
        <View testID="timeline-screen" style={styles.container}>
            <ScreenHeader
                title={headerTitle}
                showBackButton={false}
                showMenuButton={isMobile}
                onMenuPress={toggleMenu}
                lastRefreshed={lastRefreshed}
                refreshIndicator={refreshIndicator}
                rightActions={[
                    {
                        icon: (
                            <Animated.View style={{ transform: [{ rotate: refreshRotation }] }}>
                                <RefreshCw
                                    size={20}
                                    color={isRefreshing ? colors.primary.DEFAULT : colors.text.secondary}
                                />
                            </Animated.View>
                        ),
                        onPress: refreshAllFeeds,
                        accessibilityLabel: 'Refresh feeds',
                    },
                    {
                        icon: <CircleCheck size={20} color={colors.text.secondary} />,
                        onPress: handleMarkAllRead,
                        accessibilityLabel: 'Mark all as read',
                    },
                ]}
            />


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

            <DigestCard />

            {/* Premium Podcast Section - shown when filtering by podcasts */}
            {filter.type === 'podcast' && !isLoading && feedsForCurrentFilter.length > 0 && articles.length > 0 && (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    <PodcastSection articles={articles} maxPerFeed={5} />
                </ScrollView>
            )}

            {/* Empty state for podcasts when no articles */}
            {filter.type === 'podcast' && feedsForCurrentFilter.length > 0 && articles.length === 0 && (
                <TimelineEmptyState
                    hasFeeds={true}
                    isFiltered={true}
                    filterType={filter.type}
                    onClearFilter={clearFilters}
                />
            )}

            {/* Show empty state immediately if no feeds exist for this filter */}
            {feedsForCurrentFilter.length === 0 ? (
                <TimelineEmptyState
                    hasFeeds={false}
                    isFiltered={!!filter.type}
                    filterType={filter.type}
                    onClearFilter={clearFilters}
                />
            ) : isLoading && articles.length === 0 ? (
                <TimelineSkeleton />
            ) : filter.type !== 'podcast' ? (
                <View style={{ flex: 1 }}>
                    <FlatList
                        testID="article-list"
                        ref={attachFlatListRef}
                        data={articles}
                        renderItem={renderArticle}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.list}
                        onEndReached={handleEndReached}
                        onEndReachedThreshold={0.5}
                        refreshControl={
                            <RefreshControl
                                refreshing={isLoading && articles.length === 0}
                                onRefresh={refreshAllFeeds}
                                tintColor={colors.primary?.DEFAULT ?? colors.primary}
                            />
                        }
                        ListFooterComponent={isLoading ? <ActivityIndicator style={styles.loader} color={colors.primary?.DEFAULT ?? colors.primary} /> : null}
                        ListEmptyComponent={
                            <TimelineEmptyState
                                hasFeeds={true}
                                isFiltered={filter.unread_only || !!filter.feed_id || !!filter.folder_id || !!filter.type}
                                filterType={filter.type}
                                onClearFilter={clearFilters}
                            />
                        }
                        onViewableItemsChanged={onViewableItemsChanged}
                        onScrollToIndexFailed={handleScrollToIndexFailed}
                        viewabilityConfig={viewabilityConfig}
                        scrollEventThrottle={16}
                        onScroll={handleScroll}
                        onScrollEndDrag={handleScrollEnd}
                        onMomentumScrollEnd={handleScrollEnd}
                        // Performance props
                        removeClippedSubviews={Platform.OS === 'android'}
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                        windowSize={11}
                        updateCellsBatchingPeriod={50}
                        // Maintain visible content position when prepending items (Twitter/X style)
                        maintainVisibleContentPosition={maintainVisibleContentPosition}
                        style={isRestoringPosition ? { opacity: 0 } : undefined}
                        pointerEvents={isRestoringPosition ? 'none' : 'auto'}
                    />
                    {isRestoringPosition ? (
                        <View
                            pointerEvents="none"
                            style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: colors.background.primary,
                            }}
                        />
                    ) : null}
                </View>
            ) : null}

            {/* Mobile Sidebar */}
            {isMobile && (
                <>
                    {/* Backdrop */}
                    {showMenu && (
                        <TouchableOpacity
                            style={styles.sidebarBackdrop}
                            activeOpacity={1}
                            onPress={toggleMenu}
                        />
                    )}
                    {/* Sidebar */}
                    <Animated.View
                        style={[
                            styles.sidebarContainer,
                            {
                                transform: [{ translateX: sidebarAnim }],
                                width: 280,
                            },
                        ]}
                    >
                        <View style={{ alignItems: 'flex-end', padding: spacing.md }}>
                            <TouchableOpacity onPress={toggleMenu} style={{ padding: spacing.sm }} accessibilityLabel="Close menu">
                                <X size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <Sidebar onNavigate={toggleMenu} />
                    </Animated.View>
                </>
            )}

            {/* New Articles Pill - shows when new articles are loaded above current view */}
            <NewArticlesPill
                isDesktop={isDesktop}
                visible={newArticlesCount > 0}
                count={newArticlesCount}
                onPress={handleNewArticlesPress}
                onAutoDismiss={() => setNewArticlesCount(0)}
            />

            <FeedInfoSheet
                feedId={feedInfoId}
                visible={feedInfoVisible}
                onClose={() => {
                    setFeedInfoVisible(false);
                    setFeedInfoId(null);
                }}
            />
        </View>
    );
}
