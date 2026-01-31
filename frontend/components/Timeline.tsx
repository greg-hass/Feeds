import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator, Platform, LayoutAnimation, UIManager, InteractionManager, Animated, TouchableOpacity } from 'react-native';
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
import { timelineStyles } from './Timeline.styles';
import { ScrollView } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import Sidebar from '@/components/Sidebar';
import { RefreshCw, CircleCheck, X } from 'lucide-react-native';

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
    const isDesktop = useIsDesktop();
    const isMobile = !isDesktop;
    const styles = timelineStyles(colors, isMobile);
    const [showMenu, setShowMenu] = useState(false);
    const [sidebarAnim] = useState(new Animated.Value(-300));

    const {
        articles, isLoading, hasMore, filter, isFeedLoading, headerTitle, timeLeft, isRefreshing, refreshProgress,
        playingArticleId, isPlaying, activeVideoId, hotPulseAnim, feeds,
        fetchArticles, setFilter, refreshAllFeeds, handleMarkAllRead, prefetchArticle,
        handleArticlePress, handlePlayPress, handleVideoPress,
        getBookmarkScale, getBookmarkRotation,
    } = useTimeline(onArticlePress);

    const {
        flatListRef, isScrollRestored, onViewableItemsChanged, handleScroll, saveScrollPosition
    } = useTimelineScroll(articles, filter);

    // Connect saveScrollPosition to handleArticlePress
    const handleArticlePressWithSave = useCallback((item: Article) => {
        saveScrollPosition();
        handleArticlePress(item);
    }, [handleArticlePress, saveScrollPosition]);

    const toggleMenu = () => {
        setShowMenu(!showMenu);
        Animated.timing(sidebarAnim, {
            toValue: showMenu ? -300 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

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

    const renderArticle = ({ item, index }: { item: Article; index: number }) => (
        <TimelineArticle
            item={item}
            index={index}
            isActive={activeArticleId === item.id}
            isMobile={isMobile}
            activeVideoId={activeVideoId}
            playingArticleId={playingArticleId}
            isPlaying={isPlaying}
            colors={colors}
            hotPulseAnim={hotPulseAnim}
            onArticlePress={handleArticlePressWithSave}
            onVideoPress={handleVideoPress}
            onPlayPress={handlePlayPress}
            getBookmarkScale={getBookmarkScale}
            getBookmarkRotation={getBookmarkRotation}
        />
    );

    return (
        <View style={styles.container}>
            <NewArticlesPill />
            <ScreenHeader
                title={headerTitle}
                showBackButton={false}
                showMenuButton={isMobile}
                onMenuPress={toggleMenu}
                isRefreshing={isRefreshing}
                rightActions={[
                    {
                        icon: <RefreshCw size={20} color={colors.text.secondary} />,
                        onPress: refreshAllFeeds,
                        loading: isFeedLoading,
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
                    onClearFilter={() => setFilter({ unread_only: false, type: undefined })}
                />
            )}

            {/* Show empty state immediately if no feeds exist for this filter */}
            {feedsForCurrentFilter.length === 0 ? (
                <TimelineEmptyState
                    hasFeeds={false}
                    isFiltered={!!filter.type}
                    filterType={filter.type}
                    onClearFilter={() => setFilter({ unread_only: false, type: undefined })}
                />
            ) : isLoading && articles.length === 0 ? (
                <TimelineSkeleton />
            ) : filter.type !== 'podcast' ? (
                <View style={{ flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        data={articles}
                        renderItem={renderArticle}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.list}
                        onEndReached={() => hasMore && fetchArticles(false)}
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
                                onClearFilter={() => setFilter({ unread_only: false, type: undefined })}
                            />
                        }
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                        scrollEventThrottle={16}
                        onScroll={handleScroll}
                        // Performance props
                        removeClippedSubviews={Platform.OS === 'android'}
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                        windowSize={11}
                        updateCellsBatchingPeriod={50}
                    />
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
        </View>
    );
}
