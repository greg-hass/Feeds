import React, { useEffect, useRef } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator, useWindowDimensions, Platform, LayoutAnimation, UIManager, InteractionManager } from 'react-native';
import { Article } from '@/services/api';
import { useColors } from '@/theme';
import { useTimeline } from '@/hooks/useTimeline';
import { useTimelineScroll } from '@/hooks/useTimelineScroll';
import { TimelineSkeleton } from './Skeleton';
import FilterPills from './FilterPills';
import TimelineHeader from './TimelineHeader';
import TimelineArticle from './TimelineArticle';
import NewArticlesPill from './NewArticlesPill';
import { DigestCard } from './DigestCard';
import { timelineStyles } from './Timeline.styles';

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
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const s = timelineStyles(colors, isMobile);

    const {
        articles, isLoading, hasMore, filter, isFeedLoading, headerTitle, timeLeft, isRefreshing, refreshProgress,
        playingArticleId, isPlaying, activeVideoId, hotPulseAnim,
        fetchArticles, setFilter, refreshAllFeeds, handleMarkAllRead, prefetchArticle,
        handleArticlePress, handlePlayPress, handleVideoPress,
        getBookmarkScale, getBookmarkRotation,
    } = useTimeline(onArticlePress);

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

    const scheduleIdle = (callback: () => void) => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const requestIdle = (window as any).requestIdleCallback;
            if (typeof requestIdle === 'function') {
                requestIdle(callback, { timeout: 1500 });
                return;
            }
        }
        InteractionManager.runAfterInteractions(callback);
    };

    const canPrefetch = async () => {
        if (Platform.OS !== 'web' || typeof navigator === 'undefined') return true;
        const connection = (navigator as any).connection;
        if (connection?.saveData) return false;
        const effectiveType = connection?.effectiveType;
        if (effectiveType && ['slow-2g', '2g'].includes(effectiveType)) return false;

        if (typeof (navigator as any).getBattery === 'function') {
            try {
                const battery = await (navigator as any).getBattery();
                if (battery && !battery.charging) return false;
            } catch {
                // Ignore battery API errors and allow prefetch.
            }
        }

        return true;
    };

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
        <View style={s.container}>
            <NewArticlesPill />
            <TimelineHeader
                title={headerTitle}
                timeLeft={timeLeft}
                isFeedLoading={isFeedLoading}
                isRefreshing={isRefreshing}
                isMobile={isMobile}
                onRefresh={refreshAllFeeds}
                onMarkAllRead={handleMarkAllRead}
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
                        contentContainerStyle={s.list}
                        onEndReached={() => hasMore && fetchArticles(false)}
                        onEndReachedThreshold={0.5}
                        refreshControl={
                            <RefreshControl
                                refreshing={isLoading && articles.length === 0}
                                onRefresh={refreshAllFeeds}
                                tintColor={colors.primary.DEFAULT}
                            />
                        }
                        ListFooterComponent={isLoading ? <ActivityIndicator style={s.loader} color={colors.primary.DEFAULT} /> : null}
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
        </View>
    );
}
