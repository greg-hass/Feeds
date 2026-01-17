import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSettingsStore, useAuthStore } from '@/stores';
import { ArrowLeft, Sun, Moon, Monitor } from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

export default function SettingsScreen() {
    const router = useRouter();
    const { settings, fetchSettings, updateSettings } = useSettingsStore();
    const { user, logout } = useAuthStore();

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
        updateSettings({ theme });
    };

    const handleToggle = (key: keyof typeof settings, value: boolean) => {
        if (settings) {
            updateSettings({ [key]: value });
        }
    };

    if (!settings) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Settings</Text>
                </View>
                <View style={styles.loading}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Account */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Username</Text>
                            <Text style={styles.value}>{user?.username}</Text>
                        </View>
                    </View>
                </View>

                {/* Appearance */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <View style={styles.card}>
                        <Text style={styles.label}>Theme</Text>
                        <View style={styles.themeRow}>
                            <TouchableOpacity
                                style={[styles.themeOption, settings.theme === 'light' && styles.themeOptionActive]}
                                onPress={() => handleThemeChange('light')}
                            >
                                <Sun size={20} color={settings.theme === 'light' ? colors.text.inverse : colors.text.secondary} />
                                <Text style={[styles.themeText, settings.theme === 'light' && styles.themeTextActive]}>Light</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.themeOption, settings.theme === 'dark' && styles.themeOptionActive]}
                                onPress={() => handleThemeChange('dark')}
                            >
                                <Moon size={20} color={settings.theme === 'dark' ? colors.text.inverse : colors.text.secondary} />
                                <Text style={[styles.themeText, settings.theme === 'dark' && styles.themeTextActive]}>Dark</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.themeOption, settings.theme === 'auto' && styles.themeOptionActive]}
                                onPress={() => handleThemeChange('auto')}
                            >
                                <Monitor size={20} color={settings.theme === 'auto' ? colors.text.inverse : colors.text.secondary} />
                                <Text style={[styles.themeText, settings.theme === 'auto' && styles.themeTextActive]}>Auto</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.row}>
                            <Text style={styles.label}>Show Images</Text>
                            <Switch
                                value={settings.show_images}
                                onValueChange={(v) => handleToggle('show_images', v)}
                                trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                                thumbColor={colors.text.primary}
                            />
                        </View>
                    </View>
                </View>

                {/* Reading */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Reading</Text>
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <View>
                                <Text style={styles.label}>Reader Mode</Text>
                                <Text style={styles.hint}>Use cleaned article view</Text>
                            </View>
                            <Switch
                                value={settings.readability_enabled}
                                onValueChange={(v) => handleToggle('readability_enabled', v)}
                                trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                                thumbColor={colors.text.primary}
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.row}>
                            <View>
                                <Text style={styles.label}>Fetch Full Content</Text>
                                <Text style={styles.hint}>Download full articles</Text>
                            </View>
                            <Switch
                                value={settings.fetch_full_content}
                                onValueChange={(v) => handleToggle('fetch_full_content', v)}
                                trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                                thumbColor={colors.text.primary}
                            />
                        </View>
                    </View>
                </View>

                {/* Sync */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sync</Text>
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Refresh Interval</Text>
                            <Text style={styles.value}>{settings.refresh_interval_minutes} min</Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.row}>
                            <Text style={styles.label}>Keep Articles For</Text>
                            <Text style={styles.value}>{settings.retention_days} days</Text>
                        </View>
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                {/* Version */}
                <Text style={styles.version}>Feeds v1.0.0</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
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
    },
    themeText: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    themeTextActive: {
        color: colors.text.inverse,
        fontWeight: '600',
    },
    logoutButton: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
        marginTop: spacing.lg,
    },
    logoutText: {
        fontSize: 16,
        color: colors.error,
        fontWeight: '500',
    },
    version: {
        textAlign: 'center',
        color: colors.text.tertiary,
        marginTop: spacing.xl,
    },
});
