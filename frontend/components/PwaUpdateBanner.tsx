import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';

interface PwaUpdateBannerProps {
    visible: boolean;
    onReload: () => void;
    onDismiss: () => void;
}

export function PwaUpdateBanner({ visible, onReload, onDismiss }: PwaUpdateBannerProps) {
    const colors = useColors();
    const s = styles(colors);

    if (!visible) {
        return null;
    }

    return (
        <View style={s.container}>
            <View style={s.content}>
                <Text style={s.title}>Update ready</Text>
                <Text style={s.body} numberOfLines={2}>
                    A newer version of Feeds is available.
                </Text>
            </View>
            <TouchableOpacity
                onPress={onReload}
                style={[s.button, s.primaryButton]}
                accessibilityRole="button"
                accessibilityLabel="Reload app to update"
            >
                <Text style={s.primaryButtonText}>Reload</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={onDismiss}
                style={s.button}
                accessibilityRole="button"
                accessibilityLabel="Dismiss update notice"
            >
                <Text style={s.buttonText}>Later</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: Platform.OS === 'web' ? spacing.xl : spacing.xl + 72,
        zIndex: 9998,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.primary.dark,
        backgroundColor: colors.background.secondary,
        ...(Platform.OS === 'web' ? {
            boxShadow: `0 12px 28px rgba(0,0,0,0.28)`,
        } : {
            elevation: 10,
        }),
    },
    content: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.text.primary,
    },
    body: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.secondary,
    },
    button: {
        minHeight: 36,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.tertiary,
    },
    primaryButton: {
        backgroundColor: colors.primary.DEFAULT,
    },
    buttonText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.primary,
    },
    primaryButtonText: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.text.inverse,
    },
});
