import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, borderRadius, spacing } from '@/theme';

interface NewArticlesPillProps {
    isDesktop?: boolean;
    onPress?: () => void;
    visible?: boolean;
    count?: number;
    onAutoDismiss?: () => void;
    autoHideMs?: number;
}

export default function NewArticlesPill({
    isDesktop,
    onPress,
    visible,
    count,
    onAutoDismiss,
    autoHideMs = 3000,
}: NewArticlesPillProps) {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const [opacity] = useState(() => new Animated.Value(0));
    const [translateY] = useState(() => new Animated.Value(20));
    const [scale] = useState(() => new Animated.Value(0.8));
    const [isVisible, setIsVisible] = useState(false);
    const useNativeDriver = Platform.OS !== 'web';

    const shouldShow = Boolean(visible && count && count > 0);
    const displayCount = count ?? 0;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Animation trigger
    useEffect(() => {
        if (shouldShow && displayCount && displayCount > 0) {
            const showTimeout = setTimeout(() => {
                setIsVisible(true);
                // Animate in
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver,
                    }),
                    Animated.spring(translateY, {
                        toValue: 0,
                        friction: 8,
                        tension: 100,
                        useNativeDriver,
                    }),
                    Animated.spring(scale, {
                        toValue: 1,
                        friction: 8,
                        tension: 100,
                        useNativeDriver,
                    }),
                ]).start();
            }, 0);

            return () => clearTimeout(showTimeout);
        } else {
            // Animate out
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver,
                }),
                Animated.timing(translateY, {
                    toValue: 20,
                    duration: 200,
                    useNativeDriver,
                }),
                Animated.timing(scale, {
                    toValue: 0.8,
                    duration: 200,
                    useNativeDriver,
                }),
            ]).start(() => {
                setIsVisible(false);
            });
        }
    }, [shouldShow, displayCount, opacity, translateY, scale, useNativeDriver]);

    useEffect(() => {
        if (!shouldShow || !displayCount || displayCount <= 0) return;

        const timeoutId = setTimeout(() => {
            onAutoDismiss?.();
        }, autoHideMs);

        return () => clearTimeout(timeoutId);
    }, [autoHideMs, displayCount, onAutoDismiss, shouldShow]);

    if (!isVisible && !shouldShow) return null;

    const s = styles(colors, insets, isDesktop);

    const handlePress = () => {
        if (onPress) {
            onPress();
        }
    };

    return (
        <Animated.View
            style={[
                s.container,
                {
                    opacity,
                    transform: [{ translateY }, { scale }],
                },
            ]}
        >
            <TouchableOpacity
                style={s.pill}
                onPress={handlePress}
                activeOpacity={0.8}
                accessibilityLabel={`${displayCount} new articles. Tap to scroll to top.`}
                accessibilityRole="button"
            >
                <Text style={s.text}>New Articles</Text>
                <View style={s.badge}>
                    <Text style={s.badgeText}>{displayCount}</Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = (colors: any, insets: any, isDesktop?: boolean) => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: isDesktop ? 40 : (insets.bottom + 90),
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary?.DEFAULT ?? colors.primary,
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        gap: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    text: {
        color: colors.text.inverse,
        fontSize: 14,
        fontWeight: '700',
    },
    badge: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        minWidth: 24,
        alignItems: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
    },
});
