import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useColors } from '@/theme';

export const PlayingWaveform = ({ color, size = 16 }: { color: string; size?: number }) => {
    const anims = [
        useRef(new Animated.Value(0.4)).current,
        useRef(new Animated.Value(0.7)).current,
        useRef(new Animated.Value(0.3)).current,
        useRef(new Animated.Value(0.9)).current,
    ];

    useEffect(() => {
        anims.forEach((anim, i) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 0.2 + Math.random() * 0.8,
                        duration: 300 + Math.random() * 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0.2 + Math.random() * 0.8,
                        duration: 300 + Math.random() * 500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        });
    }, []);

    return (
        <View style={[s.container, { width: size, height: size }]}>
            {anims.map((anim, i) => (
                <Animated.View
                    key={i}
                    style={[
                        s.bar,
                        {
                            backgroundColor: color,
                            transform: [{ scaleY: anim }],
                        },
                    ]}
                />
            ))}
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    bar: {
        flex: 1,
        height: '100%',
        borderRadius: 1,
    },
});
