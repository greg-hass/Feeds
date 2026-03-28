import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';

export type LoadingVariant = 'spinner' | 'skeleton' | 'inline' | 'page';

interface LoadingStateProps {
    variant?: LoadingVariant;
    message?: string;
    style?: ViewStyle;
    count?: number; // For skeleton, number of items
}

export const LoadingState = ({
    variant = 'spinner',
    message,
    style,
    count = 3,
}: LoadingStateProps) => {
    const colors = useColors();
    const s = styles(colors);

    switch (variant) {
        case 'inline':
            return (
                <View style={[s.inlineContainer, style]}>
                    <ActivityIndicator size="small" color={colors.primary?.DEFAULT ?? colors.primary} />
                    {message && <Text style={s.inlineText}>{message}</Text>}
                </View>
            );

        case 'page':
            return (
                <View style={[s.pageContainer, style]}>
                    <ActivityIndicator size="large" color={colors.primary?.DEFAULT ?? colors.primary} />
                    {message && <Text style={s.pageText}>{message}</Text>}
                </View>
            );

        case 'skeleton':
            return (
                <View style={[s.skeletonContainer, style]}>
                    {Array.from({ length: count }).map((_, i) => (
                        <View key={i} style={s.skeletonItem}>
                            <View style={s.skeletonHeader}>
                                <View style={s.skeletonIcon} />
                                <View style={s.skeletonTextContainer}>
                                    <View style={s.skeletonTitle} />
                                    <View style={s.skeletonSubtitle} />
                                </View>
                            </View>
                            <View style={s.skeletonBody} />
                            <View style={s.skeletonActions}>
                                <View style={s.skeletonButton} />
                                <View style={s.skeletonButtonSmall} />
                            </View>
                        </View>
                    ))}
                </View>
            );

        case 'spinner':
        default:
            return (
                <View style={[s.spinnerContainer, style]}>
                    <ActivityIndicator size="large" color={colors.primary?.DEFAULT ?? colors.primary} />
                    {message && <Text style={s.spinnerText}>{message}</Text>}
                </View>
            );
    }
};

// Shimmer effect placeholder (can be enhanced with react-native-reanimated)
export const SkeletonCard = () => {
    const colors = useColors();
    const s = styles(colors);

    return (
        <View style={s.skeletonCard}>
            <View style={s.skeletonCardHeader}>
                <View style={s.skeletonCardIcon} />
                <View style={s.skeletonCardTitle} />
            </View>
            <View style={s.skeletonCardBody} />
            <View style={s.skeletonCardFooter}>
                <View style={s.skeletonCardButton} />
            </View>
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    // Inline variant
    inlineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
    },
    inlineText: {
        fontSize: 14,
        color: colors.text.secondary,
    },

    // Page variant
    pageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.xl,
    },
    pageText: {
        fontSize: 16,
        color: colors.text.secondary,
        fontWeight: '500',
    },

    // Spinner variant (default)
    spinnerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.xl,
    },
    spinnerText: {
        fontSize: 14,
        color: colors.text.tertiary,
    },

    // Skeleton variant
    skeletonContainer: {
        gap: spacing.sm,
        paddingVertical: spacing.sm,
    },
    skeletonItem: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    skeletonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    skeletonIcon: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
    },
    skeletonTextContainer: {
        flex: 1,
        gap: 4,
    },
    skeletonTitle: {
        height: 14,
        width: '68%',
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background.tertiary,
    },
    skeletonSubtitle: {
        height: 10,
        width: '42%',
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background.tertiary,
    },
    skeletonBody: {
        height: 32,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background.tertiary,
    },
    skeletonActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.xs,
    },
    skeletonButton: {
        height: 32,
        width: 88,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
    },
    skeletonButtonSmall: {
        height: 32,
        width: 72,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
    },

    // Skeleton Card
    skeletonCard: {
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        gap: spacing.md,
    },
    skeletonCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    skeletonCardIcon: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.background.tertiary,
    },
    skeletonCardTitle: {
        flex: 1,
        height: 16,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background.tertiary,
    },
    skeletonCardBody: {
        height: 60,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background.tertiary,
    },
    skeletonCardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    skeletonCardButton: {
        height: 36,
        width: 100,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
    },
});

export default LoadingState;
