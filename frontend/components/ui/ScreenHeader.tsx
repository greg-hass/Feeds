import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';

export interface HeaderAction {
    icon: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    accessibilityLabel: string;
    variant?: 'default' | 'primary' | 'danger';
}

interface ScreenHeaderProps {
    title: string;
    showBackButton?: boolean;
    backButtonVariant?: 'back' | 'close';
    onBackPress?: () => void;
    rightActions?: HeaderAction[];
    rightAction?: React.ReactNode; // Legacy single action support
    centerTitle?: boolean;
    showBorder?: boolean;
    style?: ViewStyle;
    isRefreshing?: boolean;
    refreshText?: string;
}

export const ScreenHeader = ({ 
    title, 
    showBackButton = true,
    backButtonVariant = 'back',
    onBackPress,
    rightActions,
    rightAction, // Legacy support
    centerTitle = false,
    showBorder = true,
    style,
    isRefreshing = false,
    refreshText = 'Refreshing…',
}: ScreenHeaderProps) => {
    const router = useRouter();
    const colors = useColors();
    const s = styles(colors);

    const handleBack = () => {
        if (onBackPress) {
            onBackPress();
        } else {
            router.back();
        }
    };

    const BackIcon = backButtonVariant === 'close' ? X : ArrowLeft;

    // Normalize legacy rightAction to rightActions array
    const actions: HeaderAction[] = rightActions || (rightAction ? [{
        icon: rightAction,
        onPress: () => {},
        accessibilityLabel: 'Action',
    }] : []);

    return (
        <View style={[
            s.header, 
            !showBorder && s.noBorder,
            centerTitle && s.centeredHeader,
            style
        ]}>
            {/* Left section */}
            <View style={[s.leftContainer, centerTitle && s.leftContainerCentered]}>
                {showBackButton && (
                    <TouchableOpacity 
                        onPress={handleBack}
                        style={s.backButton}
                        accessibilityLabel={backButtonVariant === 'close' ? 'Close' : 'Go back'}
                        accessibilityRole="button"
                    >
                        <BackIcon size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                )}
                <View style={s.titleContainer}>
                    <Text 
                        style={[
                            s.headerTitle, 
                            centerTitle && s.headerTitleCentered
                        ]} 
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    {isRefreshing && (
                        <View style={s.refreshPill}>
                            <ActivityIndicator size={10} color={colors.primary?.DEFAULT ?? colors.primary} />
                            <Text style={s.refreshText}>{refreshText}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Right section */}
            {actions.length > 0 && (
                <View style={s.rightContainer}>
                    {actions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={action.onPress}
                            style={[
                                s.actionButton,
                                action.variant === 'primary' && s.actionButtonPrimary,
                                action.variant === 'danger' && s.actionButtonDanger,
                            ]}
                            disabled={action.disabled || action.loading}
                            accessibilityLabel={action.accessibilityLabel}
                            accessibilityRole="button"
                        >
                            {action.loading ? (
                                <ActivityIndicator 
                                    size="small" 
                                    color={action.variant === 'primary' ? colors.text.inverse : colors.text.secondary} 
                                />
                            ) : action.icon}
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
        minHeight: 60,
    },
    noBorder: {
        borderBottomWidth: 0,
    },
    centeredHeader: {
        justifyContent: 'center',
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.md,
    },
    leftContainerCentered: {
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        flex: undefined,
        zIndex: 1,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    backButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
        borderRadius: borderRadius.full,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
        flex: 1,
    },
    headerTitleCentered: {
        textAlign: 'center',
        flex: undefined,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    actionButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        minWidth: 40,
        minHeight: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonPrimary: {
        backgroundColor: colors.primary?.DEFAULT ?? colors.primary,
    },
    actionButtonDanger: {
        backgroundColor: colors.status.error + '22',
    },
    refreshPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.background.secondary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    refreshText: {
        fontSize: 11,
        color: colors.text.tertiary,
        fontWeight: '500',
    },
});
