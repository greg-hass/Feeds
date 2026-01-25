import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSettingsStore, useToastStore } from '@/stores';
import { Settings } from '@/services/api';
import { ArrowLeft, Sun, Moon, Monitor, Check } from 'lucide-react-native';
import { useColors, spacing, borderRadius, shadows, ACCENT_COLORS, AccentColor } from '@/theme';

export default function SettingsScreen() {
    const router = useRouter();
    const colors = useColors();
    const { settings, fetchSettings, updateSettings } = useSettingsStore();
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


    if (!settings) {
        return (
            <View style={s.container}>
                <View style={s.header}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backButton} accessibilityLabel="Go back">
                        <ArrowLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Settings</Text>
                </View>
                <View style={s.loading}>
                    <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                    <Text style={s.loadingText}>Loading settings…</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backButton} accessibilityLabel="Go back">
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
                                trackColor={{ false: colors.border.DEFAULT, true: colors.primary.dark }}
                                thumbColor={colors.background.primary}
                                accessibilityLabel="Show images in articles"
                            />
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
                                trackColor={{ false: colors.border.DEFAULT, true: colors.primary.dark }}
                                thumbColor={colors.background.primary}
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
                                trackColor={{ false: colors.border.DEFAULT, true: colors.primary.dark }}
                                thumbColor={colors.background.primary}
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
                                <Text style={s.hint}>Backend schedule</Text>
                            </View>
                            <View style={s.picker}>
                                {[15, 30, 60, 240, 720, 1440].map((mins: number) => (
                                    <TouchableOpacity
                                        key={mins}
                                        onPress={() => handleToggle('refresh_interval_minutes', mins)}
                                        style={[
                                            s.pickerOption,
                                            settings.refresh_interval_minutes === mins && { backgroundColor: colors.primary.dark }
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
                                            settings.retention_days === days && { backgroundColor: colors.primary.dark }
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
});
