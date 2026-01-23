import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useAnalyticsStore } from '@/stores/analyticsStore';

/**
 * Pie chart showing distribution of reading topics
 */
export function TopicDistributionChart() {
    const colors = useColors();
    const { topicDistribution } = useAnalyticsStore();

    const totalCount = topicDistribution.reduce((sum, topic) => sum + topic.count, 0);
    const topTopic = topicDistribution[0];

    const s = styles(colors);

    return (
        <View style={s.container}>
            <Text style={s.title}>Topic Distribution</Text>
            <Text style={s.subtitle}>What you're reading about</Text>

            <View style={s.chartPlaceholder}>
                <Text style={s.placeholderText}>🥧 Pie Chart</Text>
                <Text style={s.placeholderSubtext}>Topic percentages</Text>
            </View>

            {topicDistribution.length > 0 ? (
                <View style={s.topTopics}>
                    {topicDistribution.slice(0, 5).map((topic, idx) => (
                        <View key={topic.tag} style={s.topicRow}>
                            <Text style={s.topicTag}>#{topic.tag}</Text>
                            <Text style={s.topicCount}>{topic.count} articles</Text>
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={s.noData}>No topics tagged yet</Text>
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
    topTopics: {
        gap: spacing.xs,
    },
    topicRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
    },
    topicTag: {
        ...typography.body,
        color: colors.primary.DEFAULT,
    },
    topicCount: {
        ...typography.caption,
        color: colors.text.secondary,
    },
    noData: {
        ...typography.body,
        color: colors.text.tertiary,
        textAlign: 'center',
        paddingVertical: spacing.md,
    },
});
