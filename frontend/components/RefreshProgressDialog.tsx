import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions, Platform, TouchableOpacity } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { RefreshCw, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RefreshProgressDialogProps {
    visible: boolean;
    total: number;
    completed: number;
    currentTitle: string;
    onCancel?: () => void;
}

export function RefreshProgressDialog({ visible, total, completed, currentTitle, onCancel }: RefreshProgressDialogProps) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;
    const isMobileWeb = Platform.OS === 'web' && width < 768;

    // Animation
    const [fadeAnim] = React.useState(() => new Animated.Value(0));
    const [slideAnim] = React.useState(() => new Animated.Value(20));
    const [spinAnim] = React.useState(() => new Animated.Value(0));

    const progress = total > 0 ? completed / total : 0;
    const percentage = Math.round(progress * 100);

    useEffect(() => {
        if (visible) {
            // Reset and start spinning
            spinAnim.setValue(0);
            Animated.loop(
                Animated.timing(spinAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                })
            ).start();

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            spinAnim.stopAnimation();
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 20,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [visible, fadeAnim, slideAnim, spinAnim]);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    if (!visible) return null;

    const s = styles(colors, isDesktop, isMobileWeb, insets);

    return (
        <Animated.View
            style={[
                s.floatingContainer,
                {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                }
            ]}
        >
            {/* Top Accent Bar */}
            <View style={s.accentBar} />
            
            <View style={s.content}>
                <View style={s.header}>
                    <View style={s.titleRow}>
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <RefreshCw size={14} color={colors.primary.DEFAULT} />
                        </Animated.View>
                        <Text style={s.title}>Refreshing Feeds…</Text>
                    </View>
                    <View style={s.headerRight}>
                        <Text style={s.countText}>{completed} / {total}</Text>
                        {onCancel ? (
                            <TouchableOpacity
                                onPress={onCancel}
                                style={s.cancelButton}
                                accessibilityLabel="Cancel refresh"
                                accessibilityRole="button"
                            >
                                <X size={12} color={colors.text.secondary} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                <View style={s.progressBarContainer}>
                    <View style={s.progressBar}>
                        <View style={[s.progressFill, { width: `${percentage}%` }]} />
                    </View>
                </View>

                {currentTitle ? (
                    <Text style={s.currentFeed} numberOfLines={1}>
                        {currentTitle}
                    </Text>
                ) : null}
            </View>
        </Animated.View>
    );
}

const styles = (colors: any, isDesktop: boolean, isMobileWeb: boolean, insets: any) => StyleSheet.create({
    floatingContainer: {
        position: 'absolute',
        zIndex: 9999,
        // Responsive positioning
        bottom: isDesktop ? 40 : (insets.bottom + 80), // Sit above the mobile nav bar
        right: isDesktop ? 40 : spacing.lg,
        left: isDesktop ? undefined : spacing.lg,
        // Sizing
        width: isDesktop ? 340 : 'auto',
        // Aesthetics
        backgroundColor: colors.background.secondary, // Use secondary for better contrast
        borderRadius: borderRadius.lg,
        borderWidth: 1.5,
        borderColor: colors.primary.dark + '60', // Emerald glow border
        overflow: 'hidden',
        // Solid depth shadow
        ...Platform.select({
            web: {
                boxShadow: `0 12px 40px rgba(0,0,0,0.4), 0 0 15px ${colors.primary.dark}20`,
            },
            default: {
                shadowColor: colors.primary.dark,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 15,
            }
        }),
    },
    accentBar: {
        height: 3,
        width: '100%',
        backgroundColor: colors.primary.DEFAULT,
        opacity: 0.8,
    },
    content: {
        padding: spacing.md,
        paddingTop: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.text.primary,
        letterSpacing: -0.1,
    },
    countText: {
        fontSize: 11,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
        backgroundColor: colors.primary.dark + '25',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    cancelButton: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.tertiary,
    },
    progressBarContainer: {
        height: 6,
        width: '100%',
        backgroundColor: colors.background.tertiary,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    progressBar: {
        flex: 1,
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary.DEFAULT,
    },
    currentFeed: {
        fontSize: 11,
        color: colors.text.secondary,
        fontWeight: '600',
        opacity: 0.9,
    },
});
