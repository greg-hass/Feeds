import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useAnalyticsStore, formatReadingTime, formatEngagementScore, getEngagementColor } from '@/stores/analyticsStore';

/**
 * List of top feeds ranked by engagement score
 */
export function FeedEngagementList() {
    const colors = useColors();
    const { topFeeds } = useAnalyticsStore();

    const s = styles(colors);

    return (
        <View style={s.container}>
            <Text style={s.title}>Top Engaging Feeds</Text>
            <Text style={s.subtitle}>Ranked by engagement score</Text>

            <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
                {topFeeds.map((feed, idx) => (
                    <View key={feed.feed_id} style={s.feedRow}>
                        <View style={s.feedRank}>
                            <Text style={s.rankText}>{idx + 1}</Text>
                        </View>
                        <View style={s.feedInfo}>
                            <Text style={s.feedTitle} numberOfLines={1}>{feed.title}</Text>
                            <Text style={s.feedStats}>
                                {feed.total_articles_read} articles • {formatReadingTime(feed.total_read_time_seconds)}
                            </Text>
                        </View>
                        <View style={[s.scoreContainer, { backgroundColor: getEngagementColor(feed.engagement_score) + '20' }]}>
                            <Text style={[s.scoreText, { color: getEngagementColor(feed.engagement_score) }]}>
                                {formatEngagementScore(feed.engagement_score)}
                            </Text>
                        </View>
                    </View>
                ))}
                {topFeeds.length === 0 && (
                    <Text style={s.noData}>No engagement data yet. Start reading!</Text>
                )}
            </ScrollView>
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        maxHeight: 500,
    },
    title: {
        ...typography.h3,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: spacing.md,
    },
    list: {
        flex: 1,
    },
    feedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
        gap: spacing.sm,
    },
    feedRank: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        ...typography.caption,
        color: colors.text.secondary,
        fontWeight: '600',
    },
    feedInfo: {
        flex: 1,
    },
    feedTitle: {
        ...typography.body,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    feedStats: {
        ...typography.small,
        color: colors.text.secondary,
    },
    scoreContainer: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    scoreText: {
        ...typography.caption,
        fontWeight: '600',
    },
    noData: {
        ...typography.body,
        color: colors.text.tertiary,
        textAlign: 'center',
        paddingVertical: spacing.lg,
    },
});
