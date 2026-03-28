import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useSettingsStore, useToastStore, useFeedStore, useArticleStore, useDigestStore } from '@/stores';
import { Settings, FeedFetchLimits, api } from '@/services/api';
import { Sun, Moon, Monitor, Check, Trash2, Type, HardDrive } from 'lucide-react-native';
import { useColors, spacing, borderRadius, ACCENT_COLORS, AccentColor } from '@/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { Dropdown } from '@/components/Dropdown';

export default function SettingsScreen() {
    const router = useRouter();
    const colors = useColors();
    const { settings, globalNextRefreshAt, fetchSettings, updateSettings } = useSettingsStore();
    const { settings: digestSettings, fetchSettings: fetchDigestSettings, updateSettings: updateDigestSettings } = useDigestStore();
    const { fetchFeeds, refreshAllFeeds } = useFeedStore();
    const { show } = useToastStore();
    const [backendBuild, setBackendBuild] = useState<{ version: string; sha: string } | null>(null);

    const s = styles(colors);
    const frontendVersion =
        process.env.EXPO_PUBLIC_APP_VERSION ||
        Constants.expoConfig?.version ||
        Constants.manifest?.version ||
        'dev';
    const frontendBuildSha = process.env.EXPO_PUBLIC_BUILD_SHA || 'dev';

    // Handle legacy accent colors by falling back to emerald if the stored value isn't in the new palette
    const activeAccent = settings?.accent_color && Object.keys(ACCENT_COLORS).includes(settings.accent_color)
        ? settings.accent_color
        : 'emerald';

    useEffect(() => {
        fetchSettings();
        fetchDigestSettings();
        api.getAuthStatus()
            .then((status) => setBackendBuild(status.build || null))
            .catch(() => setBackendBuild(null));
    }, []);

    const timeOptions = Array.from({ length: 48 }).map((_, i) => {
        const hour = Math.floor(i / 2);
        const minute = i % 2 === 0 ? '00' : '30';
        const time = `${hour.toString().padStart(2, '0')}:${minute}`;
        return { label: time, value: time };
    });

    const refreshIntervalOptions = [
        { label: 'Every 5 minutes', value: 5 },
        { label: 'Every 10 minutes', value: 10 },
        { label: 'Every 15 minutes', value: 15 },
        { label: 'Every 30 minutes', value: 30 },
        { label: 'Every hour', value: 60 },
        { label: 'Every 2 hours', value: 120 },
        { label: 'Every 4 hours', value: 240 },
        { label: 'Every 12 hours', value: 720 },
        { label: 'Every 24 hours', value: 1440 },
    ];

    const formatNextRefresh = (iso: string | null): string => {
        if (!iso) return 'Not scheduled';

        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return 'Not scheduled';

        const localTime = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
        const diffMs = date.getTime() - Date.now();
        if (diffMs <= 0) return 'Due now';

        const diffMinutes = Math.ceil(diffMs / 60000);
        if (diffMinutes < 60) {
            return `In ${diffMinutes}m · ${localTime}`;
        }

        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        if (hours < 24) {
            return minutes > 0
                ? `In ${hours}h ${minutes}m · ${localTime}`
                : `In ${hours}h · ${localTime}`;
        }

        return `${date.toLocaleString([], {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
        })} · ${localTime}`;
    };

    const nextRefreshLabel = formatNextRefresh(globalNextRefreshAt);

    const handleDigestToggle = async (key: string, value: any) => {
        await updateDigestSettings({ [key]: value });
    };

    const handleThemeChange = async (theme: 'light' | 'dark' | 'auto') => {
        try {
            await updateSettings({ theme });
            show(`Theme changed to ${theme}`, 'success');
        } catch (error) {
            show('Failed to update theme', 'error');
        }
    };

    const handleToggle = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
        if (settings) {
            try {
                await updateSettings({ [key]: value } as Partial<Settings>);
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
            
            // Refresh articles to get fresh data with new icons
            const { fetchArticles } = useArticleStore.getState();
            await fetchArticles(true);
            
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

    const isDigestEnabled = !!digestSettings?.enabled;
    const feedFetchLimits: FeedFetchLimits = {
        rss_days: settings.feed_fetch_limits?.rss_days ?? 14,
        youtube_count: settings.feed_fetch_limits?.youtube_count ?? 10,
        youtube_days: settings.feed_fetch_limits?.youtube_days ?? 30,
        reddit_days: settings.feed_fetch_limits?.reddit_days ?? 7,
        podcast_count: settings.feed_fetch_limits?.podcast_count ?? 5,
    };

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

                        <View style={s.row}>
                            <View>
                                <Text style={s.label}>Keep Screen Awake</Text>
                                <Text style={s.hint}>Prevents auto-lock while the app is open</Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    s.customSwitch,
                                    { backgroundColor: (settings.keep_screen_awake ?? true) ? colors.primary.DEFAULT : colors.border.DEFAULT }
                                ]}
                                onPress={() => handleToggle('keep_screen_awake', !(settings.keep_screen_awake ?? true))}
                                accessibilityLabel="Keep screen awake"
                                accessibilityRole="switch"
                                accessibilityState={{ checked: settings.keep_screen_awake ?? true }}
                            >
                                <View style={[
                                    s.customSwitchThumb,
                                    {
                                        backgroundColor: colors.background.primary,
                                        transform: [{ translateX: (settings.keep_screen_awake ?? true) ? 20 : 0 }]
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
                                            activeAccent === key && s.accentOptionActive
                                        ]}
                                        onPress={() => handleToggle('accent_color', key)}
                                        accessibilityLabel={`Set accent color to ${key}`}
                                    >
                                        {activeAccent === key && (
                                            <Check size={16} color="#fff" />
                                        )}
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

                        <View style={s.divider} />

                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Font Family</Text>
                                <Text style={s.hint}>Reader view typography</Text>
                            </View>
                            <View style={s.picker}>
                                <TouchableOpacity
                                    onPress={() => handleToggle('font_family', 'sans')}
                                    style={[
                                        s.pickerOption,
                                        (settings.font_family === 'sans' || !settings.font_family) && { backgroundColor: colors.primary.dark }
                                    ]}
                                >
                                    <Text style={[
                                        s.pickerText,
                                        (settings.font_family === 'sans' || !settings.font_family) && { color: colors.text.inverse, fontWeight: '600' }
                                    ]}>Sans</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleToggle('font_family', 'serif')}
                                    style={[
                                        s.pickerOption,
                                        settings.font_family === 'serif' && { backgroundColor: colors.primary.dark }
                                    ]}
                                >
                                    <Text style={[
                                        s.pickerText,
                                        settings.font_family === 'serif' && { color: colors.text.inverse, fontWeight: '600' }
                                    ]}>Serif</Text>
                                </TouchableOpacity>
                            </View>
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
                                value={String(feedFetchLimits.rss_days)}
                                options={[
                                    { label: '7 days', value: 7 },
                                    { label: '14 days', value: 14 },
                                    { label: '30 days', value: 30 },
                                    { label: '60 days', value: 60 },
                                    { label: '90 days', value: 90 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...feedFetchLimits, rss_days: Number(value) })}
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
                                value={String(feedFetchLimits.youtube_count)}
                                options={[
                                    { label: '5 videos', value: 5 },
                                    { label: '10 videos', value: 10 },
                                    { label: '15 videos', value: 15 },
                                    { label: '20 videos', value: 20 },
                                    { label: '30 videos', value: 30 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...feedFetchLimits, youtube_count: Number(value) })}
                            />
                        </View>
                        <View style={[s.row, { marginTop: 12 }]}>
                            <Text style={s.sublabel}>Timeframe</Text>
                            <Dropdown
                                value={String(feedFetchLimits.youtube_days)}
                                options={[
                                    { label: '7 days', value: 7 },
                                    { label: '14 days', value: 14 },
                                    { label: '30 days', value: 30 },
                                    { label: '60 days', value: 60 },
                                    { label: '90 days', value: 90 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...feedFetchLimits, youtube_days: Number(value) })}
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
                                value={String(feedFetchLimits.reddit_days)}
                                options={[
                                    { label: '3 days', value: 3 },
                                    { label: '7 days', value: 7 },
                                    { label: '14 days', value: 14 },
                                    { label: '30 days', value: 30 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...feedFetchLimits, reddit_days: Number(value) })}
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
                                value={String(feedFetchLimits.podcast_count)}
                                options={[
                                    { label: '3 episodes', value: 3 },
                                    { label: '5 episodes', value: 5 },
                                    { label: '10 episodes', value: 10 },
                                    { label: '15 episodes', value: 15 },
                                    { label: '20 episodes', value: 20 },
                                ]}
                                onSelect={(value) => handleToggle('feed_fetch_limits', { ...feedFetchLimits, podcast_count: Number(value) })}
                            />
                        </View>
                    </View>
                </View>

                {/* Daily Digest */}
                <View style={s.section}>
                    <SectionHeader title="Daily Digest" />
                    <View style={s.card}>
                        <View style={s.row}>
                            <View>
                                <Text style={s.label}>Enable Digest</Text>
                                <Text style={s.hint}>AI-generated summary</Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    s.customSwitch,
                                    { backgroundColor: isDigestEnabled ? colors.primary.DEFAULT : colors.border.DEFAULT }
                                ]}
                                onPress={() => handleDigestToggle('enabled', !isDigestEnabled)}
                                accessibilityLabel="Enable Daily Digest"
                                accessibilityRole="switch"
                                accessibilityState={{ checked: isDigestEnabled }}
                            >
                                <View style={[
                                    s.customSwitchThumb,
                                    { 
                                        backgroundColor: colors.background.primary,
                                        transform: [{ translateX: isDigestEnabled ? 20 : 0 }]
                                    }
                                ]} />
                            </TouchableOpacity>
                        </View>

                        {isDigestEnabled && (
                            <>
                                <View style={s.divider} />
                                <View style={s.row}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.label}>Morning Edition</Text>
                                        <Text style={s.hint}>Schedule time</Text>
                                    </View>
                                    <Dropdown
                                        value={digestSettings.schedule_morning || '08:00'}
                                        options={timeOptions}
                                        onSelect={(value) => handleDigestToggle('schedule_morning', value)}
                                    />
                                </View>

                                <View style={[s.row, { marginTop: 12 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.label}>Evening Edition</Text>
                                        <Text style={s.hint}>Schedule time</Text>
                                    </View>
                                    <Dropdown
                                        value={digestSettings.schedule_evening || '20:00'}
                                        options={timeOptions}
                                        onSelect={(value) => handleDigestToggle('schedule_evening', value)}
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </View>

                {/* Refresh & Storage */}
                <View style={s.section}>
                    <SectionHeader title="Refresh & Storage" />
                    <View style={s.card}>
                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Refresh Interval</Text>
                                <Text style={s.hint}>Backend refresh schedule</Text>
                            </View>
                            <Dropdown
                                value={String(settings.refresh_interval_minutes || 15)}
                                options={refreshIntervalOptions}
                                onSelect={(value) => handleToggle('refresh_interval_minutes', Number(value) as Settings['refresh_interval_minutes'])}
                            />
                        </View>

                        <View style={s.nextRefreshRow}>
                            <Text style={s.nextRefreshLabel}>Next Refresh</Text>
                            <Text style={s.nextRefreshValue}>{nextRefreshLabel}</Text>
                        </View>

                        <View style={s.divider} />

                        <View style={s.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>Keep Articles</Text>
                                <Text style={s.hint}>Auto-delete older than</Text>
                            </View>
                            <Dropdown
                                value={String(settings.retention_days || 90)}
                                options={[
                                    { label: '30 Days', value: 30 },
                                    { label: '90 Days', value: 90 },
                                    { label: '6 Months', value: 180 },
                                    { label: '1 Year', value: 365 },
                                    { label: 'Forever', value: 3650 },
                                ]}
                                onSelect={(value) => handleToggle('retention_days', Number(value))}
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
                <Text style={s.version}>Frontend v{frontendVersion} ({frontendBuildSha})</Text>
                <Text style={s.version}>Backend v{backendBuild?.version || 'unknown'} ({backendBuild?.sha || 'unknown'})</Text>
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
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: 40,
    },
    section: {
        marginBottom: spacing.lg,
    },
    card: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing.md,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text.primary,
    },
    hint: {
        fontSize: 12,
        color: colors.text.tertiary,
        marginTop: 2,
        lineHeight: 16,
    },
    value: {
        fontSize: 15,
        color: colors.text.secondary,
    },
    nextRefreshRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    nextRefreshLabel: {
        fontSize: 13,
        color: colors.text.tertiary,
        fontWeight: '500',
    },
    nextRefreshValue: {
        fontSize: 13,
        color: colors.primary.DEFAULT,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border.DEFAULT,
        marginVertical: spacing.sm,
    },
    themeRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    themeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
    },
    themeOptionActive: {
        backgroundColor: colors.primary.dark,
        borderColor: colors.primary.dark,
    },
    themeText: {
        fontSize: 13,
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
        fontSize: 11,
        color: colors.text.secondary,
    },
    sectionHint: {
        fontSize: 12,
        color: colors.text.tertiary,
        marginBottom: spacing.sm,
        marginTop: spacing.xs,
    },
    sublabel: {
        fontSize: 13,
        color: colors.text.secondary,
        minWidth: 50,
    },
    version: {
        textAlign: 'center',
        color: colors.text.tertiary,
        marginTop: spacing.lg,
        fontSize: 11,
    },
    accentSection: {
        flexDirection: 'column',
        gap: spacing.sm,
    },
    accentRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        flexWrap: 'wrap',
    },
    accentOption: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    accentOptionActive: {
        borderColor: colors.text.primary,
    },
    dangerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    dangerLabel: {
        fontSize: 15,
        color: colors.error,
        fontWeight: '600',
    },
    customSwitch: {
        width: 46,
        height: 26,
        borderRadius: 13,
        padding: 2,
        justifyContent: 'center',
    },
    customSwitchThumb: {
        width: 22,
        height: 22,
        borderRadius: 11,
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
        fontSize: 13,
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
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background.tertiary,
        minWidth: 50,
        alignItems: 'center',
    },
    dropdownOptionText: {
        fontSize: 11,
        color: colors.text.secondary,
        fontWeight: '500',
    },
});
