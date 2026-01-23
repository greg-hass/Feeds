import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useAnalyticsStore, formatReadingTime } from '@/stores/analyticsStore';

/**
 * Bar chart showing reading activity by day of week
 */
export function DayOfWeekChart() {
    const colors = useColors();
    const { dayOfWeekStats } = useAnalyticsStore();

    const totalArticles = dayOfWeekStats.reduce((sum, day) => sum + day.articles_read, 0);
    const bestDay = dayOfWeekStats.reduce(
        (best, day) => day.articles_read > best.articles_read ? day : best,
        dayOfWeekStats[0] || { day_name: 'None', articles_read: 0 }
    );

    const s = styles(colors);

    return (
        <View style={s.container}>
            <Text style={s.title}>Weekly Pattern</Text>
            <Text style={s.subtitle}>Reading by day of week</Text>

            <View style={s.chartPlaceholder}>
                <Text style={s.placeholderText}>📅 Bar Chart</Text>
                <Text style={s.placeholderSubtext}>Sun-Sat activity bars</Text>
            </View>

            <View style={s.stats}>
                <View style={s.stat}>
                    <Text style={s.statLabel}>Total</Text>
                    <Text style={s.statValue}>{totalArticles} articles</Text>
                </View>
                <View style={s.stat}>
                    <Text style={s.statLabel}>Best Day</Text>
                    <Text style={s.statValue}>{bestDay.day_name}</Text>
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
    chartPlaceholder: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    placeholderText: {
        ...typography.h3,
        color: colors.text.secondary,
    },
    placeholderSubtext: {
        ...typography.caption,
        color: colors.text.tertiary,
    },
    stats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
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
