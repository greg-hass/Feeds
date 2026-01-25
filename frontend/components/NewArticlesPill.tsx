import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useFeedStore } from '@/stores';
import { useColors, borderRadius, spacing } from '@/theme';

const DISPLAY_DURATION = 3000; // 3 seconds

export default function NewArticlesPill() {
    const colors = useColors();
    const lastRefreshNewArticles = useFeedStore((state) => state.lastRefreshNewArticles);
    const [displayCount, setDisplayCount] = useState<number | null>(null);
    const [opacity] = useState(() => new Animated.Value(0));
    const [translateY] = useState(() => new Animated.Value(-20));
    const [scale] = useState(() => new Animated.Value(0.8));

    useEffect(() => {
        if (lastRefreshNewArticles !== null && lastRefreshNewArticles > 0) {
            setDisplayCount(lastRefreshNewArticles);

            // Animate in
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 0,
                    friction: 8,
                    tension: 100,
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 8,
                    tension: 100,
                    useNativeDriver: true,
                }),
            ]).start();

            // Animate out after duration
            const timeout = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: -20,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 0.8,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ]).start(() => {
                    setDisplayCount(null);
                    // Clear the store value
                    useFeedStore.setState({ lastRefreshNewArticles: null });
                });
            }, DISPLAY_DURATION);

            return () => clearTimeout(timeout);
        }
    }, [lastRefreshNewArticles]);

    if (displayCount === null) return null;

    const s = styles(colors);

    return (
        <Animated.View
            style={[
                s.container,
                {
                    opacity,
                    transform: [{ translateY }, { scale }],
                },
            ]}
            pointerEvents="none"
        >
            <View style={s.pill}>
                <Text style={s.text}>New Articles</Text>
                <View style={s.badge}>
                    <Text style={s.badgeText}>{displayCount}</Text>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'web' ? 70 : 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary.DEFAULT,
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
        color: '#fff',
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
