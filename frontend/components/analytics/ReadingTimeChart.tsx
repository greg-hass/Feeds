import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useAnalyticsStore, formatReadingTime } from '@/stores/analyticsStore';

/**
 * Line chart showing daily reading time over last 30 days
 */
export function ReadingTimeChart() {
    const colors = useColors();
    const { dailyStats } = useAnalyticsStore();

    const s = styles(colors);

    // Prepare chart data
    const chartData = {
        labels: dailyStats.length > 0
            ? dailyStats
                .filter((_, idx) => idx % 5 === 0) // Show every 5th label to avoid crowding
                .map(day => {
                    const date = new Date(day.date);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                })
            : ['No data'],
        datasets: [{
            data: dailyStats.length > 0
                ? dailyStats.map(day => day.total_read_time_seconds / 60) // Convert to minutes
                : [0],
            color: (opacity = 1) => colors.primary.DEFAULT + Math.round(opacity * 255).toString(16),
            strokeWidth: 2,
        }],
    };

    // Calculate stats
    const totalTime = dailyStats.reduce((sum, day) => sum + day.total_read_time_seconds, 0);
    const avgTime = dailyStats.length > 0 ? totalTime / dailyStats.length : 0;
    const maxDay = dailyStats.reduce(
        (max, day) => day.total_read_time_seconds > max.total_read_time_seconds ? day : max,
        dailyStats[0] || { total_read_time_seconds: 0, date: '' }
    );

    const chartConfig = {
        backgroundColor: colors.background.elevated,
        backgroundGradientFrom: colors.background.elevated,
        backgroundGradientTo: colors.background.elevated,
        decimalPlaces: 0,
        color: (opacity = 1) => colors.primary.DEFAULT + Math.round(opacity * 255).toString(16),
        labelColor: (opacity = 1) => colors.text.secondary + Math.round(opacity * 255).toString(16),
        style: {
            borderRadius: borderRadius.md,
        },
        propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: colors.primary.DEFAULT,
        },
    };

    return (
        <View style={s.container}>
            <Text style={s.title}>Reading Time Trend</Text>
            <Text style={s.subtitle}>Last 30 days (minutes per day)</Text>

            {dailyStats.length > 0 ? (
                <LineChart
                    data={chartData}
                    width={Dimensions.get('window').width > 1024 ? 500 : Dimensions.get('window').width - 64}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={s.chart}
                />
            ) : (
                <View style={s.noData}>
                    <Text style={s.noDataText}>No reading data yet</Text>
                    <Text style={s.noDataSubtext}>Start reading to see your trends!</Text>
                </View>
            )}

            {/* Stats Summary */}
            <View style={s.stats}>
                <View style={s.stat}>
                    <Text style={s.statLabel}>Total</Text>
                    <Text style={s.statValue}>{formatReadingTime(totalTime)}</Text>
                </View>
                <View style={s.stat}>
                    <Text style={s.statLabel}>Average</Text>
                    <Text style={s.statValue}>{formatReadingTime(avgTime)}</Text>
                </View>
                <View style={s.stat}>
                    <Text style={s.statLabel}>Best Day</Text>
                    <Text style={s.statValue}>
                        {maxDay ? formatReadingTime(maxDay.total_read_time_seconds) : 'N/A'}
                    </Text>
                </View>
            </View>
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
    chart: {
        marginVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    noData: {
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        marginVertical: spacing.sm,
    },
    noDataText: {
        ...typography.h4,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    noDataSubtext: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    stats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: spacing.md,
    },
    stat: {
        alignItems: 'center',
    },
    statLabel: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    statValue: {
        ...typography.h4,
        color: colors.text.primary,
    },
});
