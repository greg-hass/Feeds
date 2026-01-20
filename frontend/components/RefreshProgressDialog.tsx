import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions, Platform } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RefreshProgressDialogProps {
    visible: boolean;
    total: number;
    completed: number;
    currentTitle: string;
}

export function RefreshProgressDialog({ visible, total, completed, currentTitle }: RefreshProgressDialogProps) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;
    const isMobileWeb = Platform.OS === 'web' && width < 768;

    // Animation
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    const progress = total > 0 ? completed / total : 0;
    const percentage = Math.round(progress * 100);

    useEffect(() => {
        if (visible) {
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
    }, [visible]);

    if (!visible && (fadeAnim as any)._value === 0) return null;

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
            <View style={s.content}>
                <View style={s.header}>
                    <View style={s.titleRow}>
                        <RefreshCw size={14} color={colors.primary.DEFAULT} style={s.spinIcon} />
                        <Text style={s.title}>Refreshing Feeds</Text>
                    </View>
                    <Text style={s.countText}>{completed} / {total}</Text>
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
        width: isDesktop ? 320 : 'auto',
        // Aesthetics
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        // Solid depth shadow
        ...Platform.select({
            web: {
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 10,
            }
        }),
    },
    content: {
        padding: spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
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
        letterSpacing: -0.2,
    },
    countText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.primary.DEFAULT,
        backgroundColor: colors.primary.DEFAULT + '15',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    progressBarContainer: {
        height: 4,
        width: '100%',
        backgroundColor: colors.background.tertiary,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: spacing.xs,
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
        color: colors.text.tertiary,
        fontWeight: '500',
    },
    spinIcon: {
        // We can't easily rotate with CSS properties in react-native styles without extra logic, 
        // but the ActivityIndicator is a fallback if needed.
    }
});
