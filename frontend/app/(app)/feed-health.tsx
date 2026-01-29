import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFeedStore } from '@/stores';
import { useColors, spacing, borderRadius, shadows } from '@/theme';
import { getFeedHealth, getFeedHealthInfo, FeedHealthStatus } from '@/utils/feedHealth';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    PauseCircle,
    XCircle,
    RefreshCw,
    ArrowLeft,
} from 'lucide-react-native';

interface HealthStats {
    healthy: number;
    stale: number;
    dead: number;
    paused: number;
    error: number;
    total: number;
}

export default function FeedHealthPage() {
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const router = useRouter();
    const { feeds, refreshFeed } = useFeedStore();

    const { stats, feedsByHealth } = useMemo(() => {
        const stats: HealthStats = {
            healthy: 0,
            stale: 0,
            dead: 0,
            paused: 0,
            error: 0,
            total: feeds.length,
        };

        const feedsByHealth: Record<FeedHealthStatus, typeof feeds> = {
            healthy: [],
            stale: [],
            dead: [],
            paused: [],
            error: [],
        };

        feeds.forEach((feed) => {
            const status = getFeedHealth(feed);
            stats[status]++;
            feedsByHealth[status].push(feed);
        });

        return { stats, feedsByHealth };
    }, [feeds]);

    const s = styles(colors, isMobile);

    const getStatusIcon = (status: FeedHealthStatus) => {
        switch (status) {
            case 'healthy':
                return <CheckCircle2 size={20} color="#10b981" />;
            case 'stale':
                return <Clock size={20} color="#f59e0b" />;
            case 'dead':
                return <XCircle size={20} color="#6b7280" />;
            case 'paused':
                return <PauseCircle size={20} color="#f59e0b" />;
            case 'error':
                return <AlertTriangle size={20} color={colors.error} />;
        }
    };

    const getStatusLabel = (status: FeedHealthStatus) => {
        switch (status) {
            case 'healthy':
                return 'Healthy';
            case 'stale':
                return 'Stale';
            case 'dead':
                return 'Dead';
            case 'paused':
                return 'Paused';
            case 'error':
                return 'Connection Issue';
        }
    };

    const getStatusDescription = (status: FeedHealthStatus) => {
        switch (status) {
            case 'healthy':
                return 'Updating regularly';
            case 'stale':
                return "Hasn't updated recently";
            case 'dead':
                return 'Inactive or unavailable';
            case 'paused':
                return 'Updates paused';
            case 'error':
                return 'Failed to fetch';
        }
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity
                    style={s.backButton}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={s.title}>Feed Health</Text>
                <View style={s.placeholder} />
            </View>

            <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent}>
                {/* Overview Cards */}
                <View style={s.overviewGrid}>
                    <View style={[s.overviewCard, s.healthyCard]}>
                        <CheckCircle2 size={24} color="#10b981" />
                        <Text style={[s.overviewNumber, { color: '#10b981' }]}>
                            {stats.healthy}
                        </Text>
                        <Text style={s.overviewLabel}>Healthy</Text>
                    </View>

                    <View style={[s.overviewCard, s.warningCard]}>
                        <AlertTriangle size={24} color="#f59e0b" />
                        <Text style={[s.overviewNumber, { color: '#f59e0b' }]}>
                            {stats.error + stats.stale}
                        </Text>
                        <Text style={s.overviewLabel}>Issues</Text>
                    </View>

                    <View style={[s.overviewCard, s.deadCard]}>
                        <XCircle size={24} color="#6b7280" />
                        <Text style={[s.overviewNumber, { color: '#6b7280' }]}>
                            {stats.dead}
                        </Text>
                        <Text style={s.overviewLabel}>Dead</Text>
                    </View>

                    <View style={[s.overviewCard, s.pausedCard]}>
                        <PauseCircle size={24} color="#f59e0b" />
                        <Text style={[s.overviewNumber, { color: '#f59e0b' }]}>
                            {stats.paused}
                        </Text>
                        <Text style={s.overviewLabel}>Paused</Text>
                    </View>
                </View>

                {/* Total Stats */}
                <View style={s.totalCard}>
                    <Activity size={24} color={colors.text.primary} />
                    <View style={s.totalInfo}>
                        <Text style={s.totalNumber}>{stats.total}</Text>
                        <Text style={s.totalLabel}>Total Feeds</Text>
                    </View>
                    <View style={s.healthBar}>
                        <View
                            style={[
                                s.healthBarFill,
                                {
                                    width: `${stats.total > 0 ? (stats.healthy / stats.total) * 100 : 0}%`,
                                    backgroundColor: '#10b981',
                                },
                            ]}
                        />
                    </View>
                    <Text style={s.healthPercent}>
                        {stats.total > 0 ? Math.round((stats.healthy / stats.total) * 100) : 0}% healthy
                    </Text>
                </View>

                {/* Feeds by Status */}
                {(['error', 'stale', 'dead', 'paused', 'healthy'] as FeedHealthStatus[]).map(
                    (status) => {
                        const statusFeeds = feedsByHealth[status];
                        if (statusFeeds.length === 0) return null;

                        return (
                            <View key={status} style={s.section}>
                                <View style={s.sectionHeader}>
                                    {getStatusIcon(status)}
                                    <Text style={s.sectionTitle}>{getStatusLabel(status)}</Text>
                                    <Text style={s.sectionCount}>({statusFeeds.length})</Text>
                                </View>
                                <Text style={s.sectionDescription}>
                                    {getStatusDescription(status)}
                                </Text>

                                {statusFeeds.map((feed) => {
                                    const healthInfo = getFeedHealthInfo(feed);
                                    return (
                                        <TouchableOpacity
                                            key={feed.id}
                                            style={s.feedItem}
                                            onPress={() =>
                                                router.push(`/(app)/manage`)
                                            }
                                            activeOpacity={0.7}
                                        >
                                            <View style={s.feedInfo}>
                                                <Text style={s.feedTitle} numberOfLines={1}>
                                                    {feed.title}
                                                </Text>
                                                <Text style={s.feedMeta}>
                                                    Last fetched: {healthInfo.lastFetched}
                                                    {feed.error_count > 0 &&
                                                        ` • ${feed.error_count} error${feed.error_count > 1 ? 's' : ''}`}
                                                </Text>
                                                {feed.last_error && (
                                                    <Text style={s.errorText} numberOfLines={2}>
                                                        {feed.last_error}
                                                    </Text>
                                                )}
                                            </View>
                                            {(status === 'error' || status === 'stale' || status === 'dead') && (
                                                <TouchableOpacity
                                                    style={s.refreshButton}
                                                    onPress={() => refreshFeed(feed.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <RefreshCw size={18} color={colors.primary.DEFAULT} />
                                                </TouchableOpacity>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        );
                    }
                )}
            </ScrollView>
        </View>
    );
}

const styles = (colors: any, isMobile: boolean) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background.primary,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.DEFAULT,
        },
        backButton: {
            padding: spacing.sm,
            borderRadius: borderRadius.md,
        },
        title: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text.primary,
        },
        placeholder: {
            width: 44,
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            padding: spacing.lg,
            paddingBottom: spacing.xl * 2,
        },
        overviewGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.md,
            marginBottom: spacing.lg,
        },
        overviewCard: {
            flex: 1,
            minWidth: isMobile ? '45%' : 120,
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            ...shadows.sm,
        },
        healthyCard: {
            borderColor: '#10b981',
            backgroundColor: '#10b981' + '10',
        },
        warningCard: {
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b' + '10',
        },
        deadCard: {
            borderColor: '#6b7280',
            backgroundColor: '#6b7280' + '10',
        },
        pausedCard: {
            borderColor: '#f59e0b',
            backgroundColor: '#f59e0b' + '10',
        },
        overviewNumber: {
            fontSize: 32,
            fontWeight: '800',
            marginTop: spacing.sm,
        },
        overviewLabel: {
            fontSize: 14,
            color: colors.text.secondary,
            marginTop: spacing.xs,
        },
        totalCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            ...shadows.sm,
        },
        totalInfo: {
            marginLeft: spacing.md,
            marginRight: spacing.lg,
        },
        totalNumber: {
            fontSize: 28,
            fontWeight: '800',
            color: colors.text.primary,
        },
        totalLabel: {
            fontSize: 14,
            color: colors.text.secondary,
        },
        healthBar: {
            flex: 1,
            height: 8,
            backgroundColor: colors.background.tertiary,
            borderRadius: 4,
            overflow: 'hidden',
        },
        healthBarFill: {
            height: '100%',
            borderRadius: 4,
        },
        healthPercent: {
            marginLeft: spacing.md,
            fontSize: 14,
            fontWeight: '600',
            color: colors.text.secondary,
            minWidth: 60,
            textAlign: 'right',
        },
        section: {
            marginBottom: spacing.lg,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.xs,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text.primary,
        },
        sectionCount: {
            fontSize: 16,
            color: colors.text.tertiary,
        },
        sectionDescription: {
            fontSize: 14,
            color: colors.text.secondary,
            marginBottom: spacing.md,
        },
        feedItem: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
        },
        feedInfo: {
            flex: 1,
        },
        feedTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text.primary,
            marginBottom: spacing.xs,
        },
        feedMeta: {
            fontSize: 13,
            color: colors.text.tertiary,
        },
        errorText: {
            fontSize: 12,
            color: colors.error,
            marginTop: spacing.xs,
        },
        refreshButton: {
            padding: spacing.sm,
            marginLeft: spacing.sm,
        },
    });
