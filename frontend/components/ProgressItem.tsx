import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Check, X, Ban, Loader2 } from 'lucide-react-native';
import { useColors, spacing } from '@/theme';

export type ItemStatus = 'pending' | 'processing' | 'success' | 'skipped' | 'error';

export interface ProgressItemData {
    id: string;
    type: 'folder' | 'feed';
    title: string;
    subtitle?: string; // "3 new articles" or error message
    folder?: string;
    status: ItemStatus;
}

interface ProgressItemProps {
    item: ProgressItemData;
}

export function ProgressItem({ item }: ProgressItemProps) {
    const colors = useColors();

    const getStatusIcon = () => {
        switch (item.status) {
            case 'success':
                return <Check size={16} color={colors.primary.DEFAULT} />;
            case 'skipped':
                return <Ban size={16} color={colors.text.tertiary} />;
            case 'error':
                return <X size={16} color={colors.error} />;
            case 'processing':
                return <ActivityIndicator size="small" color={colors.primary.light} />;
            case 'pending':
            default:
                return <View style={[styles.pendingDot, { backgroundColor: colors.text.tertiary }]} />;
        }
    };

    const getTitleColor = () => {
        switch (item.status) {
            case 'success':
                return colors.text.primary;
            case 'skipped':
                return colors.text.tertiary;
            case 'error':
                return colors.error;
            case 'pending':
                return colors.text.tertiary;
            default:
                return colors.text.primary;
        }
    };

    const getSubtitleColor = () => {
        switch (item.status) {
            case 'error':
                return colors.error;
            case 'skipped':
                return colors.text.tertiary;
            default:
                return colors.text.secondary;
        }
    };

    return (
        <View style={[styles.container, { borderBottomColor: colors.border.DEFAULT }]}>
            <View style={styles.iconContainer}>
                {getStatusIcon()}
            </View>
            <View style={styles.content}>
                <Text style={[styles.title, { color: getTitleColor() }]} numberOfLines={1}>
                    {item.type === 'folder' ? `Created folder "${item.title}"` : item.title}
                </Text>
                {item.subtitle && (
                    <Text style={[styles.subtitle, { color: getSubtitleColor() }]} numberOfLines={1}>
                        {item.folder ? `(${item.folder}) - ` : ''}{item.subtitle}
                    </Text>
                )}
                {!item.subtitle && item.folder && (
                    <Text style={[styles.subtitle, { color: colors.text.tertiary }]} numberOfLines={1}>
                        {item.folder}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        borderBottomWidth: 1,
    },
    iconContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 14,
        fontWeight: '500',
    },
    subtitle: {
        fontSize: 12,
    },
    pendingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
