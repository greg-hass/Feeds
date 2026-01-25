import { useCallback } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useColors, spacing } from '@/theme';
import { useAnalyticsStore } from '@/stores/analyticsStore';

import { AnalyticsSummary } from '@/components/analytics/AnalyticsSummary';
import { ReadingTimeChart } from '@/components/analytics/ReadingTimeChart';
import { FeedEngagementList } from '@/components/analytics/FeedEngagementList';
import { TopArticlesList } from '@/components/analytics/TopArticlesList';
import { TimeOfDayHeatmap } from '@/components/analytics/TimeOfDayHeatmap';
import { DayOfWeekChart } from '@/components/analytics/DayOfWeekChart';
import { TopicDistributionChart } from '@/components/analytics/TopicDistributionChart';
import { AnalyticsHeader } from '@/components/analytics/AnalyticsHeader';

export default function AnalyticsScreen() {
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;

    const { fetchAll, isLoading, overview } = useAnalyticsStore();

    // Refetch analytics data whenever the screen is focused
    useFocusEffect(
        useCallback(() => {
            fetchAll();
        }, [fetchAll])
    );

    const s = styles(colors, isMobile);

    return (
        <View style={s.container}>
            <AnalyticsHeader />

            <ScrollView
                style={s.scrollView}
                contentContainerStyle={s.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Summary Cards */}
                <AnalyticsSummary />

                {/* Charts Grid */}
                <View style={s.chartsGrid}>
                    {/* Reading Time Trend */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <ReadingTimeChart />
                    </View>

                    {/* Time of Day Heatmap */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <TimeOfDayHeatmap />
                    </View>

                    {/* Day of Week */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <DayOfWeekChart />
                    </View>

                    {/* Topic Distribution */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <TopicDistributionChart />
                    </View>
                </View>

                {/* Lists Grid */}
                <View style={s.listsGrid}>
                    {/* Top Feeds */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <FeedEngagementList />
                    </View>

                    {/* Top Articles */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <TopArticlesList />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: isMobile ? spacing.md : spacing.lg,
        paddingBottom: spacing.xl * 2,
    },
    chartsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: spacing.lg,
        gap: spacing.md,
    },
    listsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: spacing.lg,
        gap: spacing.md,
    },
    fullWidth: {
        width: '100%',
    },
    halfWidth: {
        width: `calc(50% - ${spacing.md / 2}px)`,
        minWidth: 400,
    },
});
