import React, { useEffect, useRef, useState } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator, Platform, LayoutAnimation, UIManager, InteractionManager, Animated, TouchableOpacity } from 'react-native';
import { Article } from '@/services/api';
import { useColors } from '@/theme';
import { useTimeline } from '@/hooks/useTimeline';
import { useTimelineScroll } from '@/hooks/useTimelineScroll';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { TimelineSkeleton } from './Skeleton';
import FilterPills from './FilterPills';
import TimelineArticle from './TimelineArticle';
import NewArticlesPill from './NewArticlesPill';
import { TimelineEmptyState } from './TimelineEmptyState';
import { DigestCard } from './DigestCard';
import { timelineStyles } from './Timeline.styles';
import { scheduleIdle, canPrefetch } from '@/utils/scheduler';
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

    const toggleMenu = () => {
        setShowMenu(!showMenu);
        Animated.timing(sidebarAnim, {
            toValue: showMenu ? -300 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

    const prevArticleCount = useRef(articles.length);
    const prefetchedRef = useRef<Set<number>>(new Set());

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
        prefetchedRef.current.clear();
    }, [filter.feed_id, filter.folder_id, filter.type, filter.unread_only]);

    const {
        flatListRef, isScrollRestored, onViewableItemsChanged, handleScroll
    } = useTimelineScroll(articles, filter);

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
            onArticlePress={handleArticlePress}
            onVideoPress={handleVideoPress}
            onPlayPress={handlePlayPress}
            getBookmarkScale={getBookmarkScale}
            getBookmarkRotation={getBookmarkRotation}
        />
    );

    useEffect(() => {
        if (isLoading || articles.length === 0) return;

        let cancelled = false;
        const prefetchCount = isMobile ? 8 : 16;
        const candidates = (filter.unread_only ? articles.filter((a) => !a.is_read) : articles)
            .slice(0, prefetchCount);

        scheduleIdle(() => {
            canPrefetch().then((allowed) => {
                if (!allowed || cancelled) return;
                candidates.forEach((article) => {
                    if (prefetchedRef.current.has(article.id)) return;
                    prefetchedRef.current.add(article.id);
                    prefetchArticle(article.id);
                });
            });
        });

        return () => {
            cancelled = true;
        };
    }, [articles, filter.unread_only, isLoading, isMobile, prefetchArticle]);

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

            {isLoading && articles.length === 0 ? (
                <TimelineSkeleton />
            ) : (
                <View style={{ flex: 1, opacity: isScrollRestored ? 1 : 0 }}>
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
                            !isLoading ? (
                                <TimelineEmptyState 
                                    hasFeeds={feeds.length > 0}
                                    isFiltered={filter.unread_only || !!filter.feed_id || !!filter.folder_id || !!filter.type}
                                    onClearFilter={() => setFilter({ unread_only: false })}
                                />
                            ) : null
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
            )}

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
