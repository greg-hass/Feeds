import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Download, RefreshCw } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { shareContent } from '@/utils/share';

export function AnalyticsHeader() {
    const colors = useColors();
    const { fetchAll, exportData, isLoading } = useAnalyticsStore();

    const handleExport = async () => {
        try {
            const data = await exportData();
            const jsonString = JSON.stringify(data, null, 2);

            // Share or save the data
            await shareContent({
                title: 'Analytics Export',
                message: jsonString,
            });
        } catch (error) {
            Alert.alert('Export Failed', 'Could not export analytics data');
        }
    };

    const s = styles(colors);

    return (
        <View style={s.container}>
            <View style={s.titleContainer}>
                <Text style={s.title}>Analytics</Text>
                <Text style={s.subtitle}>Insights into your reading habits</Text>
            </View>

            <View style={s.actions}>
                <TouchableOpacity
                    style={s.iconButton}
                    onPress={() => fetchAll()}
                    disabled={isLoading}
                    accessibilityLabel="Refresh analytics"
                >
                    <RefreshCw size={20} color={colors.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={s.iconButton}
                    onPress={handleExport}
                    accessibilityLabel="Export analytics"
                >
                    <Download size={20} color={colors.text.secondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.background.elevated,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        ...typography.h1,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.body,
        color: colors.text.secondary,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    iconButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
    },
});
