import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useAnalyticsStore, formatReadingTime } from '@/stores/analyticsStore';

/**
 * Custom bar chart showing daily reading time over last 30 days
 * Uses pure React Native views for web compatibility (no external chart library)
 */
export function ReadingTimeChart() {
    const colors = useColors();
    const { dailyStats } = useAnalyticsStore();

    const s = styles(colors);

    // Calculate stats
    const totalTime = dailyStats.reduce((sum, day) => sum + day.total_read_time_seconds, 0);
    const avgTime = dailyStats.length > 0 ? totalTime / dailyStats.length : 0;
    const maxDay = dailyStats.reduce(
        (max, day) => day.total_read_time_seconds > max.total_read_time_seconds ? day : max,
        dailyStats[0] || { total_read_time_seconds: 0, date: '' }
    );

    // Find max value for scaling
    const maxValue = Math.max(...dailyStats.map(d => d.total_read_time_seconds), 1);

    // Get chart width
    const chartWidth = Math.min(Dimensions.get('window').width - 64, 500);
    const barWidth = dailyStats.length > 0 ? Math.max((chartWidth - 20) / dailyStats.length - 2, 4) : 10;

    return (
        <View style={s.container}>
            <Text style={s.title}>Reading Time Trend</Text>
            <Text style={s.subtitle}>Last 30 days (minutes per day)</Text>

            {dailyStats.length > 0 ? (
                <View style={s.chartContainer}>
                    {/* Y-axis labels */}
                    <View style={s.yAxis}>
                        <Text style={s.axisLabel}>{Math.round(maxValue / 60)}m</Text>
                        <Text style={s.axisLabel}>{Math.round(maxValue / 120)}m</Text>
                        <Text style={s.axisLabel}>0</Text>
                    </View>
                    
                    {/* Bars */}
                    <View style={s.barsContainer}>
                        <View style={s.bars}>
                            {dailyStats.map((day, index) => {
                                const height = (day.total_read_time_seconds / maxValue) * 180;
                                return (
                                    <View
                                        key={day.date}
                                        style={[
                                            s.bar,
                                            {
                                                height: Math.max(height, 2),
                                                width: barWidth,
                                                backgroundColor: colors.primary.DEFAULT,
                                                opacity: 0.6 + (day.total_read_time_seconds / maxValue) * 0.4,
                                            }
                                        ]}
                                    />
                                );
                            })}
                        </View>
                        
                        {/* X-axis labels */}
                        <View style={s.xAxis}>
                            {dailyStats.length > 0 && (
                                <>
                                    <Text style={s.axisLabel}>
                                        {formatDate(dailyStats[0].date)}
                                    </Text>
                                    <Text style={s.axisLabel}>
                                        {formatDate(dailyStats[Math.floor(dailyStats.length / 2)]?.date)}
                                    </Text>
                                    <Text style={s.axisLabel}>
                                        {formatDate(dailyStats[dailyStats.length - 1].date)}
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>
                </View>
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

/** Format date to short form like "1/23" */
function formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
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
    chartContainer: {
        flexDirection: 'row',
        height: 220,
        marginVertical: spacing.sm,
    },
    yAxis: {
        width: 30,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingRight: spacing.xs,
        paddingBottom: 20,
    },
    barsContainer: {
        flex: 1,
    },
    bars: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xs,
        gap: 2,
    },
    bar: {
        borderRadius: 2,
    },
    xAxis: {
        height: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xs,
    },
    axisLabel: {
        ...typography.caption,
        fontSize: 10,
        color: colors.text.tertiary,
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
