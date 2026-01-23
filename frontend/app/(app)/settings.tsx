import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSettingsStore, useToastStore, useFeedStore } from '@/stores';
import { Settings, api } from '@/services/api';
import { ArrowLeft, Sun, Moon, Monitor, RefreshCw } from 'lucide-react-native';
import { useColors, spacing, borderRadius, shadows } from '@/theme';

export default function SettingsScreen() {
    const router = useRouter();
    const colors = useColors();
    const { settings, fetchSettings, updateSettings } = useSettingsStore();
    const { show } = useToastStore();
    const { feeds, fetchFeeds } = useFeedStore();
    const [isApplyingInterval, setIsApplyingInterval] = useState(false);

    const s = styles(colors);

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleThemeChange = async (theme: 'light' | 'dark' | 'auto') => {
        try {
            await updateSettings({ theme });
            show(`Theme changed to ${theme}`, 'success');
        } catch (error) {
            show('Failed to update theme', 'error');
        }
    };

    const handleToggle = async (key: keyof Settings, value: string | number | boolean) => {
        if (settings) {
            try {
                await updateSettings({ [key]: value });
                show('Setting updated', 'success');
            } catch (error) {
                show('Failed to update setting', 'error');
            }
        }
    };

    const handleApplyIntervalToAll = async () => {
        if (!settings) return;
        setIsApplyingInterval(true);
        try {
            const allFeedIds = feeds.map(f => f.id);
            const result = await api.bulkFeedAction('update_refresh_interval', allFeedIds, undefined, settings.refresh_interval_minutes);
            await fetchFeeds(); // Refresh feeds to show updated intervals
            show(`Updated ${result.affected} feeds`, 'success');
        } catch (error) {
            show('Failed to apply to all feeds', 'error');
        } finally {
            setIsApplyingInterval(false);
        }
    };

    if (!settings) {
        return (
            <View style={s.container}>
                <View style={s.header}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
                        <ArrowLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Settings</Text>
                </View>
                <View style={s.loading}>
                    <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                    <Text style={s.loadingText}>Loading settings...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Settings</Text>
            </View>

            <ScrollView style={s.scrollView} contentContainerStyle={s.content}>
                {/* Appearance */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Appearance</Text>
                    <View style={s.card}>
                        <Text style={s.label}>Theme</Text>
                        <View style={s.themeRow}>
                            <TouchableOpacity
                                style={[s.themeOption, settings.theme === 'light' && s.themeOptionActive]}
                                onPress={() => handleThemeChange('light')}
                            >
                                <Sun size={20} color={settings.theme === 'light' ? colors.text.inverse : colors.text.secondary} />
                                <Text style={[s.themeText, settings.theme === 'light' && s.themeTextActive, settings.theme === 'light' && { color: colors.text.inverse }]}>Light</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.themeOption, settings.theme === 'dark' && s.themeOptionActive]}
                                onPress={() => handleThemeChange('dark')}
                            >
                                <Moon size={20} color={settings.theme === 'dark' ? colors.text.inverse : colors.text.secondary} />
                                <Text style={[s.themeText, settings.theme === 'dark' && s.themeTextActive, settings.theme === 'dark' && { color: colors.text.inverse }]}>Dark</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.themeOption, settings.theme === 'auto' && s.themeOptionActive]}
                                onPress={() => handleThemeChange('auto')}
                            >
                                <Monitor size={20} color={settings.theme === 'auto' ? colors.text.inverse : colors.text.secondary} />
                                <Text style={[s.themeText, settings.theme === 'auto' && s.themeTextActive, settings.theme === 'auto' && { color: colors.text.inverse }]}>Auto</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.divider} />

                        <View style={s.row}>
                            <Text style={s.label}>Show Images</Text>
                            <Switch
                                value={settings.show_images}
                                onValueChange={(v: boolean) => handleToggle('show_images', v)}
                                trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                                thumbColor={colors.text.primary}
                                accessibilityLabel="Show images in articles"
                            />
                        </View>
                    </View>
                </View>

                {/* Reading */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Reading</Text>
                    <View style={s.card}>
                        <View style={s.row}>
                            <View>
                                <Text style={s.label}>Reader Mode</Text>
                                <Text style={s.hint}>Use cleaned article view</Text>
                            </View>
                            <Switch
                                value={settings.readability_enabled}
                                onValueChange={(v: boolean) => handleToggle('readability_enabled', v)}
                                trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                                thumbColor={colors.text.primary}
                                accessibilityLabel="Enable Reader Mode"
                            />
                        </View>

                        <View style={s.divider} />

                        <View style={s.row}>
                            <View>
                                <Text style={s.label}>Fetch Full Content</Text>
                                <Text style={s.hint}>Load full articles when opened</Text>
                            </View>
                            <Switch
                                value={settings.fetch_full_content}
                                onValueChange={(v: boolean) => handleToggle('fetch_full_content', v)}
                                trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                                thumbColor={colors.text.primary}
                                accessibilityLabel="Fetch Full Content"
                            />
                        </View>
                    </View>
                </View>

                {/* Refresh & Storage */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Refresh & Storage</Text>
                    <View style={s.card}>
                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Refresh Interval</Text>
                                <Text style={s.hint}>Default for new feeds</Text>
                            </View>
                            <View style={s.picker}>
                                {[15, 30, 60, 240, 720, 1440].map((mins: number) => (
                                    <TouchableOpacity
                                        key={mins}
                                        onPress={() => handleToggle('refresh_interval_minutes', mins)}
                                        style={[
                                            s.pickerOption,
                                            settings.refresh_interval_minutes === mins && { backgroundColor: colors.primary.DEFAULT }
                                        ]}
                                    >
                                        <Text style={[
                                            s.pickerText,
                                            settings.refresh_interval_minutes === mins && { color: colors.text.inverse, fontWeight: '600' }
                                        ]}>
                                            {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {feeds.length > 0 && (
                            <View style={{ paddingTop: spacing.sm }}>
                                <TouchableOpacity
                                    onPress={handleApplyIntervalToAll}
                                    disabled={isApplyingInterval}
                                    style={[s.applyButton, isApplyingInterval && { opacity: 0.5 }]}
                                >
                                    <RefreshCw size={16} color={colors.primary.DEFAULT} />
                                    <Text style={s.applyButtonText}>
                                        {isApplyingInterval ? 'Applying...' : `Apply ${settings.refresh_interval_minutes >= 60 ? `${settings.refresh_interval_minutes / 60}h` : `${settings.refresh_interval_minutes}m`} to all ${feeds.length} existing feeds`}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={s.divider} />

                        <View style={s.row}>
                            <View>
                                <Text style={s.label}>Keep Articles For</Text>
                                <Text style={s.hint}>Auto-delete read articles</Text>
                            </View>
                            <View style={s.picker}>
                                {[7, 30, 90, 180, 365].map((days: number) => (
                                    <TouchableOpacity
                                        key={days}
                                        onPress={() => handleToggle('retention_days', days)}
                                        style={[
                                            s.pickerOption,
                                            settings.retention_days === days && { backgroundColor: colors.primary.DEFAULT }
                                        ]}
                                    >
                                        <Text style={[
                                            s.pickerText,
                                            settings.retention_days === days && { color: colors.text.inverse, fontWeight: '600' }
                                        ]}>
                                            {days}d
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                </View>

                {/* Version */}
                <Text style={s.version}>Feeds v1.0.0</Text>
            </ScrollView>
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    backButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    loadingText: {
        color: colors.text.tertiary,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: 48,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.tertiary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 16,
        color: colors.text.primary,
    },
    hint: {
        fontSize: 13,
        color: colors.text.tertiary,
        marginTop: 2,
    },
    value: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border.DEFAULT,
        marginVertical: spacing.md,
    },
    themeRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    themeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
    },
    themeOptionActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
        ...shadows.colored(colors.primary.DEFAULT),
    },
    themeText: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    themeTextActive: {
        fontWeight: '600',
    },
    picker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        justifyContent: 'flex-end',
        maxWidth: '60%',
    },
    pickerOption: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: colors.background.tertiary,
    },
    pickerText: {
        fontSize: 12,
        color: colors.text.secondary,
    },
    applyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    applyButtonText: {
        fontSize: 13,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    version: {
        textAlign: 'center',
        color: colors.text.tertiary,
        marginTop: spacing.xl,
    },
});

