import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';

export const AddFeedShimmer = () => {
    const colors = useColors();
    const [animation] = React.useState(() => new Animated.Value(0));

    React.useEffect(() => {
        const animate = () => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(animation, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(animation, {
                        toValue: 0,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        };
        animate();
    }, []);

    const opacity = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    const s = styles(colors);

    return (
        <View style={s.container}>
            {/* Title shimmer */}
            <Animated.View style={[s.titleShimmer, { opacity }]} />
            
            {/* Card shimmers */}
            {[1, 2].map((i) => (
                <View key={i} style={s.card}>
                    <View style={s.cardHeader}>
                        <Animated.View style={[s.iconShimmer, { opacity }]} />
                        <View style={s.textContainer}>
                            <Animated.View style={[s.lineShimmer, { width: '70%', opacity }]} />
                            <Animated.View style={[s.lineShimmer, { width: '40%', opacity }]} />
                        </View>
                    </View>
                    <Animated.View style={[s.descriptionShimmer, { opacity }]} />
                    <View style={s.actions}>
                        <Animated.View style={[s.buttonShimmer, { opacity }]} />
                        <Animated.View style={[s.buttonShimmer, { width: 100, opacity }]} />
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        marginTop: spacing.lg,
    },
    titleShimmer: {
        height: 16,
        width: 120,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.md,
    },
    card: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    iconShimmer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
        marginRight: spacing.md,
    },
    textContainer: {
        flex: 1,
        gap: spacing.xs,
    },
    lineShimmer: {
        height: 14,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
    },
    descriptionShimmer: {
        height: 40,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.md,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
    },
    buttonShimmer: {
        height: 36,
        width: 80,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
    },
});
