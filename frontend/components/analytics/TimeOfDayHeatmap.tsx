import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useAnalyticsStore } from '@/stores/analyticsStore';

/**
 * Heatmap showing reading activity by hour of day (0-23)
 * Visual representation using colored bars for each hour
 */
export function TimeOfDayHeatmap() {
    const colors = useColors();
    const { hourlyStats } = useAnalyticsStore();

    // Find peak hours and max value for normalization
    const maxTime = Math.max(...hourlyStats.map(h => h.total_time), 1);
    const sortedHours = [...hourlyStats].sort((a, b) => b.total_time - a.total_time);
    const topHours = sortedHours.slice(0, 3);

    // Get color intensity based on activity
    const getIntensityColor = (time: number) => {
        const intensity = time / maxTime;
        if (intensity === 0) return colors.background.secondary;
        if (intensity < 0.3) return colors.primary.DEFAULT + '40'; // 25% opacity
        if (intensity < 0.6) return colors.primary.DEFAULT + '99'; // 60% opacity
        return colors.primary.DEFAULT; // 100% opacity
    };

    const s = styles(colors);

    return (
        <View style={s.container}>
            <Text style={s.title}>Reading Activity</Text>
            <Text style={s.subtitle}>By hour of day</Text>

            {/* Heatmap Grid */}
            <ScrollView style={s.heatmapScroll} showsVerticalScrollIndicator={false}>
                <View style={s.heatmap}>
                    {Array.from({ length: 24 }, (_, hour) => {
                        const hourData = hourlyStats.find(h => h.hour === hour);
                        const time = hourData?.total_time || 0;
                        const intensity = time / maxTime;

                        return (
                            <View key={hour} style={s.hourRow}>
                                <Text style={s.hourLabel}>
                                    {hour.toString().padStart(2, '0')}:00
                                </Text>
                                <View style={s.barContainer}>
                                    <View
                                        style={[
                                            s.bar,
                                            {
                                                width: `${Math.max(intensity * 100, 2)}%`,
                                                backgroundColor: getIntensityColor(time),
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={s.countLabel}>
                                    {hourData?.session_count || 0}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Peak Hours */}
            {topHours.length > 0 && (
                <View style={s.peakHours}>
                    <Text style={s.peakTitle}>Peak Reading Hours:</Text>
                    {topHours.map((hour, idx) => (
                        <Text key={hour.hour} style={s.peakHour}>
                            {idx + 1}. {hour.hour.toString().padStart(2, '0')}:00-{(hour.hour + 1).toString().padStart(2, '0')}:00 ({hour.session_count})
                        </Text>
                    ))}
                </View>
            )}

            {hourlyStats.length === 0 && (
                <Text style={s.noData}>No activity data yet</Text>
            )}
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
    heatmapScroll: {
        maxHeight: 300,
    },
    heatmap: {
        gap: spacing.xs,
    },
    hourRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    hourLabel: {
        ...typography.small,
        color: colors.text.secondary,
        width: 50,
    },
    barContainer: {
        flex: 1,
        height: 20,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: borderRadius.sm,
    },
    countLabel: {
        ...typography.small,
        color: colors.text.tertiary,
        width: 30,
        textAlign: 'right',
    },
    peakHours: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border.light,
    },
    peakTitle: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
        fontWeight: '600',
    },
    peakHour: {
        ...typography.body,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    noData: {
        ...typography.body,
        color: colors.text.tertiary,
        textAlign: 'center',
        paddingVertical: spacing.lg,
    },
});
