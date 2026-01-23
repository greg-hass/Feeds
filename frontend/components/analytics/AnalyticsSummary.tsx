import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BookOpen, Clock, Flame, TrendingUp } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useAnalyticsStore, formatReadingTime } from '@/stores/analyticsStore';

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subtitle?: string;
    color: string;
}

function StatCard({ icon, label, value, subtitle, color }: StatCardProps) {
    const colors = useColors();
    const s = styles(colors);

    return (
        <View style={s.card}>
            <View style={[s.iconContainer, { backgroundColor: color + '20' }]}>
                {icon}
            </View>
            <View style={s.cardContent}>
                <Text style={s.label}>{label}</Text>
                <Text style={s.value}>{value}</Text>
                {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
            </View>
        </View>
    );
}

export function AnalyticsSummary() {
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const { overview } = useAnalyticsStore();

    if (!overview) {
        return null;
    }

    const s = styles(colors);

    return (
        <View style={[s.container, isMobile && s.containerMobile]}>
            <StatCard
                icon={<BookOpen size={24} color={colors.primary.DEFAULT} />}
                label="Articles Read"
                value={overview.total_articles_read}
                subtitle={`${overview.articles_this_week} this week`}
                color={colors.primary.DEFAULT}
            />

            <StatCard
                icon={<Clock size={24} color={colors.accent.purple} />}
                label="Reading Time"
                value={formatReadingTime(overview.total_reading_time_seconds)}
                subtitle={`Avg: ${formatReadingTime(overview.average_session_duration)}/session`}
                color={colors.accent.purple}
            />

            <StatCard
                icon={<Flame size={24} color={colors.accent.orange} />}
                label="Reading Streak"
                value={`${overview.reading_streak_days} days`}
                subtitle={overview.reading_streak_days > 0 ? 'Keep it up!' : 'Start reading!'}
                color={colors.accent.orange}
            />

            <StatCard
                icon={<TrendingUp size={24} color={colors.success.DEFAULT} />}
                label="Top Feeds"
                value={overview.top_feeds.length}
                subtitle={overview.top_feeds[0]?.feed_title || 'No data'}
                color={colors.success.DEFAULT}
            />
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: spacing.md,
        flexWrap: 'wrap',
    },
    containerMobile: {
        flexDirection: 'column',
    },
    card: {
        flex: 1,
        minWidth: 200,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        gap: spacing.md,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContent: {
        flex: 1,
    },
    label: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    value: {
        ...typography.h2,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.small,
        color: colors.text.tertiary,
    },
});
