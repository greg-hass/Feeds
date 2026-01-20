import React from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { Article } from '@/services/api';
import { useColors } from '@/theme';
import { useTimeline } from '@/hooks/useTimeline';
import { useTimelineScroll } from '@/hooks/useTimelineScroll';
import { TimelineSkeleton } from './Skeleton';
import FilterPills from './FilterPills';
import TimelineHeader from './TimelineHeader';
import TimelineArticle from './TimelineArticle';
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
        articles, isLoading, hasMore, filter, isFeedLoading, headerTitle, timeLeft,
        playingArticleId, isPlaying, activeVideoId, hotPulseAnim,
        fetchArticles, setFilter, refreshAllFeeds, handleMarkAllRead,
        handleArticlePress, handlePlayPress, handleVideoPress,
        getBookmarkScale, getBookmarkRotation,
    } = useTimeline(onArticlePress);

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

    return (
        <View style={s.container}>
            <TimelineHeader
                title={headerTitle}
                timeLeft={timeLeft}
                isFeedLoading={isFeedLoading}
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
