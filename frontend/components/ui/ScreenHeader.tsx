import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, X, Menu } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';
import { UI } from '@/config/constants';

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

    const BackIcon = (backButtonVariant === 'close' ? X : ArrowLeft) as any;
    const MenuIcon = Menu as any;

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
                        <MenuIcon size={22} color={colors.text.primary} />
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
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light ?? colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
        minHeight: UI.HEADER_HEIGHT,
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
        gap: spacing.sm,
    },
    leftContainerCentered: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        flex: undefined,
        zIndex: 1,
    },
    leftContainerWithMenu: {
        marginLeft: 0,
    },
    menuButton: {
        padding: 0,
        marginLeft: -spacing.xs,
        borderRadius: borderRadius.full,
        minWidth: 36,
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.primary,
    },
    titleContainerWithMenu: {
        marginLeft: spacing.xs,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    backButton: {
        padding: 0,
        marginLeft: -spacing.xs,
        borderRadius: borderRadius.full,
        minWidth: 36,
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.primary,
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.2,
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
        gap: spacing.xs,
        flexShrink: 1,
    },
    actionButton: {
        padding: 0,
        borderRadius: borderRadius.full,
        minWidth: 36,
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.primary,
    },
    actionButtonPrimary: {
        backgroundColor: colors.background.secondary,
    },
    actionButtonDanger: {
        backgroundColor: colors.background.secondary,
    },
    timerText: {
        fontSize: 9,
        fontWeight: '800',
        color: colors.text.tertiary,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
        marginRight: 2,
        flexShrink: 1,
        maxWidth: Platform.OS === 'web' ? 160 : 72,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 999,
        marginRight: spacing.xs,
        flexShrink: 0,
    },
});
