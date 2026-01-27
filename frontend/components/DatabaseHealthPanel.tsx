import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';
import { api } from '@/services/api';
import { Database, AlertTriangle, CheckCircle, HardDrive } from 'lucide-react-native';

interface DatabaseStats {
    database: {
        totalSizeMb: string;
        articleCount: number;
        feedCount: number;
        oldestArticleDate: string | null;
        ftsSizeMb: string;
    };
    tables: Array<{
        name: string;
        rows: number;
        estimatedSizeMb: string;
    }>;
    maintenance: {
        fragmentationPercent: string;
        needsVacuum: boolean;
        needsOptimize: boolean;
        recommendations: string[];
    };
}

export const DatabaseHealthPanel = () => {
    const colors = useColors();
    const s = styles(colors);
    const [stats, setStats] = useState<DatabaseStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await api.getDatabaseStats();
            setStats(data);
        } catch (err) {
            console.error('Failed to load database stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOptimize = async () => {
        try {
            setOptimizing(true);
            setMessage('Optimizing database...');
            const result = await api.optimizeDatabase();
            setMessage(result.message);
            await loadStats();
        } catch (err) {
            setMessage('Optimization failed');
        } finally {
            setOptimizing(false);
        }
    };

    if (loading) {
        return (
            <View style={s.container}>
                <ActivityIndicator color={colors.primary?.DEFAULT ?? colors.primary} />
            </View>
        );
    }

    if (!stats) {
        return (
            <View style={s.container}>
                <Text style={s.errorText}>Failed to load database statistics</Text>
            </View>
        );
    }

    const isHealthy = !stats.maintenance.needsVacuum && stats.maintenance.recommendations.length === 0;

    return (
        <ScrollView style={s.container}>
            <View style={s.header}>
                <Database size={24} color={colors.primary?.DEFAULT ?? colors.primary} />
                <Text style={s.title}>Database Health</Text>
            </View>

            {/* Health Status */}
            <View style={[s.statusCard, isHealthy ? s.statusHealthy : s.statusWarning]}>
                {isHealthy ? (
                    <>
                        <CheckCircle size={20} color={colors.status?.success ?? '#22c55e'} />
                        <Text style={s.statusText}>Database is healthy</Text>
                    </>
                ) : (
                    <>
                        <AlertTriangle size={20} color={colors.status?.warning ?? '#f59e0b'} />
                        <Text style={s.statusText}>Maintenance recommended</Text>
                    </>
                )}
            </View>

            {/* Size Overview */}
            <View style={s.card}>
                <View style={s.cardHeader}>
                    <HardDrive size={18} color={colors.text?.secondary} />
                    <Text style={s.cardTitle}>Storage Overview</Text>
                </View>
                
                <View style={s.statRow}>
                    <Text style={s.statLabel}>Total Size</Text>
                    <Text style={s.statValue}>{stats.database.totalSizeMb} MB</Text>
                </View>
                
                <View style={s.statRow}>
                    <Text style={s.statLabel}>Articles</Text>
                    <Text style={s.statValue}>{stats.database.articleCount.toLocaleString()}</Text>
                </View>
                
                <View style={s.statRow}>
                    <Text style={s.statLabel}>Feeds</Text>
                    <Text style={s.statValue}>{stats.database.feedCount}</Text>
                </View>
                
                <View style={s.statRow}>
                    <Text style={s.statLabel}>Fragmentation</Text>
                    <Text style={[s.statValue, stats.maintenance.needsVacuum && s.warningText]}>
                        {stats.maintenance.fragmentationPercent}%
                    </Text>
                </View>
            </View>

            {/* Recommendations */}
            {stats.maintenance.recommendations.length > 0 && (
                <View style={s.card}>
                    <Text style={s.cardTitle}>Recommendations</Text>
                    {stats.maintenance.recommendations.map((rec, index) => (
                        <View key={index} style={s.recommendation}>
                            <AlertTriangle size={14} color={colors.status?.warning} />
                            <Text style={s.recommendationText}>{rec}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Table Sizes */}
            <View style={s.card}>
                <Text style={s.cardTitle}>Table Sizes</Text>
                {stats.tables.slice(0, 5).map((table) => (
                    <View key={table.name} style={s.tableRow}>
                        <Text style={s.tableName}>{table.name}</Text>
                        <View style={s.tableStats}>
                            <Text style={s.tableRows}>{table.rows.toLocaleString()} rows</Text>
                            <Text style={s.tableSize}>{table.estimatedSizeMb} MB</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Actions */}
            <View style={s.actions}>
                <TouchableOpacity
                    style={[s.button, optimizing && s.buttonDisabled]}
                    onPress={handleOptimize}
                    disabled={optimizing}
                >
                    {optimizing ? (
                        <ActivityIndicator size="small" color={colors.text?.inverse} />
                    ) : (
                        <Text style={s.buttonText}>Optimize Database</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[s.button, s.buttonSecondary]}
                    onPress={loadStats}
                    disabled={loading}
                >
                    <Text style={[s.buttonText, s.buttonTextSecondary]}>Refresh Stats</Text>
                </TouchableOpacity>
            </View>

            {message && (
                <Text style={s.message}>{message}</Text>
            )}
        </ScrollView>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text?.primary,
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
    },
    statusHealthy: {
        backgroundColor: (colors.status?.success ?? '#22c55e') + '20',
    },
    statusWarning: {
        backgroundColor: (colors.status?.warning ?? '#f59e0b') + '20',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text?.primary,
    },
    card: {
        backgroundColor: colors.background?.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text?.primary,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.xs,
    },
    statLabel: {
        fontSize: 14,
        color: colors.text?.secondary,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text?.primary,
    },
    warningText: {
        color: colors.status?.warning ?? '#f59e0b',
    },
    recommendation: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
    },
    recommendationText: {
        fontSize: 13,
        color: colors.text?.secondary,
        flex: 1,
    },
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border?.DEFAULT,
    },
    tableName: {
        fontSize: 14,
        color: colors.text?.primary,
    },
    tableStats: {
        alignItems: 'flex-end',
    },
    tableRows: {
        fontSize: 12,
        color: colors.text?.tertiary,
    },
    tableSize: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text?.secondary,
    },
    actions: {
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    button: {
        backgroundColor: colors.primary?.DEFAULT ?? colors.primary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    buttonSecondary: {
        backgroundColor: colors.background?.tertiary,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: colors.text?.inverse,
        fontWeight: '600',
    },
    buttonTextSecondary: {
        color: colors.text?.primary,
    },
    message: {
        textAlign: 'center',
        marginTop: spacing.md,
        color: colors.text?.secondary,
    },
    errorText: {
        color: colors.status?.error ?? '#ef4444',
        textAlign: 'center',
    },
});
