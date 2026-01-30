import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useFeedStore } from '@/stores';
import { useColors, borderRadius, spacing } from '@/theme';

const DISPLAY_DURATION = 4000; // 4 seconds

interface NewArticlesPillProps {
    isDesktop?: boolean;
}

export default function NewArticlesPill({ isDesktop = false }: NewArticlesPillProps) {
    const colors = useColors();
    const lastRefreshNewArticles = useFeedStore((state) => state.lastRefreshNewArticles);
    const [displayCount, setDisplayCount] = useState<number | null>(null);
    const [opacity] = useState(() => new Animated.Value(0));
    const [translateY] = useState(() => new Animated.Value(20));
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
                        toValue: 20,
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

    const s = styles(colors, isDesktop);

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
                <Text style={s.text}>{displayCount} new article{displayCount !== 1 ? 's' : ''}</Text>
            </View>
        </Animated.View>
    );
}

const styles = (colors: any, isDesktop: boolean) => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: isDesktop ? 24 : 80, // Above mobile nav (approx 56px + safe area)
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary?.DEFAULT ?? colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
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
});
