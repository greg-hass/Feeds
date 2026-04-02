import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, X, Menu } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';

const iconButtonHitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;

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
    showMenuButton?: boolean;
    onMenuPress?: () => void;
    isRefreshing?: boolean;
    lastRefreshed?: Date | null;
    refreshIndicator?: {
        color: string;
        accessibilityLabel?: string;
    } | null;
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
    showMenuButton = false,
    onMenuPress,
    isRefreshing,
    lastRefreshed,
    refreshIndicator,
}: ScreenHeaderProps) => {
    const router = useRouter();
    const colors = useColors();
    const s = styles(colors);

    const formatLastRefreshed = (date: Date | null | undefined): string => {
        if (!date) return '';
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return '';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    };

    const lastRefreshedLabel = formatLastRefreshed(lastRefreshed);

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
            <View style={[s.leftContainer, centerTitle && s.leftContainerCentered, showMenuButton && s.leftContainerWithMenu]}>
                {showMenuButton && (
                    <TouchableOpacity 
                        onPress={onMenuPress}
                        style={s.menuButton}
                        hitSlop={iconButtonHitSlop}
                        accessibilityLabel="Open menu"
                        accessibilityRole="button"
                    >
                        <Menu size={22} color={colors.text.primary} />
                    </TouchableOpacity>
                )}
                {showBackButton && (
                    <TouchableOpacity 
                        onPress={handleBack}
                        style={s.backButton}
                        hitSlop={iconButtonHitSlop}
                        accessibilityLabel={backButtonVariant === 'close' ? 'Close' : 'Go back'}
                        accessibilityRole="button"
                    >
                        <BackIcon size={22} color={colors.text.primary} />
                    </TouchableOpacity>
                )}
                <View style={[s.titleContainer, showMenuButton && s.titleContainerWithMenu]}>
                    <Text 
                        style={[
                            s.headerTitle, 
                            centerTitle && s.headerTitleCentered
                        ]} 
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                </View>
            </View>

            {/* Right section */}
            {(actions.length > 0 || lastRefreshedLabel || refreshIndicator) && (
                <View style={s.rightContainer}>
                    {lastRefreshedLabel ? <Text style={s.timerText}>{lastRefreshedLabel}</Text> : null}
                    {refreshIndicator ? (
                        <View
                            style={[s.statusDot, { backgroundColor: refreshIndicator.color }]}
                            accessibilityRole="text"
                            accessibilityLabel={refreshIndicator.accessibilityLabel || 'Feed refresh status'}
                        />
                    ) : null}
                    {actions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={action.onPress}
                            style={[
                                s.actionButton,
                                action.variant === 'primary' && s.actionButtonPrimary,
                                action.variant === 'danger' && s.actionButtonDanger,
                            ]}
                            hitSlop={iconButtonHitSlop}
                            disabled={action.disabled || action.loading}
                            accessibilityLabel={action.accessibilityLabel}
                            accessibilityRole="button"
                        >
                            {action.icon}
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
        paddingHorizontal: spacing.lg,
        // SafeAreaView in _layout.tsx now handles top safe area
        // Only add padding for web PWA
        paddingTop: Platform.OS === 'web' ? ('calc(env(safe-area-inset-top) + 12px)' as any) : spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
        minHeight: 56,
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
    leftContainerWithMenu: {
        marginLeft: 0,
    },
    menuButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
        borderRadius: borderRadius.full,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainerWithMenu: {
        marginLeft: spacing.sm,
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
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
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
        flexShrink: 1,
    },
    actionButton: {
        padding: 4,
        borderRadius: borderRadius.md,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    actionButtonPrimary: {
        backgroundColor: colors.primary?.soft ?? `${colors.primary?.DEFAULT ?? colors.primary}22`,
        borderColor: colors.primary?.DEFAULT ?? colors.primary,
    },
    actionButtonDanger: {
        backgroundColor: colors.status.error + '22',
        borderColor: colors.status.error + '55',
    },
    timerText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.primary?.DEFAULT ?? colors.primary,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
        marginRight: spacing.xs,
        flexShrink: 1,
        maxWidth: Platform.OS === 'web' ? 200 : 100,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: spacing.xs,
        flexShrink: 0,
    },
});
