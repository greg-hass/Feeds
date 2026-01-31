import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSettingsStore, useToastStore, useFeedStore } from '@/stores';
import { Settings, api } from '@/services/api';
import { Sun, Moon, Monitor, Check, Trash2 } from 'lucide-react-native';
import { useColors, spacing, borderRadius, shadows, ACCENT_COLORS, AccentColor } from '@/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { Dropdown } from '@/components/Dropdown';

export default function SettingsScreen() {
    const router = useRouter();
    const colors = useColors();
    const { settings, fetchSettings, updateSettings } = useSettingsStore();
    const { fetchFeeds, refreshAllFeeds } = useFeedStore();
    const { show } = useToastStore();

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

    const handleClearIconCache = async () => {
        try {
            await api.clearIconCache();
            await fetchFeeds(); // Reload feeds to get updated icon URLs
            await refreshAllFeeds(); // Refresh all feeds to fetch new icons from sources
            show('Icon cache cleared and feeds refreshed', 'success');
        } catch (error) {
            show('Failed to clear icon cache', 'error');
        }
    };


    if (!settings) {
        return (
            <View style={s.container}>
                <ScreenHeader title="Settings" />
                <LoadingState variant="inline" message="Loading settings…" />
            </View>
        );
    }

    return (
        <View style={s.container}>
            <ScreenHeader title="Settings" />

            <ScrollView style={s.scrollView} contentContainerStyle={s.content}>
                {/* Appearance */}
                <View style={s.section}>
                    <SectionHeader title="Appearance" />
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
                            <TouchableOpacity
                                style={[
                                    s.customSwitch,
                                    { backgroundColor: settings.show_images ? colors.primary.DEFAULT : colors.border.DEFAULT }
                                ]}
                                onPress={() => handleToggle('show_images', !settings.show_images)}
                                accessibilityLabel="Show images in articles"
                                accessibilityRole="switch"
                                accessibilityState={{ checked: settings.show_images }}
                            >
                                <View style={[
                                    s.customSwitchThumb,
                                    { 
                                        backgroundColor: colors.background.primary,
                                        transform: [{ translateX: settings.show_images ? 20 : 0 }]
                                    }
                                ]} />
                            </TouchableOpacity>
                        </View>

                        <View style={s.divider} />

                        <View style={s.accentSection}>
                            <Text style={s.label}>Accent Colour</Text>
                            <View style={s.accentRow}>
                                {(Object.keys(ACCENT_COLORS) as AccentColor[]).map((key) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={[
                                            s.accentOption,
                                            { backgroundColor: ACCENT_COLORS[key].DEFAULT },
                                            (settings.accent_color === key || (!settings.accent_color && key === 'emerald')) && s.accentOptionActive
                                        ]}
                                        onPress={() => handleToggle('accent_color', key)}
                                        accessibilityLabel={`Set accent color to ${key}`}
                                    >
                                        {(settings.accent_color === key || (!settings.accent_color && key === 'emerald')) && (
                                            <Check size={16} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={s.divider} />

                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>View Density</Text>
                                <Text style={s.hint}>Article card spacing</Text>
                            </View>
                            <View style={s.picker}>
                                {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                                    <TouchableOpacity
                                        key={density}
                                        onPress={() => handleToggle('view_density', density)}
                                        style={[
                                            s.pickerOption,
                                            (settings.view_density === 'comfortable' || !settings.view_density) && density === 'comfortable' && { backgroundColor: colors.primary.dark }
                                        ]}
                                    >
                                        <Text style={[
                                            s.pickerText,
                                            (settings.view_density === 'comfortable' || !settings.view_density) && density === 'comfortable' && { color: colors.text.inverse, fontWeight: '600' }
                                        ]}>
                                            {density.charAt(0).toUpperCase() + density.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                </View>

                {/* Reading */}
                <View style={s.section}>
                    <SectionHeader title="Reading" />
                    <View style={s.card}>
                        <View style={s.row}>
                            <View>
                                <Text style={s.label}>Reader Mode</Text>
                                <Text style={s.hint}>Use cleaned article view</Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    s.customSwitch,
                                    { backgroundColor: settings.readability_enabled ? colors.primary.DEFAULT : colors.border.DEFAULT }
                                ]}
                                onPress={() => handleToggle('readability_enabled', !settings.readability_enabled)}
                                accessibilityLabel="Enable Reader Mode"
                                accessibilityRole="switch"
                                accessibilityState={{ checked: settings.readability_enabled }}
                            >
                                <View style={[
                                    s.customSwitchThumb,
                                    { 
                                        backgroundColor: colors.background.primary,
                                        transform: [{ translateX: settings.readability_enabled ? 20 : 0 }]
                                    }
                                ]} />
                            </TouchableOpacity>
                        </View>

                        <View style={s.divider} />

                        <View style={s.row}>
                            <View>
                                <Text style={s.label}>Fetch Full Content</Text>
                                <Text style={s.hint}>Load full articles when opened</Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    s.customSwitch,
                                    { backgroundColor: settings.fetch_full_content ? colors.primary.DEFAULT : colors.border.DEFAULT }
                                ]}
                                onPress={() => handleToggle('fetch_full_content', !settings.fetch_full_content)}
                                accessibilityLabel="Fetch Full Content"
                                accessibilityRole="switch"
                                accessibilityState={{ checked: settings.fetch_full_content }}
                            >
                                <View style={[
                                    s.customSwitchThumb,
                                    { 
                                        backgroundColor: colors.background.primary,
                                        transform: [{ translateX: settings.fetch_full_content ? 20 : 0 }]
                                    }
                                ]} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Feed Fetching Rules */}
                <View style={s.section}>
                    <SectionHeader title="Feed Fetching Rules" />
                    <Text style={s.sectionHint}>Limit articles fetched per feed type. Bookmarks are not affected.</Text>
                    <View style={s.card}>
                        {/* RSS Feeds */}
                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>RSS Feeds</Text>
                                <Text style={s.hint}>Articles newer than</Text>
                            </View>
                            <Dropdown
                                value={String(settings.feed_fetch_limits?.rss_days || 14)}
                                options={[
                                    { label: '7 days', value: 7 },
                                    { label: '14 days', value: 14 },
                                    { label: '30 days', value: 30 },
                                    { label: '60 days', value: 60 },
                                    { label: '90 days', value: 90 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...settings.feed_fetch_limits, rss_days: value })}
                            />
                        </View>

                        <View style={s.divider} />

                        {/* YouTube Feeds */}
                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>YouTube</Text>
                                <Text style={s.hint}>Fetch last N videos within N days</Text>
                            </View>
                        </View>
                        <View style={[s.row, { marginTop: 12 }]}>
                            <Text style={s.sublabel}>Videos</Text>
                            <Dropdown
                                value={String(settings.feed_fetch_limits?.youtube_count || 10)}
                                options={[
                                    { label: '5 videos', value: 5 },
                                    { label: '10 videos', value: 10 },
                                    { label: '15 videos', value: 15 },
                                    { label: '20 videos', value: 20 },
                                    { label: '30 videos', value: 30 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...settings.feed_fetch_limits, youtube_count: value })}
                            />
                        </View>
                        <View style={[s.row, { marginTop: 12 }]}>
                            <Text style={s.sublabel}>Timeframe</Text>
                            <Dropdown
                                value={String(settings.feed_fetch_limits?.youtube_days || 30)}
                                options={[
                                    { label: '7 days', value: 7 },
                                    { label: '14 days', value: 14 },
                                    { label: '30 days', value: 30 },
                                    { label: '60 days', value: 60 },
                                    { label: '90 days', value: 90 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...settings.feed_fetch_limits, youtube_days: value })}
                            />
                        </View>

                        <View style={s.divider} />

                        {/* Reddit Feeds */}
                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Reddit</Text>
                                <Text style={s.hint}>Posts newer than</Text>
                            </View>
                            <Dropdown
                                value={String(settings.feed_fetch_limits?.reddit_days || 7)}
                                options={[
                                    { label: '3 days', value: 3 },
                                    { label: '7 days', value: 7 },
                                    { label: '14 days', value: 14 },
                                    { label: '30 days', value: 30 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...settings.feed_fetch_limits, reddit_days: value })}
                            />
                        </View>

                        <View style={s.divider} />

                        {/* Podcast Feeds */}
                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Podcasts</Text>
                                <Text style={s.hint}>Keep last N episodes</Text>
                            </View>
                            <Dropdown
                                value={String(settings.feed_fetch_limits?.podcast_count || 5)}
                                options={[
                                    { label: '3 episodes', value: 3 },
                                    { label: '5 episodes', value: 5 },
                                    { label: '10 episodes', value: 10 },
                                    { label: '15 episodes', value: 15 },
                                    { label: '20 episodes', value: 20 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...settings.feed_fetch_limits, podcast_count: value })}
                            />
                        </View>
                    </View>
                </View>

                {/* Refresh & Storage */}
                <View style={s.section}>
                    <SectionHeader title="Refresh & Storage" />
                    <View style={s.card}>
                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Refresh Interval</Text>
                                <Text style={s.hint}>Backend schedule</Text>
                            </View>
                            <Dropdown
                                value={String(settings.refresh_interval_minutes || 15)}
                                options={[
                                    { label: '15 minutes', value: 15 },
                                    { label: '30 minutes', value: 30 },
                                    { label: '1 hour', value: 60 },
                                    { label: '4 hours', value: 240 },
                                    { label: '12 hours', value: 720 },
                                    { label: '24 hours', value: 1440 },
                                ]}
                                onSelect={(value) => handleToggle('refresh_interval_minutes', value)}
                            />
                        </View>

                        <View style={s.divider} />

                        <TouchableOpacity style={s.row} onPress={() => router.push('/database-health')}>
                            <View>
                                <Text style={s.label}>Database Health</Text>
                                <Text style={s.hint}>View stats & optimize</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={s.divider} />

                        <TouchableOpacity style={s.dangerRow} onPress={handleClearIconCache}>
                            <View>
                                <Text style={s.dangerLabel}>Clear Icon Cache</Text>
                                <Text style={s.hint}>Fixes incorrect feed icons</Text>
                            </View>
                            <Trash2 size={20} color={colors.error} />
                        </TouchableOpacity>
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
        backgroundColor: colors.primary.dark,
        borderColor: colors.primary.dark,
        ...shadows.colored(colors.primary.dark),
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
    sectionHint: {
        fontSize: 13,
        color: colors.text.tertiary,
        marginBottom: spacing.md,
        marginTop: spacing.xs,
    },
    sublabel: {
        fontSize: 14,
        color: colors.text.secondary,
        minWidth: 50,
    },
    version: {
        textAlign: 'center',
        color: colors.text.tertiary,
        marginTop: spacing.xl,
    },
    accentSection: {
        flexDirection: 'column',
        gap: spacing.md,
    },
    accentRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    accentOption: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    accentOptionActive: {
        borderColor: colors.text.primary,
        transform: [{ scale: 1.1 }],
    },
    dangerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    dangerLabel: {
        fontSize: 16,
        color: colors.error,
        fontWeight: '500',
    },
    customSwitch: {
        width: 48,
        height: 28,
        borderRadius: 14,
        padding: 2,
        justifyContent: 'center',
    },
    customSwitchThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    dropdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownContainer: {
        alignItems: 'flex-end',
    },
    dropdownValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    dropdownOptions: {
        flexDirection: 'row',
        gap: spacing.xs,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        maxWidth: 200,
    },
    dropdownOption: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
        minWidth: 50,
        alignItems: 'center',
    },
    dropdownOptionText: {
        fontSize: 12,
        color: colors.text.secondary,
        fontWeight: '500',
    },
});
