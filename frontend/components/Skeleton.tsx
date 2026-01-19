import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    radius?: number;
    style?: any;
}

export const Skeleton = ({ width = '100%', height = 20, radius = borderRadius.md, style }: SkeletonProps) => {
    const colors = useColors();
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    backgroundColor: colors.background.tertiary,
                    borderRadius: radius,
                    opacity,
                },
                style,
            ]}
        />
    );
};

export const TimelineSkeleton = () => {
    const { width } = Dimensions.get('window');
    const isMobile = width < 1024;

    return (
        <View style={s.container}>
            {[1, 2, 3, 4].map((i) => (
                <View key={i} style={s.card}>
                    <View style={s.cardBody}>
                        <View style={s.cardInfo}>
                            <Skeleton width={100} height={20} style={{ marginBottom: spacing.sm }} />
                            <Skeleton width="90%" height={24} style={{ marginBottom: spacing.xs }} />
                            <Skeleton width="60%" height={24} style={{ marginBottom: spacing.md }} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Skeleton width={80} height={16} />
                                <Skeleton width={20} height={20} radius={10} />
                            </View>
                        </View>
                        <Skeleton width={90} height={90} radius={borderRadius.lg} />
                    </View>
                </View>
            ))}
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        padding: spacing.lg,
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    cardBody: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    cardInfo: {
        flex: 1,
    },
});
