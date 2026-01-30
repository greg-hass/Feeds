import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { api } from '@/services/api';
import { useToastStore } from '@/stores/toastStore';
import { Database, Trash2, AlertCircle, CheckCircle } from 'lucide-react-native';

interface RetentionSettings {
    enabled: boolean;
    maxArticleAgeDays: number;
    maxArticlesPerFeed: number;
    keepStarred: boolean;
    keepUnread: boolean;
}

interface DatabaseStats {
    totalSizeBytes: number;
    articleCount: number;
    feedCount: number;
    oldestArticleDate: string | null;
}

interface CleanupPreview {
    articlesAffected: number;
    oldestArticleDate: string | null;
    estimatedSpaceSaved: number;
}

export default function DataRetentionScreen() {
    const colors = useColors();
    const { show } = useToastStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    const [settings, setSettings] = useState<RetentionSettings | null>(null);
    const [stats, setStats] = useState<DatabaseStats | null>(null);
    const [preview, setPreview] = useState<CleanupPreview | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [retentionData, statsData, previewData] = await Promise.all([
                api.getRetentionSettings(),
                api.getMaintenanceStats(),
                api.getCleanupPreview(),
            ]);
            setSettings(retentionData);
            setStats({
                totalSizeBytes: statsData.totalSizeBytes,
                articleCount: statsData.articleCount,
                feedCount: statsData.feedCount,
                oldestArticleDate: statsData.oldestArticleDate,
            });
            setPreview(previewData);
        } catch (error) {
            console.error('Failed to load data retention settings:', error);
            show('Failed to load settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await api.updateRetentionSettings(settings);
            show('Settings saved successfully', 'success');
            // Reload preview with new settings
            const previewData = await api.getCleanupPreview();
            setPreview(previewData);
        } catch (error) {
            console.error('Failed to save retention settings:', error);
            show('Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCleanup = async () => {
        if (!preview || preview.articlesAffected === 0) {
            show('No articles to clean up', 'info');
            return;
        }

        setCleaning(true);
        try {
            const result = await api.runCleanup();
            show(
                `Cleaned up ${result.articlesDeleted.toLocaleString()} articles, reclaimed ${(result.bytesReclaimed / 1024 / 1024 / 1024).toFixed(2)} GB`,
                'success'
            );
            // Reload all data
            await loadData();
        } catch (error) {
            console.error('Failed to run cleanup:', error);
            show('Failed to run cleanup', 'error');
        } finally {
            setCleaning(false);
        }
    };

    const s = styles(colors);

    if (loading) {
        return (
            <View style={s.container}>
                <ScreenHeader title="Data Retention" showBackButton={true} />
                <View style={s.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            </View>
        );
    }

    if (!settings || !stats) {
        return (
            <View style={s.container}>
                <ScreenHeader title="Data Retention" showBackButton={true} />
                <View style={s.errorContainer}>
                    <AlertCircle size={48} color={colors.text.tertiary} />
                    <Text style={s.errorText}>Failed to load settings</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <ScreenHeader title="Data Retention" showBackButton={true} />

            <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent}>
                {/* Database Stats */}
                <View style={s.section}>
                    <SectionHeader title="Database Statistics" icon={<Database size={18} color={colors.text.secondary} />} />
                    <View style={s.statsGrid}>
                        <View style={s.statCard}>
                            <Text style={s.statValue}>{(stats.totalSizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB</Text>
                            <Text style={s.statLabel}>Database Size</Text>
                        </View>
                        <View style={s.statCard}>
                            <Text style={s.statValue}>{stats.articleCount.toLocaleString()}</Text>
                            <Text style={s.statLabel}>Total Articles</Text>
                        </View>
                        <View style={s.statCard}>
                            <Text style={s.statValue}>{stats.feedCount}</Text>
                            <Text style={s.statLabel}>Active Feeds</Text>
                        </View>
                    </View>
                </View>

                {/* Retention Settings */}
                <View style={s.section}>
                    <SectionHeader title="Retention Policy" />

                    <View style={s.settingRow}>
                        <View style={s.settingInfo}>
                            <Text style={s.settingLabel}>Enable Automatic Cleanup</Text>
                            <Text style={s.settingDescription}>Automatically clean up old articles</Text>
                        </View>
                        <Switch
                            value={settings.enabled}
                            onValueChange={(value) => setSettings({ ...settings, enabled: value })}
                            trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                            thumbColor={colors.background.elevated}
                        />
                    </View>

                    <View style={s.inputRow}>
                        <Text style={s.inputLabel}>Maximum Article Age (days)</Text>
                        <Input
                            value={settings.maxArticleAgeDays.toString()}
                            onChangeText={(text) => {
                                const value = parseInt(text) || 0;
                                setSettings({ ...settings, maxArticleAgeDays: value });
                            }}
                            keyboardType="number-pad"
                            placeholder="14"
                            style={s.input}
                        />
                        <Text style={s.inputHint}>Articles older than this will be deleted</Text>
                    </View>

                    <View style={s.inputRow}>
                        <Text style={s.inputLabel}>Maximum Articles Per Feed</Text>
                        <Input
                            value={settings.maxArticlesPerFeed.toString()}
                            onChangeText={(text) => {
                                const value = parseInt(text) || 0;
                                setSettings({ ...settings, maxArticlesPerFeed: value });
                            }}
                            keyboardType="number-pad"
                            placeholder="500"
                            style={s.input}
                        />
                        <Text style={s.inputHint}>Keep only the most recent N articles per feed</Text>
                    </View>

                    <View style={s.settingRow}>
                        <View style={s.settingInfo}>
                            <Text style={s.settingLabel}>Keep Bookmarked Articles</Text>
                            <Text style={s.settingDescription}>Never delete bookmarked articles</Text>
                        </View>
                        <Switch
                            value={settings.keepStarred}
                            onValueChange={(value) => setSettings({ ...settings, keepStarred: value })}
                            trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                            thumbColor={colors.background.elevated}
                        />
                    </View>

                    <View style={s.settingRow}>
                        <View style={s.settingInfo}>
                            <Text style={s.settingLabel}>Keep Unread Articles</Text>
                            <Text style={s.settingDescription}>Never delete unread articles</Text>
                        </View>
                        <Switch
                            value={settings.keepUnread}
                            onValueChange={(value) => setSettings({ ...settings, keepUnread: value })}
                            trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                            thumbColor={colors.background.elevated}
                        />
                    </View>

                    <Button
                        title={saving ? 'Saving...' : 'Save Settings'}
                        onPress={handleSave}
                        disabled={saving}
                        variant="primary"
                        style={s.saveButton}
                    />
                </View>

                {/* Cleanup Preview */}
                {preview && (
                    <View style={s.section}>
                        <SectionHeader title="Cleanup Preview" icon={<Trash2 size={18} color={colors.text.secondary} />} />

                        {preview.articlesAffected > 0 ? (
                            <>
                                <View style={s.previewCard}>
                                    <AlertCircle size={24} color={colors.warning} />
                                    <View style={s.previewInfo}>
                                        <Text style={s.previewTitle}>
                                            {preview.articlesAffected.toLocaleString()} articles will be deleted
                                        </Text>
                                        <Text style={s.previewSubtitle}>
                                            Estimated space saved: {(preview.estimatedSpaceSaved / 1024 / 1024 / 1024).toFixed(2)} GB
                                        </Text>
                                        {preview.oldestArticleDate && (
                                            <Text style={s.previewSubtitle}>
                                                Oldest article: {new Date(preview.oldestArticleDate).toLocaleDateString()}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                <Button
                                    title={cleaning ? 'Cleaning Up...' : 'Run Cleanup Now'}
                                    onPress={handleCleanup}
                                    disabled={cleaning}
                                    variant="danger"
                                    icon={<Trash2 size={16} color={colors.text.inverse} />}
                                    style={s.cleanupButton}
                                />
                            </>
                        ) : (
                            <View style={s.noCleanupCard}>
                                <CheckCircle size={24} color={colors.success} />
                                <Text style={s.noCleanupText}>No articles to clean up</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    errorText: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xl * 2,
    },
    section: {
        marginBottom: spacing.xl,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    statLabel: {
        fontSize: 12,
        color: colors.text.tertiary,
        textAlign: 'center',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    settingInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    settingDescription: {
        fontSize: 14,
        color: colors.text.tertiary,
    },
    inputRow: {
        marginTop: spacing.md,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    input: {
        marginBottom: spacing.xs,
    },
    inputHint: {
        fontSize: 12,
        color: colors.text.tertiary,
        marginTop: spacing.xs,
    },
    saveButton: {
        marginTop: spacing.lg,
    },
    previewCard: {
        flexDirection: 'row',
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.warning,
        gap: spacing.md,
        marginTop: spacing.md,
    },
    previewInfo: {
        flex: 1,
    },
    previewTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    previewSubtitle: {
        fontSize: 14,
        color: colors.text.secondary,
        marginTop: spacing.xs,
    },
    noCleanupCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.success,
        gap: spacing.md,
        marginTop: spacing.md,
    },
    noCleanupText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.success,
    },
    cleanupButton: {
        marginTop: spacing.md,
    },
});
